(function (window) {
    'use strict';

    var SCENARIO_CAP = 48;

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

    function collectBranchQuestionIds(steps) {
        var ids = [];
        var seen = {};

        steps.forEach(function (step) {
            var visibility = step.visibility || {};

            if (visibility.mode !== 'conditional' || (visibility.groups && visibility.groups.length)) {
                return;
            }

            (visibility.conditions || []).forEach(function (cond) {
                if (!cond.questionId || seen[cond.questionId]) {
                    return;
                }

                seen[cond.questionId] = true;
                ids.push(cond.questionId);
            });
        });

        return ids;
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

        values.push('__msf_match__', '__msf_other__');
        return values;
    }

    function generateAnswerScenarios(steps) {
        var scenarios = [{}];
        var questionIds = collectBranchQuestionIds(steps);
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

        return scenarios.length ? scenarios : [{}];
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

    window.MsfFlowDecompiler = {
        decompile: decompile,
        formatCondition: formatCondition
    };
}(window));
