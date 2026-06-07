(function ($) {
    'use strict';

    var $flowView = $('#msf-steps-flow-view');
    var $listView = $('#msf-steps-list-view');
    var $canvas = $('#msf-flow-canvas');
    var $warnings = $('#msf-flow-warnings');
    var editor = null;

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

    function typeLabel(type) {
        var types = (msfAdmin.i18n && msfAdmin.i18n.types) || {};

        return types[type] || type || '';
    }

    function buildStartHtml() {
        return ''
            + '<div class="msf-flow-node">'
            + '<div class="msf-flow-node__badge">Start</div>'
            + '<strong class="msf-flow-node__title">' + escapeHtml(msfAdmin.i18n.flowStart || 'Start') + '</strong>'
            + '<div class="msf-flow-node__meta">' + escapeHtml(msfAdmin.i18n.flowStartHelp || 'Form begins here') + '</div>'
            + '</div>';
    }

    function buildStepHtml(node) {
        var title = node.title || node.label || node.stepId;
        var meta = [];

        if (node.type === 'summary') {
            meta.push(msfAdmin.i18n.stepTypeSummary || 'Summary');
        } else if (node.questionType) {
            meta.push(typeLabel(node.questionType));
        }

        meta.push(node.stepId);

        var html = ''
            + '<div class="msf-flow-node">'
            + '<div class="msf-flow-node__badge">' + escapeHtml(String(node.index + 1)) + '</div>'
            + '<strong class="msf-flow-node__title">' + escapeHtml(title) + '</strong>';

        if (node.label && node.title && node.label !== node.title) {
            html += '<div class="msf-flow-node__label">' + escapeHtml(node.label) + '</div>';
        }

        html += '<div class="msf-flow-node__meta">' + escapeHtml(meta.join(' · ')) + '</div>';

        if (node.hasAdvancedVisibility) {
            html += '<div class="msf-flow-node__cond msf-flow-node__cond--advanced">' + escapeHtml(msfAdmin.i18n.flowAdvancedVisibility || 'Advanced visibility rules') + '</div>';
        } else if (node.visibilitySummary && node.visibilitySummary.length) {
            html += '<div class="msf-flow-node__cond">' + escapeHtml(msfAdmin.i18n.flowShowsWhen || 'Shows when') + ': ' + escapeHtml(node.visibilitySummary.join(' OR ')) + '</div>';
        } else if ((node.visibility || {}).mode === 'always') {
            html += '<div class="msf-flow-node__cond msf-flow-node__cond--always">' + escapeHtml(msfAdmin.i18n.flowAlways || 'Always shown') + '</div>';
        }

        html += '</div>';

        return html;
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

    function renderEmptyState() {
        $canvas.html('<p class="msf-flow-empty">' + escapeHtml(msfAdmin.i18n.flowEmpty || 'Add steps in List view to see the flow diagram.') + '</p>');
        $warnings.hide().empty();
    }

    function renderFlow() {
        if (typeof Drawflow === 'undefined' || typeof window.MsfFlowDecompiler === 'undefined') {
            return;
        }

        var steps = getSteps();

        if (!steps.length) {
            renderEmptyState();
            return;
        }

        $canvas.empty();
        $warnings.hide().empty();

        editor = new Drawflow($canvas[0]);
        editor.reroute = true;
        editor.reroute_fix_curvature = true;
        editor.editor_mode = 'fixed';
        editor.start();

        var graph = window.MsfFlowDecompiler.decompile(steps, msfAdmin.flowLayout || null);

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
            {},
            buildStartHtml()
        );

        nodeMap.__start__ = startId;

        graph.nodes.forEach(function (node) {
            var outputs = node.type === 'summary' ? 0 : 1;
            var nodeId = editor.addNode(
                'step',
                1,
                outputs,
                node.x,
                node.y,
                'msf-flow-node-wrap msf-flow-node-wrap--' + (node.type || 'question'),
                { stepId: node.stepId },
                buildStepHtml(node)
            );

            nodeMap[node.stepId] = nodeId;
        });

        graph.edges.forEach(function (edge) {
            var fromId = nodeMap[edge.from];
            var toId = nodeMap[edge.to];

            if (!fromId || !toId) {
                return;
            }

            editor.addConnection(fromId, toId, 'output_1', 'input_1');
        });

        renderWarnings(graph.warnings);
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
        }
    }

    $('.msf-builder-tab').on('click', function (event) {
        event.preventDefault();
        setActiveView($(this).data('msfBuilderView') || 'list');
    });

    window.msfFlowRender = renderFlow;
}(jQuery));
