import { secondsToString } from "./utilities.module.js";
import { areThereAnyNewOrMissingHashes, updateLastHashes } from './hash_checks.module.js';
export function create_directed_graph(yukon_state) {
    cytoscape.use(cytoscapeKlay);
    let my_graph = cytoscape({
        wheelSensitivity: 0.2,
        container: document.getElementById('cy'), // container to render in
        // so we can see the ids
        style: [
            {
                selector: 'node',
                style: {
                    'text-wrap': 'wrap',
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'width': '250px',
                    'height': '65px',
                    'background-color': '#e00000',
                    'shape': 'cut-rectangle',
                }
            },
            {
                selector: 'edge',
                style:
                {
                    width: 2,
                    targetArrowShape: 'triangle',
                    curveStyle: 'bezier',
                    // 'label': 'data(label)' // maps to data.label
                }
            },
            {
                selector: 'node[?publish_subject]',
                style: {
                    'background-color': '#A6E1FA',
                    'width': '70px',
                    'height': '70px',
                    'shape': 'square'
                }
            },
            {
                selector: 'node[?serve_subject]',
                style: {
                    'background-color': '#0A2472',
                    'color': '#A6E1FA',
                    'width': '70px',
                    'height': '70px',
                    'shape': 'barrel'
                }
            },
            {
                selector: 'edge[?publish_edge]',
                style: {
                    'line-color': '#A6E1FA',
                }
            },
            {
                selector: 'edge[?serve_edge]',
                style: {
                    'line-color': '#0A2472',
                }
            }
        ]

    });

    my_graph.on('mouseover', 'node', function (evt) {
        var node = evt.target;
        console.log("Mouseover on node " + node.id());
        // Find the avatar for the node
        var avatar = yukon_state.current_avatars.find(function (avatar) {
            return avatar.node_id == node.id();
        });
        if (avatar) {
            // Create a label with the avatar's name
            const assembled_text = avatar.name + " (" + avatar.node_id + ")" + "<br>" + secondsToString(avatar.last_heartbeat.uptime) + "<br>" + avatar.last_heartbeat.health_text + " (" + avatar.last_heartbeat.health + ")";
            createMonitorPopup(assembled_text, yukon_state);
        }
    });
    my_graph.on('mouseout', 'node', function (evt) {
        var node = evt.target;
        console.log("Mouseout on node " + node.id());
        // Remove the current monitor popup
        var cy = document.getElementById('cy');
        // Remove all label elements in the div cy
        var labels = cy.getElementsByTagName('div');
        for (var i = 0; i < labels.length; i++) {
            // Check if className of the element is 'label'
            if (labels[i].className == 'label') {
                // Remove the element
                labels[i].parentNode.removeChild(labels[i]);
            }
        }
    });
    return my_graph
}
function createMonitorPopup(text, yukon_state) {
    var cy = document.getElementById('cy');
    // Remove all label elements in the div cy
    var labels = cy.getElementsByTagName('div');
    for (var i = 0; i < labels.length; i++) {
        // Check if className of the element is 'label'
        if (labels[i].className == 'label') {
            // Remove the element
            labels[i].parentNode.removeChild(labels[i]);
        }
    }
    // Create a sticky div in cy to display a label with text
    var label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = text;
    cy.appendChild(label);
    // Make the label stick to the top of the cy
    label.style.position = 'absolute';
    label.style.top = '0px';
    label.style.left = '30%';
    label.style.minHeight = '90px';
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    label.style.color = 'white';
    label.style.textAlign = 'left';
    label.style.fontSize = '20px';
    label.style.fontWeight = 'bold';
    label.style.paddingTop = '20px';
    label.style.paddingBottom = '20px';
    label.style.paddingLeft = '20px';
    label.style.paddingRight = '20px';
    label.style.zIndex = '1';
    label.style.pointerEvents = 'none';
    // Remove the label after 3 seconds
    setTimeout(function () {
        if (label && label.parentNode) {
            label.parentNode.removeChild(label);
        }
    }, 3000);
}
function getDrawingAspectRatio() {
    var cy = document.getElementById('cy');
    var cy_width = cy.clientWidth;
    var cy_height = cy.clientHeight;
    return cy_width / cy_height;
}
export function refresh_graph_layout(my_graph) {
    if (typeof my_graph == "undefined") {
        return;
    }
    var layout = my_graph.layout(
        {
            name: 'klay',
            klay: {
                // Following descriptions taken from http://layout.rtsys.informatik.uni-kiel.de:9444/Providedlayout.html?algorithm=de.cau.cs.kieler.klay.layered
                addUnnecessaryBendpoints: true, // Adds bend points even if an edge does not change direction.
                aspectRatio: getDrawingAspectRatio(), // The aimed aspect ratio of the drawing, that is the quotient of width by height
                borderSpacing: 20, // Minimal amount of space to be left to the border
                compactComponents: false, // Tries to further compact components (disconnected sub-graphs).
                crossingMinimization: 'LAYER_SWEEP', // Strategy for crossing minimization.
                /* LAYER_SWEEP The layer sweep algorithm iterates multiple times over the layers, trying to find node orderings that minimize the number of crossings. The algorithm uses randomization to increase the odds of finding a good result. To improve its results, consider increasing the Thoroughness option, which influences the number of iterations done. The Randomization seed also influences results.
                INTERACTIVE Orders the nodes of each layer by comparing their positions before the layout algorithm was started. The idea is that the relative order of nodes as it was before layout was applied is not changed. This of course requires valid positions for all nodes to have been set on the input graph before calling the layout algorithm. The interactive layer sweep algorithm uses the Interactive Reference Point option to determine which reference point of nodes are used to compare positions. */
                cycleBreaking: 'GREEDY', // Strategy for cycle breaking. Cycle breaking looks for cycles in the graph and determines which edges to reverse to break the cycles. Reversed edges will end up pointing to the opposite direction of regular edges (that is, reversed edges will point left if edges usually point right).
                /* GREEDY This algorithm reverses edges greedily. The algorithm tries to avoid edges that have the Priority property set.
                INTERACTIVE The interactive algorithm tries to reverse edges that already pointed leftwards in the input graph. This requires node and port coordinates to have been set to sensible values.*/
                direction: 'RIGHT', // Overall direction of edges: horizontal (right / left) or vertical (down / up)
                /* UNDEFINED, RIGHT, LEFT, DOWN, UP */
                edgeRouting: 'SPLINES', // Defines how edges are routed (POLYLINE, ORTHOGONAL, SPLINES)
                edgeSpacingFactor: 0.5, // Factor by which the object spacing is multiplied to arrive at the minimal spacing between edges.
                feedbackEdges: false, // Whether feedback edges should be highlighted by routing around the nodes.
                fixedAlignment: 'NONE', // Tells the BK node placer to use a certain alignment instead of taking the optimal result.  This option should usually be left alone.
                /* NONE Chooses the smallest layout from the four possible candidates.
                LEFTUP Chooses the left-up candidate from the four possible candidates.
                RIGHTUP Chooses the right-up candidate from the four possible candidates.
                LEFTDOWN Chooses the left-down candidate from the four possible candidates.
                RIGHTDOWN Chooses the right-down candidate from the four possible candidates.
                BALANCED Creates a balanced layout from the four possible candidates. */
                inLayerSpacingFactor: 1.0, // Factor by which the usual spacing is multiplied to determine the in-layer spacing between objects.
                layoutHierarchy: true, // Whether the selected layouter should consider the full hierarchy
                linearSegmentsDeflectionDampening: 0.3, // Dampens the movement of nodes to keep the diagram from getting too large.
                mergeEdges: false, // Edges that have no ports are merged so they touch the connected nodes at the same points.
                mergeHierarchyCrossingEdges: true, // If hierarchical layout is active, hierarchy-crossing edges use as few hierarchical ports as possible.
                nodeLayering: 'LONGEST_PATH', // Strategy for node layering.
                /* NETWORK_SIMPLEX This algorithm tries to minimize the length of edges. This is the most computationally intensive algorithm. The number of iterations after which it aborts if it hasn't found a result yet can be set with the Maximal Iterations option.
                LONGEST_PATH A very simple algorithm that distributes nodes along their longest path to a sink node.
                INTERACTIVE Distributes the nodes into layers by comparing their positions before the layout algorithm was started. The idea is that the relative horizontal order of nodes as it was before layout was applied is not changed. This of course requires valid positions for all nodes to have been set on the input graph before calling the layout algorithm. The interactive node layering algorithm uses the Interactive Reference Point option to determine which reference point of nodes are used to compare positions. */
                nodePlacement: 'BRANDES_KOEPF', // Strategy for Node Placement
                /* BRANDES_KOEPF Minimizes the number of edge bends at the expense of diagram size: diagrams drawn with this algorithm are usually higher than diagrams drawn with other algorithms.
                LINEAR_SEGMENTS Computes a balanced placement.
                INTERACTIVE Tries to keep the preset y coordinates of nodes from the original layout. For dummy nodes, a guess is made to infer their coordinates. Requires the other interactive phase implementations to have run as well.
                SIMPLE Minimizes the area at the expense of... well, pretty much everything else. */
                randomizationSeed: 1, // Seed used for pseudo-random number generators to control the layout algorithm; 0 means a new seed is generated
                routeSelfLoopInside: false, // Whether a self-loop is routed around or inside its node.
                separateConnectedComponents: true, // Whether each connected component should be processed separately
                spacing: 50, // Overall setting for the minimal amount of space to be left between objects
                thoroughness: 10 // How much effort should be spent to produce a nice layout..
            },
        }
    );
    layout.run();
}
export function update_directed_graph(yukon_state) {
    let my_graph = yukon_state.my_graph;
    if (typeof my_graph == "undefined") { return; }
    if (!areThereAnyNewOrMissingHashes("monitor_view_hash", yukon_state)) {
        updateLastHashes("monitor_view_hash", yukon_state);
        // If there are any elements in my_graph.elements() then we can return, otherwise we need to make a graph (below)
        if (my_graph.elements().length > 0) {
            return;
        }
    }
    updateLastHashes("monitor_view_hash", yukon_state);
    my_graph.elements().remove();
    let available_publishers = {};
    let available_servers = {};
    for (const avatar of yukon_state.current_avatars) {
        console.log(avatar);
        my_graph.add([{ data: { id: avatar.node_id, label: avatar.node_id + "\n" + avatar.name } }]);
        if (!avatar.ports) { continue; }
        // Add a node for each pub and connect, then connect avatar to every pub node
        for (const pub of avatar.ports.pub) {
            my_graph.add([{ data: { id: pub, "publish_subject": true, label: pub + "\nsubject" } }])
            available_publishers[pub] = true;
            my_graph.add([{ data: { source: avatar.node_id, target: pub, "publish_edge": true } }]);
        }
        // clients should point to servers
        // client node --> [port] --> server node
        // publisher node --> [port] --> subscriber node
        for (const srv of avatar.ports.srv) {
            my_graph.add([{ data: { id: srv, serve_subject: true, label: srv + "\nservice" } }])
            my_graph.add([{ data: { source: srv, target: avatar.node_id, label: "A nice label", "serve_edge": true } }])
        }

    }
    for (const avatar of yukon_state.current_avatars) {
        for (const sub of avatar.ports.sub) {
            if (available_publishers[sub]) {
                my_graph.add([{ data: { source: sub, target: avatar.node_id, label: "A nice label" } }]);
            }
        }
        for (const cln of avatar.ports.cln) {
            if (available_servers[cln]) {
                my_graph.add([{ data: { source: avatar.node_id, target: cln, label: "A nice label" } }]);
            }
        }
    }
    refresh_graph_layout(my_graph);
}