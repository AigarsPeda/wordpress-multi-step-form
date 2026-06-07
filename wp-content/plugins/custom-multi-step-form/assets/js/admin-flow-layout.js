(function (window) {
    'use strict';

    var NODE_WIDTH = 260;
    var NODE_HEIGHT = 150;
    var GAP_X = 120;
    var GAP_Y = 100;
    var START_X = 40;
    var START_WIDTH = 220;
    var ORIGIN_Y = 40;

    function columnX(depth) {
        return START_X + START_WIDTH + GAP_X + (depth - 1) * (NODE_WIDTH + GAP_X);
    }

    function hasPosition(node) {
        return typeof node.x === 'number' && typeof node.y === 'number';
    }

    function computeDepths(graph) {
        var depths = {};
        var maxDepth = 0;
        var queue = [];
        var outgoing = {};
        var nodeIds = {};
        var edge;
        var i;

        graph.nodes.forEach(function (node) {
            nodeIds[node.stepId] = true;
        });

        for (i = 0; i < graph.edges.length; i++) {
            edge = graph.edges[i];

            if (edge.from === '__start__') {
                if (!depths[edge.to] || depths[edge.to] > 1) {
                    depths[edge.to] = 1;
                }
                queue.push({ id: edge.to, depth: 1 });
                continue;
            }

            if (!outgoing[edge.from]) {
                outgoing[edge.from] = [];
            }

            outgoing[edge.from].push(edge.to);
        }

        while (queue.length) {
            var current = queue.shift();
            var targets = outgoing[current.id] || [];
            var targetDepth = current.depth + 1;
            var t;

            for (t = 0; t < targets.length; t++) {
                if (!depths[targets[t]] || depths[targets[t]] > targetDepth) {
                    depths[targets[t]] = targetDepth;
                    queue.push({ id: targets[t], depth: targetDepth });
                }
            }
        }

        graph.nodes.forEach(function (node, index) {
            if (depths[node.stepId] === undefined) {
                depths[node.stepId] = index + 1;
            }

            if (depths[node.stepId] > maxDepth) {
                maxDepth = depths[node.stepId];
            }
        });

        return depths;
    }

    function findFirstStepNode(graph) {
        var firstNode = null;
        var edge;
        var i;

        for (i = 0; i < (graph.edges || []).length; i++) {
            edge = graph.edges[i];

            if (edge.from !== '__start__') {
                continue;
            }

            graph.nodes.forEach(function (node) {
                if (node.stepId === edge.to) {
                    firstNode = node;
                }
            });
        }

        if (!firstNode && graph.nodes.length) {
            firstNode = graph.nodes.slice().sort(function (a, b) {
                return (a.index || 0) - (b.index || 0);
            })[0];
        }

        return firstNode;
    }

    function positionStartNode(graph) {
        var firstNode = findFirstStepNode(graph);
        var minFirstX = columnX(1);

        if (!firstNode) {
            graph.start = graph.start || { x: START_X, y: ORIGIN_Y };
            return graph;
        }

        if (hasPosition(firstNode) && firstNode.x < minFirstX) {
            graph.nodes.forEach(function (node) {
                if (hasPosition(node)) {
                    node.x += minFirstX - firstNode.x;
                }
            });
        }

        graph.start = {
            x: START_X,
            y: hasPosition(firstNode) ? firstNode.y : ORIGIN_Y
        };

        return graph;
    }

    function apply(graph) {
        if (!graph || !Array.isArray(graph.nodes)) {
            return graph;
        }

        var allPositioned = graph.nodes.every(hasPosition);

        if (allPositioned) {
            return positionStartNode(graph);
        }

        var depths = computeDepths(graph);
        var layers = {};
        var depth;
        var layer;
        var index;

        graph.nodes.forEach(function (node) {
            depth = depths[node.stepId] || (node.index + 1);

            if (!layers[depth]) {
                layers[depth] = [];
            }

            layers[depth].push(node);
        });

        Object.keys(layers).sort(function (a, b) {
            return parseInt(a, 10) - parseInt(b, 10);
        }).forEach(function (depthKey) {
            layer = layers[depthKey];

            layer.sort(function (a, b) {
                return a.index - b.index;
            });

            layer.forEach(function (node, layerIndex) {
                if (!hasPosition(node)) {
                    node.x = columnX(parseInt(depthKey, 10));
                    node.y = ORIGIN_Y + layerIndex * (NODE_HEIGHT + GAP_Y);
                }
            });
        });

        return positionStartNode(graph);
    }

    window.MsfFlowLayout = {
        apply: apply
    };
}(window));
