(function ($) {
    'use strict';

    var $flowView = $('#msf-steps-flow-view');
    var $listView = $('#msf-steps-list-view');
    var $canvas = $('#msf-flow-canvas');
    var $warnings = $('#msf-flow-warnings');
    var $inspector = $('#msf-flow-inspector');
    var editor = null;
    var selectedDrawflowId = null;
    var syncTimer = null;
    var stepIdCounter = 0;
    var spacePanHeld = false;
    var canvasPanning = false;
    var canvasPanStart = null;
    var canvasNavBound = false;
    var isRenderingFlow = false;

    if (!$flowView.length || !$canvas.length || typeof msfAdmin === 'undefined') {
        return;
    }

    function getSteps() {
        var raw = $('#msf_steps_json').val() || '[]';

        try {
            return JSON.parse(raw);
        } catch (e) {
            return [];
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function typeLabel(type) {
        var types = (msfAdmin.i18n && msfAdmin.i18n.types) || {};

        return types[type] || type || '';
    }

    function optionsToText(options) {
        if (!options || !options.length) {
            return '';
        }

        return options.map(function (opt) {
            var line = opt.value + '|' + opt.label;

            if (opt.priceEffect && opt.priceEffect.add) {
                line += '|+' + opt.priceEffect.add;

                if (opt.priceEffect.perGuest) {
                    line += '|guest';
                }
            }

            return line;
        }).join('\n');
    }

    function textToOptions(text) {
        return text.split('\n').map(function (line) {
            line = line.trim();

            if (!line) {
                return null;
            }

            var parts = line.split('|').map(function (part) {
                return part.trim();
            });
            var option = {
                value: parts[0] || '',
                label: parts[1] || parts[0] || ''
            };

            if (parts[2]) {
                var match = parts[2].match(/^\+?(-?\d+(?:\.\d+)?)/);

                if (match) {
                    option.priceEffect = { add: parseFloat(match[1]) };

                    if (parts[3] === 'guest' || parts[3] === 'perGuest') {
                        option.priceEffect.perGuest = true;
                    }
                }
            }

            return option;
        }).filter(Boolean);
    }

    function nextStepId() {
        stepIdCounter += 1;

        return 'step_flow_' + Date.now() + '_' + stepIdCounter;
    }

    function nextQuestionId(stepId) {
        return stepId.replace(/^step_/, 'q_');
    }

    function stepToNodeData(step, index) {
        var question = step && step.questions && step.questions[0] ? step.questions[0] : null;

        return {
            stepId: step.id,
            stepType: step.type || 'question',
            title: step.title || '',
            description: step.description || '',
            question: question ? JSON.parse(JSON.stringify(question)) : null,
            visibility: step.visibility ? JSON.parse(JSON.stringify(step.visibility)) : { mode: 'always' },
            interval: step.interval ? JSON.parse(JSON.stringify(step.interval)) : null,
            hasAdvancedVisibility: !!(step.visibility && step.visibility.groups && step.visibility.groups.length),
            index: index
        };
    }

    function defaultQuestionNodeData() {
        var stepId = nextStepId();

        return {
            stepId: stepId,
            stepType: 'question',
            title: '',
            description: '',
            question: {
                id: nextQuestionId(stepId),
                type: 'text',
                label: '',
                required: true,
                options: []
            },
            visibility: { mode: 'always' },
            hasAdvancedVisibility: false,
            index: 0
        };
    }

    function defaultSummaryNodeData() {
        var stepId = nextStepId();

        return {
            stepId: stepId,
            stepType: 'summary',
            title: msfAdmin.i18n.stepTypeSummary || 'Summary',
            description: '',
            question: null,
            visibility: { mode: 'always' },
            hasAdvancedVisibility: false,
            index: 0
        };
    }

    function buildStartHtml() {
        return ''
            + '<div class="msf-flow-node">'
            + '<div class="msf-flow-node__badge">Start</div>'
            + '<strong class="msf-flow-node__title">' + escapeHtml(msfAdmin.i18n.flowStart || 'Start') + '</strong>'
            + '<div class="msf-flow-node__meta">' + escapeHtml(msfAdmin.i18n.flowStartHelp || 'Form begins here') + '</div>'
            + '</div>';
    }

    function buildStepHtml(nodeData) {
        var title = nodeData.title || (nodeData.question && nodeData.question.label) || nodeData.stepId;
        var meta = [];
        var html;

        if (nodeData.stepType === 'summary') {
            meta.push(msfAdmin.i18n.stepTypeSummary || 'Summary');
        } else if (nodeData.question && nodeData.question.type) {
            meta.push(typeLabel(nodeData.question.type));
        }

        meta.push(nodeData.stepId);

        html = ''
            + '<div class="msf-flow-node">'
            + '<div class="msf-flow-node__badge">' + escapeHtml(String((nodeData.index || 0) + 1)) + '</div>'
            + '<strong class="msf-flow-node__title">' + escapeHtml(title || msfAdmin.i18n.flowUntitled || 'Untitled step') + '</strong>';

        if (nodeData.question && nodeData.question.label && nodeData.title && nodeData.question.label !== nodeData.title) {
            html += '<div class="msf-flow-node__label">' + escapeHtml(nodeData.question.label) + '</div>';
        }

        html += '<div class="msf-flow-node__meta">' + escapeHtml(meta.join(' · ')) + '</div>';

        if (nodeData.hasAdvancedVisibility) {
            html += '<div class="msf-flow-node__cond msf-flow-node__cond--advanced">' + escapeHtml(msfAdmin.i18n.flowAdvancedVisibility || 'Advanced visibility rules') + '</div>';
        }

        if (nodeData.question && (nodeData.question.type === 'radio' || nodeData.question.type === 'checkbox') && nodeData.question.options && nodeData.question.options.length) {
            html += '<div class="msf-flow-node__ports">';
            html += '<div class="msf-flow-node__port"><span>next</span></div>';
            nodeData.question.options.forEach(function (opt) {
                html += '<div class="msf-flow-node__port"><span>' + escapeHtml(opt.label || opt.value) + '</span></div>';
            });
            html += '</div>';
        }

        html += '</div>';

        return html;
    }

    function countOutputs(nodeData) {
        if (window.MsfFlowCompiler) {
            return window.MsfFlowCompiler.countOutputs(nodeData);
        }

        return nodeData.stepType === 'summary' ? 0 : 1;
    }

    function renderWarnings(warningItems) {
        if (!warningItems || !warningItems.length) {
            $warnings.hide().empty();
            return;
        }

        var html = '<p><strong>' + escapeHtml(msfAdmin.i18n.flowWarnings || 'Notes') + '</strong></p><ul>';

        warningItems.forEach(function (warning) {
            html += '<li><code>' + escapeHtml(warning.stepId || '') + '</code> — ' + escapeHtml(warning.message || '') + '</li>';
        });

        html += '</ul>';
        $warnings.html(html).show();
    }

    function getHomeData() {
        if (!editor || !editor.drawflow || !editor.drawflow.drawflow || !editor.drawflow.drawflow.Home) {
            return {};
        }

        return editor.drawflow.drawflow.Home.data;
    }

    function findDrawflowIdByStepId(stepId) {
        var homeData = getHomeData();
        var id;

        for (id in homeData) {
            if (!homeData.hasOwnProperty(id)) {
                continue;
            }

            if (homeData[id].data && homeData[id].data.stepId === stepId) {
                return id;
            }
        }

        return null;
    }

    function updateNodeHtml(drawflowId) {
        var node = getHomeData()[drawflowId];

        if (!node) {
            return;
        }

        if (node.data) {
            editor.drawflow.drawflow.Home.data[drawflowId].html = buildStepHtml(node.data);
            var el = document.querySelector('#node-' + drawflowId + ' .drawflow_content_node');

            if (el) {
                el.innerHTML = buildStepHtml(node.data);
            }
        }
    }

    function compileAndSync() {
        if (!editor || !window.MsfFlowCompiler || isRenderingFlow) {
            return false;
        }

        try {
            var result = window.MsfFlowCompiler.compileDrawflow(editor.export());
            var steps = result.steps || [];

            $('#msf_steps_json').val(JSON.stringify(steps));

            if ($('#msf_flow_layout_json').length) {
                $('#msf_flow_layout_json').val(JSON.stringify(result.flowLayout || { version: 1, nodes: [] }));
            }

            if (typeof window.msfBuilderRenderFromSteps === 'function') {
                window.msfBuilderRenderFromSteps(steps);
            }

            renderWarnings(result.warnings);

            if (msfAdmin) {
                msfAdmin.flowLayout = result.flowLayout;
            }

            return true;
        } catch (error) {
            if (window.console && window.console.error) {
                window.console.error('MSF flow compile failed:', error);
            }

            renderWarnings([{
                stepId: '',
                message: msfAdmin.i18n.flowCompileError || 'Could not compile the flow. Check connections and try again.'
            }]);

            return false;
        }
    }

    function scheduleSync() {
        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(compileAndSync, 200);
    }

    function renderInspector(drawflowId) {
        var node = drawflowId ? getHomeData()[drawflowId] : null;
        var data = node && node.data ? node.data : null;
        var question;
        var html;

        if (!data || data.stepType === undefined) {
            $inspector.html('<p class="msf-flow-inspector__empty">' + escapeHtml(msfAdmin.i18n.flowSelectNode || 'Select a step node to edit its settings.') + '</p>');
            return;
        }

        if (data.stepType === 'summary') {
            $inspector.html(
                '<p><strong>' + escapeHtml(msfAdmin.i18n.stepTypeSummary || 'Summary') + '</strong></p>'
                + '<p><label>' + escapeHtml(msfAdmin.i18n.stepTitle || 'Step title') + '<br>'
                + '<input type="text" class="widefat msf-flow-inspector-title" value="' + escapeAttr(data.title || '') + '"></label></p>'
                + '<p class="description">' + escapeHtml(msfAdmin.i18n.flowSummaryHelp || 'Summary is the final review step before submit.') + '</p>'
                + '<p><button type="button" class="button button-link-delete msf-flow-delete-node">' + escapeHtml(msfAdmin.i18n.flowDeleteNode || 'Delete step') + '</button></p>'
            );
            return;
        }

        question = data.question || {
            id: nextQuestionId(data.stepId),
            type: 'text',
            label: '',
            required: true,
            options: []
        };

        html = ''
            + '<p><label>' + escapeHtml(msfAdmin.i18n.stepTitle || 'Step title') + ' <span class="description">(' + escapeHtml(msfAdmin.i18n.flowOptional || 'optional') + ')</span><br>'
            + '<input type="text" class="widefat msf-flow-inspector-title" value="' + escapeAttr(data.title || '') + '"></label></p>'
            + '<p><label>' + escapeHtml(msfAdmin.i18n.questionLabel || 'Question') + '<br>'
            + '<input type="text" class="widefat msf-flow-inspector-label" value="' + escapeAttr(question.label || '') + '"></label></p>'
            + '<p><label>' + escapeHtml(msfAdmin.i18n.questionType || 'Answer type') + '<br>'
            + '<select class="msf-flow-inspector-type">';

        $.each(msfAdmin.i18n.types || {}, function (value, label) {
            html += '<option value="' + escapeAttr(value) + '"' + (question.type === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
        });

        html += ''
            + '</select></label></p>'
            + '<p><label><input type="checkbox" class="msf-flow-inspector-required"' + (question.required ? ' checked' : '') + '> ' + escapeHtml(msfAdmin.i18n.required || 'Required') + '</label></p>'
            + '<p class="msf-flow-inspector-options-wrap"' + ((question.type === 'radio' || question.type === 'checkbox') ? '' : ' style="display:none;"') + '><label>'
            + escapeHtml(msfAdmin.i18n.options || 'Options') + '<br>'
            + '<textarea class="widefat msf-flow-inspector-options" rows="4">' + escapeHtml(optionsToText(question.options)) + '</textarea></label></p>'
            + '<p class="description">' + escapeHtml(msfAdmin.i18n.flowBranchHelp || 'Connect the top output for the default next step. Connect lower outputs for each answer branch.') + '</p>'
            + '<p><button type="button" class="button button-link-delete msf-flow-delete-node">' + escapeHtml(msfAdmin.i18n.flowDeleteNode || 'Delete step') + '</button></p>';

        if (data.hasAdvancedVisibility) {
            html += '<p class="description">' + escapeHtml(msfAdmin.i18n.nestedGroupsNote || 'This step has advanced nested visibility rules (preserved on save).') + '</p>';
        }

        $inspector.html(html);
    }

    function applyCanvasTransform() {
        if (!editor || !editor.precanvas) {
            return;
        }

        editor.precanvas.style.transform = 'translate(' + editor.canvas_x + 'px, ' + editor.canvas_y + 'px) scale(' + editor.zoom + ')';
    }

    function resetDrawflowDragState() {
        if (!editor) {
            return;
        }

        editor.editor_selected = false;
        editor.drag = false;
        editor.connection = false;
        editor.drag_point = false;
    }

    function setCanvasZoom(newZoom, focalX, focalY) {
        var container;
        var oldZoom;
        var ratio;

        if (!editor) {
            return;
        }

        container = $canvas[0];
        oldZoom = editor.zoom;
        newZoom = Math.min(editor.zoom_max || 1.6, Math.max(editor.zoom_min || 0.2, newZoom));

        if (newZoom === oldZoom) {
            return;
        }

        if (typeof focalX !== 'number' || typeof focalY !== 'number') {
            focalX = container.clientWidth / 2;
            focalY = container.clientHeight / 2;
        }

        ratio = newZoom / oldZoom;
        editor.canvas_x = focalX - (focalX - editor.canvas_x) * ratio;
        editor.canvas_y = focalY - (focalY - editor.canvas_y) * ratio;
        editor.zoom = newZoom;
        editor.zoom_last_value = newZoom;
        resetDrawflowDragState();
        applyCanvasTransform();
    }

    function getNodeBounds() {
        var homeData = getHomeData();
        var bounds = null;
        var defaultWidth = 260;
        var defaultHeight = 140;

        Object.keys(homeData).forEach(function (nodeId) {
            var node = homeData[nodeId];
            var el = document.getElementById('node-' + nodeId);
            var width;
            var height;
            var x;
            var y;

            if (!node) {
                return;
            }

            width = el && el.offsetWidth ? el.offsetWidth : defaultWidth;
            height = el && el.offsetHeight ? el.offsetHeight : defaultHeight;
            x = parseFloat(node.pos_x, 10);

            if (isNaN(x)) {
                x = el ? el.offsetLeft : 0;
            }

            y = parseFloat(node.pos_y, 10);

            if (isNaN(y)) {
                y = el ? el.offsetTop : 0;
            }

            if (!bounds) {
                bounds = {
                    minX: x,
                    minY: y,
                    maxX: x + width,
                    maxY: y + height
                };
                return;
            }

            bounds.minX = Math.min(bounds.minX, x);
            bounds.minY = Math.min(bounds.minY, y);
            bounds.maxX = Math.max(bounds.maxX, x + width);
            bounds.maxY = Math.max(bounds.maxY, y + height);
        });

        return bounds;
    }

    function fitFlowToView(padding) {
        var bounds;
        var container;
        var viewWidth;
        var viewHeight;
        var contentWidth;
        var contentHeight;
        var scaleX;
        var scaleY;
        var zoom;

        if (!editor) {
            return false;
        }

        container = $canvas[0];
        viewWidth = container.clientWidth;
        viewHeight = container.clientHeight;

        if (!viewWidth || !viewHeight) {
            return false;
        }

        padding = typeof padding === 'number' ? padding : 48;
        bounds = getNodeBounds();

        if (!bounds) {
            return false;
        }

        contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
        contentHeight = Math.max(bounds.maxY - bounds.minY, 1);
        scaleX = (viewWidth - padding * 2) / contentWidth;
        scaleY = (viewHeight - padding * 2) / contentHeight;
        zoom = Math.min(scaleX, scaleY, editor.zoom_max || 1.6);
        zoom = Math.max(zoom, editor.zoom_min || 0.2);

        editor.zoom = zoom;
        editor.zoom_last_value = zoom;
        editor.canvas_x = padding + ((viewWidth - padding * 2) - contentWidth * zoom) / 2 - bounds.minX * zoom;
        editor.canvas_y = padding + ((viewHeight - padding * 2) - contentHeight * zoom) / 2 - bounds.minY * zoom;
        resetDrawflowDragState();
        applyCanvasTransform();

        return true;
    }

    function scheduleFitFlowToView() {
        var attempts = 0;

        function tryFit() {
            if (fitFlowToView()) {
                return;
            }

            attempts += 1;

            if (attempts < 12) {
                window.setTimeout(tryFit, 50);
            }
        }

        window.requestAnimationFrame(function () {
            tryFit();
        });
    }

    function zoomFlowBy(delta) {
        if (!editor) {
            return;
        }

        setCanvasZoom(editor.zoom + delta);
    }

    function isInteractiveFlowTarget(target) {
        return !!$(target).closest('.drawflow-node, .input, .output, .main-path, .point, .drawflow-delete').length;
    }

    function shouldIgnoreCanvasKeys(target) {
        return !!$(target).closest('input, textarea, select, [contenteditable="true"]').length;
    }

    function bindCanvasNavigation() {
        var container = $canvas[0];

        if (!container || canvasNavBound) {
            return;
        }

        canvasNavBound = true;

        container.addEventListener('wheel', function (event) {
            var rect;
            var delta;

            if (!editor || $flowView.prop('hidden')) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            rect = container.getBoundingClientRect();
            delta = event.deltaY > 0 ? -(editor.zoom_value || 0.1) : (editor.zoom_value || 0.1);
            setCanvasZoom(editor.zoom + delta, event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false, capture: true });

        container.addEventListener('mousedown', function (event) {
            var isMiddleClick = event.button === 1;
            var isLeftPan = event.button === 0 && (spacePanHeld || !isInteractiveFlowTarget(event.target));

            if (!editor || (!isMiddleClick && !isLeftPan)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            resetDrawflowDragState();

            canvasPanning = true;
            canvasPanStart = {
                x: event.clientX,
                y: event.clientY,
                canvasX: editor.canvas_x,
                canvasY: editor.canvas_y
            };
            $canvas.addClass('msf-flow-canvas--panning');
        }, true);

        window.addEventListener('mousemove', function (event) {
            if (!canvasPanning || !editor || !canvasPanStart) {
                return;
            }

            editor.canvas_x = canvasPanStart.canvasX + (event.clientX - canvasPanStart.x);
            editor.canvas_y = canvasPanStart.canvasY + (event.clientY - canvasPanStart.y);
            applyCanvasTransform();
        });

        window.addEventListener('mouseup', function () {
            if (!canvasPanning) {
                return;
            }

            canvasPanning = false;
            canvasPanStart = null;
            $canvas.removeClass('msf-flow-canvas--panning');
            resetDrawflowDragState();
        });

        container.addEventListener('auxclick', function (event) {
            if (event.button === 1) {
                event.preventDefault();
            }
        });

        window.addEventListener('keydown', function (event) {
            if ($flowView.prop('hidden') || event.code !== 'Space' || spacePanHeld || shouldIgnoreCanvasKeys(event.target)) {
                return;
            }

            spacePanHeld = true;
            $canvas.addClass('msf-flow-canvas--space-pan');
            event.preventDefault();
        });

        window.addEventListener('keyup', function (event) {
            if (event.code !== 'Space') {
                return;
            }

            spacePanHeld = false;
            $canvas.removeClass('msf-flow-canvas--space-pan');
        });

        window.addEventListener('blur', function () {
            spacePanHeld = false;
            $canvas.removeClass('msf-flow-canvas--space-pan');
        });
    }

    function bindEditorEvents() {
        editor.on('nodeSelected', function (id) {
            selectedDrawflowId = String(id);
            renderInspector(selectedDrawflowId);
        });

        editor.on('nodeUnselected', function () {
            selectedDrawflowId = null;
            renderInspector(null);
        });

        editor.on('nodeMoved', function () {
            if (!isRenderingFlow) {
                scheduleSync();
            }
        });

        editor.on('connectionCreated', function () {
            if (!isRenderingFlow) {
                scheduleSync();
            }
        });

        editor.on('connectionRemoved', function () {
            if (!isRenderingFlow) {
                scheduleSync();
            }
        });
    }

    function addNodeToCanvas(nodeData, x, y) {
        var outputs = countOutputs(nodeData);
        var nodeId = editor.addNode(
            'step',
            1,
            outputs,
            x,
            y,
            'msf-flow-node-wrap msf-flow-node-wrap--' + (nodeData.stepType || 'question'),
            nodeData,
            buildStepHtml(nodeData)
        );

        return nodeId;
    }

    function renderFlow() {
        if (typeof Drawflow === 'undefined' || typeof window.MsfFlowDecompiler === 'undefined') {
            return;
        }

        var steps = getSteps();

        isRenderingFlow = true;
        canvasPanning = false;
        canvasPanStart = null;
        spacePanHeld = false;
        $canvas.removeClass('msf-flow-canvas--panning msf-flow-canvas--space-pan');

        try {
            $canvas.empty();
            $warnings.hide().empty();
            selectedDrawflowId = null;
            renderInspector(null);

            editor = new Drawflow($canvas[0]);
            editor.reroute = true;
            editor.reroute_fix_curvature = true;
            editor.editor_mode = 'edit';
            editor.zoom_min = 0.2;
            editor.zoom_max = 1.6;
            editor.zoom = 1;
            editor.zoom_last_value = 1;
            editor.canvas_x = 0;
            editor.canvas_y = 0;
            editor.start();
            bindCanvasNavigation();
            bindEditorEvents();

            var graph = steps.length
                ? window.MsfFlowDecompiler.decompileForEditor(steps, msfAdmin.flowLayout || null)
                : { nodes: [], edges: [], warnings: [], start: { x: 40, y: 120 } };

            if (window.MsfFlowLayout) {
                graph = window.MsfFlowLayout.apply(graph);
            }

            var nodeMap = {};
            var startId = editor.addNode(
                'start',
                0,
                1,
                graph.start.x,
                graph.start.y,
                'msf-flow-node-wrap msf-flow-node-wrap--start',
                { stepId: '__start__' },
                buildStartHtml()
            );

            nodeMap.__start__ = startId;

            graph.nodes.forEach(function (node, index) {
                var nodeData = node.step ? stepToNodeData(node.step, index) : {
                    stepId: node.stepId,
                    stepType: node.type || 'question',
                    title: node.title || '',
                    question: {
                        id: nextQuestionId(node.stepId),
                        type: node.questionType || 'text',
                        label: node.label || '',
                        required: true,
                        options: []
                    },
                    visibility: node.visibility || { mode: 'always' },
                    hasAdvancedVisibility: node.hasAdvancedVisibility,
                    index: index
                };

                nodeData.index = index;

                var drawflowId = addNodeToCanvas(nodeData, node.x, node.y);

                nodeMap[node.stepId] = drawflowId;
            });

            addEdge(nodeMap, graph.edges || []);

            renderWarnings(graph.warnings);

            if (!steps.length) {
                renderWarnings([{ stepId: '', message: msfAdmin.i18n.flowEmptyEditable || 'Use Add question to create your first step, then connect it from Start.' }]);
            }
        } finally {
            isRenderingFlow = false;
            scheduleFitFlowToView();
        }
    }

    function addEdge(nodeMap, edges) {
        edges.forEach(function (edge) {
            var fromId = nodeMap[edge.from];
            var toId = nodeMap[edge.to];
            var outputPort = edge.outputPort || 'output_1';

            if (!fromId || !toId) {
                return;
            }

            editor.addConnection(fromId, toId, outputPort, 'input_1');
        });

    }

    function addQuestionNode() {
        if (!editor) {
            renderFlow();
        }

        var data = defaultQuestionNodeData();
        var x = 260 + (Object.keys(getHomeData()).length * 20);
        var y = 80 + (Object.keys(getHomeData()).length * 20);
        var drawflowId = addNodeToCanvas(data, x, y);

        selectedDrawflowId = String(drawflowId);
        renderInspector(selectedDrawflowId);
        scheduleSync();
    }

    function addSummaryNode() {
        if (!editor) {
            renderFlow();
        }

        var data = defaultSummaryNodeData();
        var x = 260 + (Object.keys(getHomeData()).length * 20);
        var y = 160 + (Object.keys(getHomeData()).length * 20);
        var drawflowId = addNodeToCanvas(data, x, y);

        selectedDrawflowId = String(drawflowId);
        renderInspector(selectedDrawflowId);
        scheduleSync();
    }

    function deleteSelectedNode() {
        if (!editor || !selectedDrawflowId) {
            return;
        }

        var node = getHomeData()[selectedDrawflowId];

        if (!node || !node.data || node.data.stepId === '__start__') {
            return;
        }

        editor.removeNodeId(selectedDrawflowId);
        selectedDrawflowId = null;
        renderInspector(null);
        scheduleSync();
    }

    function setActiveView(view) {
        var isFlow = view === 'flow';

        $('.msf-builder-tab').removeClass('is-active').attr('aria-selected', 'false');
        $('.msf-builder-tab[data-msf-builder-view="' + view + '"]').addClass('is-active').attr('aria-selected', 'true');

        $listView.toggle(!isFlow);
        $flowView.prop('hidden', isFlow ? false : true);

        if (isFlow) {
            if (typeof window.msfBuilderSync === 'function') {
                window.msfBuilderSync();
            }

            window.setTimeout(renderFlow, 0);
            return;
        }

        window.setTimeout(function () {
            if (editor) {
                compileAndSync();
            }
        }, 0);
    }

    $inspector.on('input change', '.msf-flow-inspector-title, .msf-flow-inspector-label, .msf-flow-inspector-type, .msf-flow-inspector-required, .msf-flow-inspector-options', function () {
        if (!selectedDrawflowId || !editor) {
            return;
        }

        var node = getHomeData()[selectedDrawflowId];

        if (!node || !node.data) {
            return;
        }

        var data = node.data;
        var oldType = data.question ? data.question.type : 'text';
        var newType = $inspector.find('.msf-flow-inspector-type').val() || 'text';
        var typeChanged = oldType !== newType;

        data.title = $inspector.find('.msf-flow-inspector-title').val();

        if (data.stepType !== 'summary') {
            if (!data.question) {
                data.question = {
                    id: nextQuestionId(data.stepId),
                    type: 'text',
                    label: '',
                    required: true,
                    options: []
                };
            }

            data.question.label = $inspector.find('.msf-flow-inspector-label').val();
            data.question.type = newType;
            data.question.required = $inspector.find('.msf-flow-inspector-required').is(':checked');

            if (newType === 'radio' || newType === 'checkbox') {
                data.question.options = textToOptions($inspector.find('.msf-flow-inspector-options').val());
                $inspector.find('.msf-flow-inspector-options-wrap').show();
            } else {
                data.question.options = [];
                $inspector.find('.msf-flow-inspector-options-wrap').hide();
            }
        }

        editor.updateNodeDataFromId(selectedDrawflowId, data);
        updateNodeHtml(selectedDrawflowId);

        if (typeChanged && (newType === 'radio' || newType === 'checkbox' || oldType === 'radio' || oldType === 'checkbox')) {
            window.alert(msfAdmin.i18n.flowOutputsChanged || 'Answer type changed. Re-open Flow view to refresh branch outputs if needed.');
        }

        scheduleSync();
    });

    $inspector.on('click', '.msf-flow-delete-node', function (event) {
        event.preventDefault();
        deleteSelectedNode();
    });

    $('#msf-flow-add-question').on('click', function (event) {
        event.preventDefault();
        addQuestionNode();
    });

    $('#msf-flow-add-summary').on('click', function (event) {
        event.preventDefault();
        addSummaryNode();
    });

    $('#msf-flow-fit-view').on('click', function (event) {
        event.preventDefault();
        fitFlowToView();
    });

    $('#msf-flow-zoom-in').on('click', function (event) {
        event.preventDefault();
        zoomFlowBy(editor ? editor.zoom_value || 0.1 : 0.1);
    });

    $('#msf-flow-zoom-out').on('click', function (event) {
        event.preventDefault();
        zoomFlowBy(editor ? -(editor.zoom_value || 0.1) : -0.1);
    });

    $('.msf-builder-tabs').on('click', '.msf-builder-tab', function (event) {
        event.preventDefault();
        event.stopPropagation();
        setActiveView($(this).data('msfBuilderView') || 'list');
    });

    $('form#post').on('submit', function () {
        if (!$flowView.prop('hidden')) {
            compileAndSync();
        }
    });

    window.msfFlowRender = renderFlow;
    window.msfFlowCompile = compileAndSync;
}(jQuery));
