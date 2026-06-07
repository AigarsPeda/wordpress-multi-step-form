(function (window) {
    'use strict';

    var NODE_WIDTH = 260;
    var NODE_HEIGHT = 110;
    var GAP_X = 120;
    var GAP_Y = 90;
    var ORIGIN_X = 180;
    var ORIGIN_Y = 40;

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

    function apply(graph) {
        if (!graph || !Array.isArray(graph.nodes)) {
            return graph;
        }

        var allPositioned = graph.nodes.every(hasPosition);

        if (allPositioned) {
            if (!graph.start) {
                graph.start = { x: 40, y: 120 };
            }
            return graph;
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
                    node.x = ORIGIN_X + (parseInt(depthKey, 10) - 1) * (NODE_WIDTH + GAP_X);
                    node.y = ORIGIN_Y + layerIndex * (NODE_HEIGHT + GAP_Y);
                }
            });
        });

        if (!graph.start) {
            var startLayerSize = (layers[1] || []).length;
            graph.start = {
                x: 40,
                y: ORIGIN_Y + Math.max(0, Math.floor(startLayerSize / 2)) * (NODE_HEIGHT + GAP_Y)
            };
        }

        return graph;
    }

    window.MsfFlowLayout = {
        apply: apply
    };
}(window));
