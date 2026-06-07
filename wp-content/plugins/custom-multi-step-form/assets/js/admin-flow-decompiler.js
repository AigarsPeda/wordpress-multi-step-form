(function (window) {
    'use strict';

    var SCENARIO_CAP = 128;

    function findOptionIndex(question, value) {
        if (!question || !question.options) {
            return -1;
        }

        var i;

        for (i = 0; i < question.options.length; i++) {
            if (String(question.options[i].value) === String(value)) {
                return i;
            }
        }

        return -1;
    }

    function findStepByQuestionId(steps, questionId) {
        var i;

        for (i = 0; i < steps.length; i++) {
            var question = steps[i].questions && steps[i].questions[0];

            if (question && question.id === questionId) {
                return steps[i];
            }
        }

        return null;
    }

    function formatCondition(cond) {
        var operator = cond.operator || 'equals';
        var value = cond.value !== undefined && cond.value !== null ? String(cond.value) : '';

        return (cond.questionId || '?') + ' ' + operator + ' ' + value;
    }

    function summarizeVisibility(step) {
        var visibility = step.visibility || { mode: 'always' };
        var lines = [];

        if (visibility.mode === 'always') {
            return lines;
        }

        if (visibility.mode === 'never') {
            lines.push('hidden');
            return lines;
        }

        if (visibility.groups && visibility.groups.length) {
            lines.push('advanced visibility rules');
            return lines;
        }

        (visibility.conditions || []).forEach(function (cond) {
            lines.push(formatCondition(cond));
        });

        return lines;
    }

    function edgeKey(edge) {
        return edge.from + '->' + edge.to + ':' + (edge.label || '');
    }

    function addEdge(edges, seen, edge) {
        var key = edgeKey(edge);

        if (seen[key]) {
            return;
        }

        seen[key] = true;
        edges.push(edge);
    }

    function evaluateCondition(condition, answers) {
        var questionId = condition.questionId || '';
        var operator = condition.operator || 'equals';
        var expected = condition.value;
        var actual = questionId !== '' && answers[questionId] !== undefined ? answers[questionId] : null;

        switch (operator) {
            case 'notEquals':
                return String(actual) !== String(expected);
            case 'greaterThan':
                return parseFloat(actual) > parseFloat(expected);
            case 'lessThan':
                return parseFloat(actual) < parseFloat(expected);
            case 'greaterOrEqual':
                return parseFloat(actual) >= parseFloat(expected);
            case 'lessOrEqual':
                return parseFloat(actual) <= parseFloat(expected);
            case 'contains':
                if (Array.isArray(actual)) {
                    return actual.indexOf(expected) !== -1;
                }
                return String(actual).indexOf(String(expected)) !== -1;
            case 'notContains':
                if (Array.isArray(actual)) {
                    return actual.indexOf(expected) === -1;
                }
                return String(actual).indexOf(String(expected)) === -1;
            case 'isEmpty':
                return actual === null || actual === '' || (Array.isArray(actual) && !actual.length);
            case 'isNotEmpty':
                return !(actual === null || actual === '' || (Array.isArray(actual) && !actual.length));
            case 'equals':
            default:
                if (Array.isArray(actual)) {
                    return actual.indexOf(expected) !== -1;
                }
                return String(actual) === String(expected);
        }
    }

    function evaluateGroup(group, answers) {
        var logic = group.logic === 'or' ? 'or' : 'and';
        var conditions = group.conditions || [];
        var groups = group.groups || [];
        var results = [];
        var i;

        for (i = 0; i < conditions.length; i++) {
            results.push(evaluateCondition(conditions[i], answers));
        }

        for (i = 0; i < groups.length; i++) {
            results.push(evaluateGroup(groups[i], answers));
        }

        if (!results.length) {
            return true;
        }

        if (logic === 'or') {
            for (i = 0; i < results.length; i++) {
                if (results[i]) {
                    return true;
                }
            }

            return false;
        }

        for (i = 0; i < results.length; i++) {
            if (!results[i]) {
                return false;
            }
        }

        return true;
    }

    function isStepVisible(step, answers) {
        var visibility = step.visibility || { mode: 'always' };

        if (visibility.mode === 'never') {
            return false;
        }

        if (visibility.mode !== 'conditional') {
            return true;
        }

        return evaluateGroup(visibility, answers);
    }

    function getVisibleSteps(steps, answers) {
        return steps.filter(function (step) {
            return isStepVisible(step, answers);
        });
    }

    function getQuestionById(steps, questionId) {
        var i;
        var question;

        for (i = 0; i < steps.length; i++) {
            question = steps[i].questions && steps[i].questions[0];

            if (question && question.id === questionId) {
                return question;
            }
        }

        return null;
    }

    function collectVisibilityQuestionIds(steps) {
        var ids = [];
        var seen = {};

        function addId(questionId) {
            if (!questionId || seen[questionId]) {
                return;
            }

            seen[questionId] = true;
            ids.push(questionId);
        }

        function visitConditions(conditions) {
            (conditions || []).forEach(function (cond) {
                addId(cond.questionId);
            });
        }

        function visitGroup(group) {
            visitConditions(group.conditions);
            (group.groups || []).forEach(visitGroup);
        }

        function visitVisibility(visibility) {
            if (!visibility || visibility.mode !== 'conditional') {
                return;
            }

            visitConditions(visibility.conditions);
            (visibility.groups || []).forEach(visitGroup);
        }

        steps.forEach(function (step) {
            visitVisibility(step.visibility || {});
        });

        return ids;
    }

    function collectNumericScenarioValues(steps, questionId) {
        var values = ['__msf_unset__', '1', '50', '150'];
        var seen = { __msf_unset__: true, '1': true, '50': true, '150': true };

        function addValue(value) {
            var key = String(value);

            if (seen[key]) {
                return;
            }

            seen[key] = true;
            values.push(key);
        }

        function visitConditions(conditions) {
            (conditions || []).forEach(function (cond) {
                var threshold;

                if (cond.questionId !== questionId) {
                    return;
                }

                if (['greaterThan', 'lessThan', 'greaterOrEqual', 'lessOrEqual'].indexOf(cond.operator) === -1) {
                    return;
                }

                threshold = parseFloat(cond.value);

                if (isNaN(threshold)) {
                    return;
                }

                addValue(threshold - 1);
                addValue(threshold);
                addValue(threshold + 1);
            });
        }

        function visitGroup(group) {
            visitConditions(group.conditions);
            (group.groups || []).forEach(visitGroup);
        }

        steps.forEach(function (step) {
            var visibility = step.visibility || {};

            if (visibility.mode !== 'conditional') {
                return;
            }

            visitConditions(visibility.conditions);
            (visibility.groups || []).forEach(visitGroup);
        });

        return values;
    }

    function scenarioValuesForQuestion(steps, questionId) {
        var question = getQuestionById(steps, questionId);
        var values = ['__msf_unset__'];
        var i;

        if (!question) {
            return values;
        }

        if ((question.type === 'radio' || question.type === 'checkbox') && question.options && question.options.length) {
            for (i = 0; i < question.options.length; i++) {
                values.push(question.options[i].value);
            }
            return values;
        }

        if (question.type === 'number') {
            return collectNumericScenarioValues(steps, questionId);
        }

        values.push('__msf_match__', '__msf_other__');
        return values;
    }

    function addTargetedVisibilityScenarios(steps, scenarios) {
        var targeted = [];
        var seen = {};
        var key;
        var patch;

        function rememberScenario(candidate) {
            key = JSON.stringify(candidate);

            if (!Object.keys(candidate).length || seen[key]) {
                return;
            }

            seen[key] = true;
            targeted.push(candidate);
        }

        function visitGroup(group) {
            patch = {};
            (group.conditions || []).forEach(function (cond) {
                if (!cond.questionId) {
                    return;
                }

                if (cond.operator === 'greaterThan' || cond.operator === 'greaterOrEqual') {
                    patch[cond.questionId] = String(parseFloat(cond.value) + 1);
                } else if (cond.operator === 'lessThan' || cond.operator === 'lessOrEqual') {
                    patch[cond.questionId] = String(parseFloat(cond.value) - 1);
                } else if (cond.value !== undefined) {
                    patch[cond.questionId] = cond.value;
                }
            });
            rememberScenario(patch);
            (group.groups || []).forEach(visitGroup);
        }

        steps.forEach(function (step) {
            var visibility = step.visibility || {};

            if (visibility.mode !== 'conditional') {
                return;
            }

            (visibility.conditions || []).forEach(function (cond) {
                patch = {};

                if (cond.questionId && cond.value !== undefined) {
                    patch[cond.questionId] = cond.value;
                }

                rememberScenario(patch);
            });

            (visibility.groups || []).forEach(visitGroup);
        });

        return targeted.concat(scenarios);
    }

    function generateAnswerScenarios(steps) {
        var scenarios = [{}];
        var questionIds = collectVisibilityQuestionIds(steps);
        var q;
        var values;
        var next;
        var base;
        var v;
        var i;

        for (q = 0; q < questionIds.length; q++) {
            values = scenarioValuesForQuestion(steps, questionIds[q]);
            next = [];

            for (i = 0; i < scenarios.length; i++) {
                base = scenarios[i];

                for (v = 0; v < values.length; v++) {
                    if (values[v] === '__msf_unset__') {
                        next.push(Object.assign({}, base));
                        continue;
                    }

                    next.push(Object.assign({}, base, (function () {
                        var patch = {};
                        patch[questionIds[q]] = values[v];
                        return patch;
                    }())));
                }
            }

            scenarios = next;

            if (scenarios.length > SCENARIO_CAP) {
                scenarios = scenarios.slice(0, SCENARIO_CAP);
            }
        }

        scenarios = addTargetedVisibilityScenarios(steps, scenarios.length ? scenarios : [{}]);

        return scenarios;
    }

    function addSequentialFallbackEdges(steps, editableEdges, seen, portUsage) {
        var index;
        var step;
        var next;
        var scan;
        var pathKey;
        var hasOutgoing;

        for (index = 0; index < steps.length; index++) {
            step = steps[index];

            if (!step || step.type === 'summary') {
                continue;
            }

            hasOutgoing = editableEdges.some(function (edge) {
                return edge.from === step.id;
            });

            if (hasOutgoing) {
                continue;
            }

            next = null;

            for (scan = index + 1; scan < steps.length; scan++) {
                if (!steps[scan] || (steps[scan].visibility && steps[scan].visibility.mode === 'never')) {
                    continue;
                }

                next = steps[scan];
                break;
            }

            if (!next) {
                continue;
            }

            pathKey = step.id + '->' + next.id;

            if (seen[pathKey]) {
                continue;
            }

            seen[pathKey] = true;
            editableEdges.push({
                from: step.id,
                to: next.id,
                outputPort: allocateOutputPort(step.id, next.id, steps, portUsage),
                label: 'next'
            });
        }
    }

    function addRuntimePathEdges(steps, edges, seen) {
        var scenarios = generateAnswerScenarios(steps);
        var s;
        var visible;
        var i;

        for (s = 0; s < scenarios.length; s++) {
            visible = getVisibleSteps(steps, scenarios[s]);

            for (i = 0; i < visible.length - 1; i++) {
                addEdge(edges, seen, {
                    from: visible[i].id,
                    to: visible[i + 1].id,
                    label: 'next',
                    kind: 'runtime'
                });
            }
        }
    }

    function decompile(steps, flowLayout) {
        steps = Array.isArray(steps) ? steps : [];
        flowLayout = flowLayout && flowLayout.nodes ? flowLayout : null;

        var nodes = [];
        var edges = [];
        var warnings = [];
        var seen = {};
        var layoutByStep = {};
        var i;

        if (flowLayout && Array.isArray(flowLayout.nodes)) {
            flowLayout.nodes.forEach(function (item) {
                if (item && item.stepId) {
                    layoutByStep[item.stepId] = item;
                }
            });
        }

        steps.forEach(function (step, index) {
            var question = step.questions && step.questions[0];
            var layout = layoutByStep[step.id] || {};
            var visibility = step.visibility || { mode: 'always' };

            nodes.push({
                stepId: step.id,
                index: index,
                type: step.type || 'question',
                title: step.title || '',
                label: question ? (question.label || '') : '',
                questionType: question ? (question.type || 'text') : '',
                visibility: visibility,
                visibilitySummary: summarizeVisibility(step),
                hasAdvancedVisibility: !!(visibility.groups && visibility.groups.length),
                x: typeof layout.x === 'number' ? layout.x : null,
                y: typeof layout.y === 'number' ? layout.y : null
            });
        });

        if (steps.length) {
            addEdge(edges, seen, {
                from: '__start__',
                to: steps[0].id,
                label: '',
                kind: 'start'
            });
        }

        addRuntimePathEdges(steps, edges, seen);

        steps.forEach(function (step, index) {
            var visibility = step.visibility || { mode: 'always' };
            var previous = index > 0 ? steps[index - 1] : null;

            if (visibility.mode === 'never') {
                warnings.push({
                    stepId: step.id,
                    message: 'Step is set to never show.'
                });
                return;
            }

            if (visibility.mode !== 'conditional') {
                return;
            }

            if (visibility.groups && visibility.groups.length) {
                warnings.push({
                    stepId: step.id,
                    message: 'Advanced nested visibility rules are shown as a note on the node.'
                });

                if (previous) {
                    addEdge(edges, seen, {
                        from: previous.id,
                        to: step.id,
                        label: 'advanced rules',
                        kind: 'advanced'
                    });
                }
                return;
            }

            var conditions = visibility.conditions || [];

            if (!conditions.length) {
                return;
            }

            conditions.forEach(function (cond) {
                var sourceStep = findStepByQuestionId(steps, cond.questionId);
                var label = formatCondition(cond);

                if (sourceStep) {
                    addEdge(edges, seen, {
                        from: sourceStep.id,
                        to: step.id,
                        label: label,
                        kind: 'condition',
                        condition: cond
                    });
                } else {
                    warnings.push({
                        stepId: step.id,
                        message: 'Could not find question "' + (cond.questionId || '') + '" for a visibility rule.'
                    });
                }
            });
        });

        return {
            nodes: nodes,
            edges: edges,
            warnings: warnings,
            start: {
                x: 40,
                y: 120
            }
        };
    }

    function countOutputsForStep(step) {
        var question = step && step.questions ? step.questions[0] : null;
        var count = 1;

        if (!step || step.type === 'summary') {
            return 0;
        }

        if (question && (question.type === 'radio' || question.type === 'checkbox') && question.options && question.options.length) {
            count += question.options.length;
        }

        return count;
    }

    function findStepById(steps, stepId) {
        var i;

        for (i = 0; i < steps.length; i++) {
            if (steps[i].id === stepId) {
                return steps[i];
            }
        }

        return null;
    }

    function allocateOutputPort(fromStepId, toStepId, steps, portUsage) {
        var step = findStepById(steps, fromStepId);
        var maxPorts = countOutputsForStep(step);
        var port;
        var p;
        var usedMax = 1;

        if (!portUsage[fromStepId]) {
            portUsage[fromStepId] = {};
        }

        Object.keys(portUsage[fromStepId]).forEach(function (portName) {
            var portNum = parseInt(String(portName).replace('output_', ''), 10);

            if (!isNaN(portNum)) {
                usedMax = Math.max(usedMax, portNum);
            }
        });

        maxPorts = Math.max(maxPorts, usedMax + 1);

        for (p = 1; p <= maxPorts; p++) {
            port = 'output_' + p;

            if (!portUsage[fromStepId][port]) {
                portUsage[fromStepId][port] = toStepId;
                return port;
            }
        }

        port = 'output_' + (maxPorts + 1);
        portUsage[fromStepId][port] = toStepId;

        return port;
    }

    function decompileForEditor(steps, flowLayout) {
        var graph = decompile(steps, flowLayout);
        var editableEdges = [];
        var seen = {};
        var portUsage = {};
        var key;

        graph.edges.forEach(function (edge) {
            if (edge.from === '__start__' || edge.kind === 'start') {
                return;
            }

            if (edge.kind !== 'condition' || !edge.condition) {
                return;
            }

            var sourceStep = findStepByQuestionId(steps, edge.condition.questionId);
            var question = sourceStep && sourceStep.questions ? sourceStep.questions[0] : null;
            var optIndex = findOptionIndex(question, edge.condition.value);
            var port = optIndex >= 0 ? 'output_' + (optIndex + 2) : allocateOutputPort(edge.from, edge.to, steps, portUsage);

            if (!portUsage[edge.from]) {
                portUsage[edge.from] = {};
            }

            if (portUsage[edge.from][port] && portUsage[edge.from][port] !== edge.to) {
                port = allocateOutputPort(edge.from, edge.to, steps, portUsage);
            }

            key = edge.from + '->' + edge.to + ':' + port;

            if (!seen[key]) {
                seen[key] = true;
                portUsage[edge.from][port] = edge.to;
                editableEdges.push({
                    from: edge.from,
                    to: edge.to,
                    outputPort: port,
                    label: edge.label
                });
            }
        });

        graph.edges.forEach(function (edge) {
            var pathKey;
            var port;

            if (edge.from === '__start__' || edge.kind === 'start' || edge.kind === 'condition') {
                return;
            }

            if (edge.kind !== 'runtime' && edge.kind !== 'linear' && edge.kind !== 'advanced') {
                return;
            }

            pathKey = edge.from + '->' + edge.to;

            if (seen[pathKey]) {
                return;
            }

            port = allocateOutputPort(edge.from, edge.to, steps, portUsage);
            key = pathKey + ':' + port;

            if (!seen[key]) {
                seen[pathKey] = true;
                seen[key] = true;
                editableEdges.push({
                    from: edge.from,
                    to: edge.to,
                    outputPort: port,
                    label: edge.label || 'next'
                });
            }
        });

        graph.nodes.forEach(function (node) {
            var fullStep = null;
            var s;

            for (s = 0; s < steps.length; s++) {
                if (steps[s].id === node.stepId) {
                    fullStep = steps[s];
                    break;
                }
            }

            node.step = fullStep;
        });

        addSequentialFallbackEdges(steps, editableEdges, seen, portUsage);

        if (steps.length) {
            key = '__start__->' + steps[0].id + ':output_1';

            if (!seen[key]) {
                editableEdges.unshift({
                    from: '__start__',
                    to: steps[0].id,
                    outputPort: 'output_1',
                    label: ''
                });
            }
        }

        return {
            nodes: graph.nodes,
            edges: editableEdges,
            warnings: graph.warnings,
            start: graph.start
        };
    }

    window.MsfFlowDecompiler = {
        decompile: decompile,
        decompileForEditor: decompileForEditor,
        formatCondition: formatCondition,
        findOptionIndex: findOptionIndex
    };
}(window));
