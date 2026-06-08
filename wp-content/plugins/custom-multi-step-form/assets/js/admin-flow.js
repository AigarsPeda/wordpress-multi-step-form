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
    var flowResizeObserver = null;
    var fitResizeTimer = null;
    var initialFlowViewPending = false;

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

    function numberExamplesToText(examples) {
        if (!examples || !examples.length) {
            return '';
        }

        return examples.join(', ');
    }

    function textToNumberExamples(text) {
        return String(text || '')
            .split(/[\s,]+/)
            .map(function (part) {
                return part.trim();
            })
            .filter(Boolean)
            .map(function (part) {
                return parseFloat(part);
            })
            .filter(function (value) {
                return !isNaN(value);
            });
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
                + '<p><button type="button" class="button button-secondary msf-flow-center-node">' + escapeHtml(msfAdmin.i18n.flowCenterNode || 'Center on step') + '</button></p>'
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

        var numberMin = (question.validation && question.validation.min != null) ? question.validation.min : '';
        var numberMax = (question.validation && question.validation.max != null) ? question.validation.max : '';
        var numberPlaceholder = question.placeholder || '';
        var numberExamples = numberExamplesToText(question.numberExamples);

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
            + '<div class="msf-flow-inspector-number-wrap"' + (question.type === 'number' ? '' : ' style="display:none;"') + '>'
            + '<p><label>' + escapeHtml(msfAdmin.i18n.numberMin || 'Minimum value') + '<br>'
            + '<input type="number" class="small-text msf-flow-inspector-number-min" step="1" value="' + escapeAttr(numberMin) + '"></label></p>'
            + '<p><label>' + escapeHtml(msfAdmin.i18n.numberMax || 'Maximum value') + '<br>'
            + '<input type="number" class="small-text msf-flow-inspector-number-max" step="1" value="' + escapeAttr(numberMax) + '"></label></p>'
            + '<p><label>' + escapeHtml(msfAdmin.i18n.numberPlaceholder || 'Example placeholder') + '<br>'
            + '<input type="text" class="regular-text msf-flow-inspector-number-placeholder" value="' + escapeAttr(numberPlaceholder) + '"></label></p>'
            + '<p class="description">' + escapeHtml(msfAdmin.i18n.numberPlaceholderHelp || '') + '</p>'
            + '<p><label>' + escapeHtml(msfAdmin.i18n.numberExamples || 'Quick-pick values') + '<br>'
            + '<input type="text" class="widefat msf-flow-inspector-number-examples" value="' + escapeAttr(numberExamples) + '"></label></p>'
            + '<p class="description">' + escapeHtml(msfAdmin.i18n.numberExamplesHelp || '') + '</p>'
            + '</div>'
            + '<p class="msf-flow-inspector-options-wrap"' + ((question.type === 'radio' || question.type === 'checkbox') ? '' : ' style="display:none;"') + '><label>'
            + escapeHtml(msfAdmin.i18n.options || 'Options') + '<br>'
            + '<textarea class="widefat msf-flow-inspector-options" rows="4">' + escapeHtml(optionsToText(question.options)) + '</textarea></label></p>'
            + '<p class="description">' + escapeHtml(msfAdmin.i18n.flowBranchHelp || 'Connect the top output for the default next step. Connect lower outputs for each answer branch.') + '</p>'
            + '<p><button type="button" class="button button-secondary msf-flow-center-node">' + escapeHtml(msfAdmin.i18n.flowCenterNode || 'Center on step') + '</button></p>'
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

    function isFlowViewVisible() {
        return $flowView.length && $flowView[0] && $flowView[0].hidden === false;
    }

    function sanitizeGraphPositions(graph) {
        var positioned;
        var minX;
        var minY;
        var maxX;
        var maxY;

        if (!graph || !Array.isArray(graph.nodes) || !graph.nodes.length) {
            return graph;
        }

        positioned = 0;
        minX = Infinity;
        minY = Infinity;
        maxX = -Infinity;
        maxY = -Infinity;

        graph.nodes.forEach(function (node) {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') {
                return;
            }

            positioned++;
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + 260);
            maxY = Math.max(maxY, node.y + 140);
        });

        if (!positioned || positioned !== graph.nodes.length) {
            return graph;
        }

        // Saved layout stuck in the bottom-right pocket of the canvas — re-layout from scratch.
        if (minX >= 420 && minY >= 260) {
            graph.nodes.forEach(function (node) {
                node.x = null;
                node.y = null;
            });
            graph.start = null;
        }

        return graph;
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
        var nodeCount;

        if (!editor || !isFlowViewVisible()) {
            return false;
        }

        container = $canvas[0];
        viewWidth = container.clientWidth;
        viewHeight = container.clientHeight;

        if (viewWidth < 100 || viewHeight < 100) {
            return false;
        }

        padding = typeof padding === 'number' ? padding : 48;
        nodeCount = Object.keys(getHomeData()).length;

        editor.canvas_x = 0;
        editor.canvas_y = 0;
        editor.zoom = 1;
        editor.zoom_last_value = 1;
        applyCanvasTransform();

        bounds = getNodeBounds();

        if (!bounds || !nodeCount) {
            return false;
        }

        contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
        contentHeight = Math.max(bounds.maxY - bounds.minY, 1);

        if (nodeCount > 1 && contentWidth < 40 && contentHeight < 40) {
            return false;
        }

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

    function findStartDrawflowId() {
        var homeData = getHomeData();
        var nodeId;

        for (nodeId in homeData) {
            if (!homeData.hasOwnProperty(nodeId)) {
                continue;
            }

            if (homeData[nodeId].data && homeData[nodeId].data.stepId === '__start__') {
                return nodeId;
            }

            if (homeData[nodeId].class && homeData[nodeId].class.indexOf('msf-flow-node-wrap--start') !== -1) {
                return nodeId;
            }
        }

        return null;
    }

    function centerOnStartNode() {
        var startId;

        if (!editor || !isFlowViewVisible()) {
            return false;
        }

        if ($canvas[0].clientWidth < 100 || $canvas[0].clientHeight < 100) {
            return false;
        }

        startId = findStartDrawflowId();

        if (!startId) {
            return false;
        }

        editor.zoom = 1;
        editor.zoom_last_value = 1;

        return centerOnDrawflowNode(startId);
    }

    function scheduleInitialFlowView() {
        var delays = [0, 60, 150, 300, 500, 800];
        var attempt = 0;

        function runCenter() {
            if (!editor || !isFlowViewVisible() || !initialFlowViewPending) {
                return false;
            }

            if (centerOnStartNode()) {
                initialFlowViewPending = false;
                return true;
            }

            return false;
        }

        function tryUntilCentered() {
            if (runCenter()) {
                return;
            }

            attempt += 1;

            if (attempt < 25) {
                window.setTimeout(tryUntilCentered, 100);
            }
        }

        delays.forEach(function (delay) {
            window.setTimeout(runCenter, delay);
        });

        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                tryUntilCentered();
            });
        });
    }

    function bindFlowCanvasObserver() {
        if (!window.ResizeObserver || flowResizeObserver || !$canvas.length) {
            return;
        }

        flowResizeObserver = new ResizeObserver(function () {
            window.clearTimeout(fitResizeTimer);
            fitResizeTimer = window.setTimeout(function () {
                if (editor && isFlowViewVisible() && initialFlowViewPending) {
                    centerOnStartNode();
                }
            }, 80);
        });

        flowResizeObserver.observe($canvas[0]);
    }

    function zoomFlowBy(delta) {
        if (!editor) {
            return;
        }

        setCanvasZoom(editor.zoom + delta);
    }

    function wheelDeltaToZoomChange(event) {
        var deltaY = event.deltaY;

        if (event.deltaMode === 1) {
            deltaY *= 18;
        } else if (event.deltaMode === 2) {
            deltaY *= 320;
        }

        return Math.max(-0.035, Math.min(0.035, -deltaY * 0.00045));
    }

    function buildRequiredOutputCounts(edges) {
        var counts = {};

        (edges || []).forEach(function (edge) {
            var portNum = parseInt(String(edge.outputPort || 'output_1').replace('output_', ''), 10) || 1;

            if (!counts[edge.from]) {
                counts[edge.from] = 1;
            }

            counts[edge.from] = Math.max(counts[edge.from], portNum);
        });

        return counts;
    }

    function buildRequiredInputCounts(edges) {
        var counts = {};

        (edges || []).forEach(function (edge) {
            if (!edge.to) {
                return;
            }

            counts[edge.to] = (counts[edge.to] || 0) + 1;
        });

        return counts;
    }

    function centerOnDrawflowNode(drawflowId) {
        var el;
        var container;
        var containerRect;
        var nodeRect;
        var deltaX;
        var deltaY;

        if (!editor || !drawflowId) {
            return false;
        }

        el = document.getElementById('node-' + drawflowId);

        if (!el) {
            return false;
        }

        container = $canvas[0];

        if (!container.clientWidth || !container.clientHeight) {
            return false;
        }

        containerRect = container.getBoundingClientRect();
        nodeRect = el.getBoundingClientRect();
        deltaX = (containerRect.left + containerRect.width / 2) - (nodeRect.left + nodeRect.width / 2);
        deltaY = (containerRect.top + containerRect.height / 2) - (nodeRect.top + nodeRect.height / 2);

        editor.canvas_x += deltaX;
        editor.canvas_y += deltaY;
        resetDrawflowDragState();
        applyCanvasTransform();

        return true;
    }

    function centerOnSelectedNode() {
        if (!selectedDrawflowId) {
            window.alert(msfAdmin.i18n.flowSelectNodeCenter || 'Select a step node first.');
            return false;
        }

        return centerOnDrawflowNode(selectedDrawflowId);
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

            if (!editor || !isFlowViewVisible()) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            rect = container.getBoundingClientRect();
            delta = wheelDeltaToZoomChange(event);

            if (!delta) {
                return;
            }

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
            if (!isFlowViewVisible() || event.code !== 'Space' || spacePanHeld || shouldIgnoreCanvasKeys(event.target)) {
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

    function addNodeToCanvas(nodeData, x, y, minOutputs, minInputs) {
        var outputs = Math.max(countOutputs(nodeData), minOutputs || 1);
        var inputs = Math.max(1, minInputs || 1);
        var nodeId = editor.addNode(
            'step',
            inputs,
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
        initialFlowViewPending = true;
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
            bindFlowCanvasObserver();
            bindEditorEvents();

            var graph = steps.length
                ? window.MsfFlowDecompiler.decompileForEditor(steps, msfAdmin.flowLayout || null)
                : { nodes: [], edges: [], warnings: [], start: { x: 40, y: 120 } };

            graph = sanitizeGraphPositions(graph);

            if (window.MsfFlowLayout) {
                graph = window.MsfFlowLayout.apply(graph);
            }

            var requiredOutputCounts = buildRequiredOutputCounts(graph.edges || []);
            var requiredInputCounts = buildRequiredInputCounts(graph.edges || []);
            var nodeMap = {};
            var startId = editor.addNode(
                'start',
                0,
                requiredOutputCounts.__start__ || 1,
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

                var drawflowId = addNodeToCanvas(
                    nodeData,
                    node.x,
                    node.y,
                    requiredOutputCounts[node.stepId] || 1,
                    requiredInputCounts[node.stepId] || 1
                );

                nodeMap[node.stepId] = drawflowId;
            });

            addEdge(nodeMap, graph.edges || []);
            refreshFlowConnections();

            renderWarnings(graph.warnings);

            if (!steps.length) {
                renderWarnings([{ stepId: '', message: msfAdmin.i18n.flowEmptyEditable || 'Use Add question to create your first step, then connect it from Start.' }]);
            }
        } finally {
            isRenderingFlow = false;
            scheduleInitialFlowView();
        }
    }

    function addEdge(nodeMap, edges) {
        var inputPortUsage = {};

        function allocateInputPort(toStepId) {
            if (!inputPortUsage[toStepId]) {
                inputPortUsage[toStepId] = 0;
            }

            inputPortUsage[toStepId] += 1;

            return 'input_' + inputPortUsage[toStepId];
        }

        edges.forEach(function (edge) {
            var fromId = nodeMap[edge.from];
            var toId = nodeMap[edge.to];
            var outputPort = edge.outputPort || 'output_1';
            var inputPort = edge.inputPort || allocateInputPort(edge.to);
            var fromNode;
            var created;

            if (!fromId || !toId) {
                return;
            }

            editor.addConnection(fromId, toId, outputPort, inputPort);

            fromNode = getHomeData()[fromId];

            if (!fromNode || !fromNode.outputs || !fromNode.outputs[outputPort]) {
                return;
            }

            created = fromNode.outputs[outputPort].connections.some(function (conn) {
                return String(conn.node) === String(toId);
            });

            if (!created && window.console && window.console.warn) {
                window.console.warn('MSF flow: could not create connection', edge.from, outputPort, '->', edge.to, inputPort);
            }
        });
    }

    function refreshFlowConnections() {
        if (!editor) {
            return;
        }

        Object.keys(getHomeData()).forEach(function (nodeId) {
            editor.updateConnectionNodes('node-' + nodeId);
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

            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    renderFlow();
                });
            });
            return;
        }

        window.setTimeout(function () {
            if (editor) {
                compileAndSync();
            }
        }, 0);
    }

    function applyInspectorNumberFields(data, newType) {
        if (!data.question) {
            return;
        }

        if (newType === 'number') {
            var minValue = $inspector.find('.msf-flow-inspector-number-min').val();
            var maxValue = $inspector.find('.msf-flow-inspector-number-max').val();
            var placeholderValue = $inspector.find('.msf-flow-inspector-number-placeholder').val();
            var exampleValues = textToNumberExamples($inspector.find('.msf-flow-inspector-number-examples').val());

            data.question.validation = {
                min: minValue === '' ? null : parseFloat(minValue),
                max: maxValue === '' ? null : parseFloat(maxValue)
            };

            if (placeholderValue) {
                data.question.placeholder = placeholderValue;
            } else {
                delete data.question.placeholder;
            }

            if (exampleValues.length) {
                data.question.numberExamples = exampleValues;
            } else {
                delete data.question.numberExamples;
            }

            $inspector.find('.msf-flow-inspector-number-wrap').show();
            return;
        }

        $inspector.find('.msf-flow-inspector-number-wrap').hide();
    }

    $inspector.on('input change', '.msf-flow-inspector-title, .msf-flow-inspector-label, .msf-flow-inspector-type, .msf-flow-inspector-required, .msf-flow-inspector-options, .msf-flow-inspector-number-min, .msf-flow-inspector-number-max, .msf-flow-inspector-number-placeholder, .msf-flow-inspector-number-examples', function () {
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

            applyInspectorNumberFields(data, newType);
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

    $inspector.on('click', '.msf-flow-center-node', function (event) {
        event.preventDefault();
        centerOnSelectedNode();
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

    $('#msf-flow-center-node').on('click', function (event) {
        event.preventDefault();
        centerOnSelectedNode();
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
