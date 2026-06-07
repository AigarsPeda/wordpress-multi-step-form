(function (window) {
    'use strict';

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

    function outputPortToCondition(parentData, outputPort) {
        var portNum;
        var optIndex;
        var question;

        if (!parentData || outputPort === 'output_1') {
            return null;
        }

        portNum = parseInt(String(outputPort).replace('output_', ''), 10);

        if (!portNum || portNum < 2) {
            return null;
        }

        question = parentData.question;

        if (!question || !question.options) {
            return null;
        }

        optIndex = portNum - 2;

        if (!question.options[optIndex]) {
            return null;
        }

        return {
            questionId: question.id,
            operator: 'equals',
            value: question.options[optIndex].value
        };
    }

    function getNodeData(node) {
        return node && node.data ? node.data : {};
    }

    function isStartNode(node) {
        return node && node.class && node.class.indexOf('msf-flow-node-wrap--start') !== -1;
    }

    function isStepNode(node) {
        return node && node.class && node.class.indexOf('msf-flow-node-wrap--') !== -1 && !isStartNode(node);
    }

    function findStartNodeId(homeData) {
        var id;

        for (id in homeData) {
            if (isStartNode(homeData[id])) {
                return id;
            }
        }

        return null;
    }

    function getConnectionsFrom(homeData, nodeId) {
        var node = homeData[nodeId];
        var connections = [];
        var outputName;
        var output;
        var conn;
        var targetId;

        if (!node || !node.outputs) {
            return connections;
        }

        for (outputName in node.outputs) {
            if (!node.outputs.hasOwnProperty(outputName)) {
                continue;
            }

            output = node.outputs[outputName];

            if (!output || !output.connections) {
                continue;
            }

            output.connections.forEach(function (item) {
                connections.push({
                    from: String(nodeId),
                    to: String(item.node),
                    output: outputName,
                    input: item.input || 'input_1'
                });
            });
        }

        return connections;
    }

    function getAllConnections(homeData) {
        var connections = [];
        var id;

        for (id in homeData) {
            if (!homeData.hasOwnProperty(id)) {
                continue;
            }

            connections = connections.concat(getConnectionsFrom(homeData, id));
        }

        return connections;
    }

    function getIncomingConnections(connections, nodeId) {
        return connections.filter(function (conn) {
            return conn.to === String(nodeId);
        });
    }

    function topologicalOrder(homeData, startNodeId) {
        var ordered = [];
        var depths = {};
        var queue = [];
        var connections = getAllConnections(homeData);
        var firstStepId = null;
        var startConnections;
        var id;
        var conn;
        var i;

        startConnections = getConnectionsFrom(homeData, startNodeId);

        if (startConnections.length) {
            firstStepId = startConnections[0].to;
            depths[firstStepId] = 0;
            queue.push(firstStepId);
        }

        while (queue.length) {
            var current = queue.shift();
            var currentDepth = depths[current];

            ordered.push(current);

            connections.forEach(function (edge) {
                if (edge.from !== current) {
                    return;
                }

                var nextDepth = currentDepth + 1;

                if (depths[edge.to] === undefined || depths[edge.to] > nextDepth) {
                    depths[edge.to] = nextDepth;
                    queue.push(edge.to);
                }
            });
        }

        for (id in homeData) {
            if (!homeData.hasOwnProperty(id) || isStartNode(homeData[id]) || !isStepNode(homeData[id])) {
                continue;
            }

            if (depths[id] === undefined) {
                depths[id] = 1000 + ordered.length;
                ordered.push(id);
            }
        }

        ordered.sort(function (a, b) {
            var depthDiff = depths[a] - depths[b];

            if (depthDiff !== 0) {
                return depthDiff;
            }

            var ay = homeData[a] ? homeData[a].pos_y : 0;
            var by = homeData[b] ? homeData[b].pos_y : 0;

            return ay - by;
        });

        return {
            order: ordered,
            firstStepId: firstStepId
        };
    }

    function buildStepFromNodeData(data, index) {
        var step = {
            id: data.stepId || ('step_' + (index + 1)),
            type: data.stepType || 'question',
            title: data.title || '',
            description: data.description || '',
            visibility: data.visibility ? JSON.parse(JSON.stringify(data.visibility)) : { mode: 'always' },
            questions: []
        };

        if (data.interval) {
            step.interval = data.interval;
        }

        if (data.stepType === 'summary') {
            return step;
        }

        if (data.question) {
            step.questions = [JSON.parse(JSON.stringify(data.question))];
        } else {
            step.questions = [{
                id: 'q_' + (index + 1),
                type: 'text',
                label: data.title || '',
                required: true,
                options: []
            }];
        }

        return step;
    }

    function compileDrawflow(exportData) {
        var homeData = exportData && exportData.drawflow && exportData.drawflow.Home
            ? exportData.drawflow.Home.data
            : {};
        var warnings = [];
        var steps = [];
        var flowLayout = { version: 1, nodes: [] };
        var startNodeId = findStartNodeId(homeData);
        var sortResult;
        var connections;
        var i;
        var dfId;
        var node;
        var data;
        var step;
        var incoming;
        var conditions = [];
        var hasConditionalIncoming = false;
        var hasDefaultIncoming = false;

        if (!startNodeId) {
            return {
                steps: [],
                warnings: [{ stepId: '', message: 'Start node is missing from the flow.' }],
                flowLayout: flowLayout
            };
        }

        sortResult = topologicalOrder(homeData, startNodeId);
        connections = getAllConnections(homeData);

        sortResult.order.forEach(function (nodeId, index) {
            node = homeData[nodeId];

            if (!isStepNode(node)) {
                return;
            }

            data = getNodeData(node);

            if (data.hasAdvancedVisibility && data.visibility && data.visibility.groups) {
                step = buildStepFromNodeData(data, index);
                steps.push(step);
                flowLayout.nodes.push({
                    stepId: step.id,
                    x: node.pos_x,
                    y: node.pos_y
                });
                return;
            }

            step = buildStepFromNodeData(data, index);
            incoming = getIncomingConnections(connections, nodeId);
            conditions = [];
            hasConditionalIncoming = false;
            hasDefaultIncoming = false;

            incoming.forEach(function (edge) {
                var parent = homeData[edge.from];
                var parentData = getNodeData(parent);
                var condition;

                if (isStartNode(parent)) {
                    hasDefaultIncoming = true;
                    return;
                }

                condition = outputPortToCondition(parentData, edge.output);

                if (condition) {
                    hasConditionalIncoming = true;
                    conditions.push(condition);
                } else if (edge.output === 'output_1') {
                    hasDefaultIncoming = true;
                }
            });

            if (nodeId === sortResult.firstStepId) {
                step.visibility = { mode: 'always' };
            } else if (hasConditionalIncoming) {
                step.visibility = {
                    mode: 'conditional',
                    logic: conditions.length > 1 ? 'or' : 'and',
                    conditions: conditions
                };
            } else if (hasDefaultIncoming) {
                step.visibility = { mode: 'always' };
            } else {
                step.visibility = { mode: 'always' };
                warnings.push({
                    stepId: step.id,
                    message: 'No incoming connection found. Step is treated as always visible.'
                });
            }

            if (!step.questions[0].label && step.title) {
                step.questions[0].label = step.title;
            }

            if (!step.questions[0].label) {
                warnings.push({
                    stepId: step.id,
                    message: 'Question label is empty.'
                });
            }

            steps.push(step);
            flowLayout.nodes.push({
                stepId: step.id,
                x: node.pos_x,
                y: node.pos_y
            });
        });

        if (!steps.length) {
            warnings.push({ stepId: '', message: 'No steps in the flow.' });
        }

        return {
            steps: steps,
            warnings: warnings,
            flowLayout: flowLayout
        };
    }

    function countOutputs(data) {
        var question = data.question || {};
        var count = 1;

        if (data.stepType === 'summary') {
            return 0;
        }

        if ((question.type === 'radio' || question.type === 'checkbox') && question.options && question.options.length) {
            count += question.options.length;
        }

        return count;
    }

    window.MsfFlowCompiler = {
        compileDrawflow: compileDrawflow,
        countOutputs: countOutputs,
        outputPortToCondition: outputPortToCondition,
        findOptionIndex: findOptionIndex
    };
}(window));
