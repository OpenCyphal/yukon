try {
    // Make a callback on the page load event
    window.addEventListener('pywebviewready', function () {
        var current_avatars = [];
        var last_hashes = []
        var my_graph = null;
        function create_directed_graph() {
            cytoscape.use(cytoscapeKlay);
            my_graph = cytoscape({
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
            });
        }
        function refresh_graph_layout() {
            var layout = my_graph.layout(
                {
                    name: 'klay',
                    klay: {
                        // Following descriptions taken from http://layout.rtsys.informatik.uni-kiel.de:9444/Providedlayout.html?algorithm=de.cau.cs.kieler.klay.layered
                        addUnnecessaryBendpoints: false, // Adds bend points even if an edge does not change direction.
                        aspectRatio: 1.6, // The aimed aspect ratio of the drawing, that is the quotient of width by height
                        borderSpacing: 20, // Minimal amount of space to be left to the border
                        compactComponents: false, // Tries to further compact components (disconnected sub-graphs).
                        crossingMinimization: 'LAYER_SWEEP', // Strategy for crossing minimization.
                        /* LAYER_SWEEP The layer sweep algorithm iterates multiple times over the layers, trying to find node orderings that minimize the number of crossings. The algorithm uses randomization to increase the odds of finding a good result. To improve its results, consider increasing the Thoroughness option, which influences the number of iterations done. The Randomization seed also influences results.
                        INTERACTIVE Orders the nodes of each layer by comparing their positions before the layout algorithm was started. The idea is that the relative order of nodes as it was before layout was applied is not changed. This of course requires valid positions for all nodes to have been set on the input graph before calling the layout algorithm. The interactive layer sweep algorithm uses the Interactive Reference Point option to determine which reference point of nodes are used to compare positions. */
                        cycleBreaking: 'GREEDY', // Strategy for cycle breaking. Cycle breaking looks for cycles in the graph and determines which edges to reverse to break the cycles. Reversed edges will end up pointing to the opposite direction of regular edges (that is, reversed edges will point left if edges usually point right).
                        /* GREEDY This algorithm reverses edges greedily. The algorithm tries to avoid edges that have the Priority property set.
                        INTERACTIVE The interactive algorithm tries to reverse edges that already pointed leftwards in the input graph. This requires node and port coordinates to have been set to sensible values.*/
                        direction: 'UNDEFINED', // Overall direction of edges: horizontal (right / left) or vertical (down / up)
                        /* UNDEFINED, RIGHT, LEFT, DOWN, UP */
                        edgeRouting: 'ORTHOGONAL', // Defines how edges are routed (POLYLINE, ORTHOGONAL, SPLINES)
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
                        nodeLayering: 'NETWORK_SIMPLEX', // Strategy for node layering.
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
        // Look  through the list of current_avatars
        // and check if any of them have a hash that is not included in the last_hashes array
        // If so then return true
        function areThereAnyNewOrMissingHashes() {
            var hasNewHashes = false;
            var hasMissingHashes = false;
            for (var i = 0; i < current_avatars.length; i++) {
                if (!last_hashes.includes(current_avatars[i].hash)) {
                    hasNewHashes = true;
                }
            }
            // Check if there are any hashes in the last_hashes array that are not in the current_avatars array
            for (var i = 0; i < last_hashes.length; i++) {
                var wasThisHashFound = false;
                for (var j = 0; j < current_avatars.length; j++) {
                    if (last_hashes[i] == current_avatars[j].hash) {
                        wasThisHashFound = true;
                        break;
                    }
                }
                if (!wasThisHashFound) {
                    hasMissingHashes = true;
                    break;
                }
            }
            return hasNewHashes || hasMissingHashes;
        }
        // Clear all existing hashes in last_hashes array
        // Add all hashes from current_avatars array to last_hashes array
        function updateLastHashes() {
            last_hashes = [];
            for (var i = 0; i < current_avatars.length; i++) {
                last_hashes.push(current_avatars[i].hash);
            }
        }
        function update_avatars_table() {
            var table_body = document.querySelector('#avatars_table tbody');
            table_body.innerHTML = "";
            // Take every avatar from current_avatars and make a row in the table
            if (current_avatars.length > 0) {
                console.log(current_avatars);
            }
            for (var i = 0; i < current_avatars.length; i++) {
                var row = table_body.insertRow(i);
                var node_id = row.insertCell(0);
                node_id.innerHTML = current_avatars[i].node_id;
                var name = row.insertCell(1);
                name.innerHTML = current_avatars[i].name || "No name";
                // Insert cells for pub, sub, cln and srv
                var sub_cell = row.insertCell(2);
                var pub_cell = row.insertCell(3);
                var cln_cell = row.insertCell(4);
                var srv_cell = row.insertCell(5);
                if (!current_avatars[i].ports) { continue; }
                pub_cell.innerHTML = current_avatars[i].ports.pub.toString();
                if(current_avatars[i].ports.sub.length == 8192) {
                    sub_cell.innerHTML = "All";
                } else {
                    sub_cell.innerHTML = current_avatars[i].ports.sub.toString();
                }
                cln_cell.innerHTML = current_avatars[i].ports.cln.toString();
                srv_cell.innerHTML = current_avatars[i].ports.srv.toString();
            }
        }
        function update_directed_graph() {
            if (!areThereAnyNewOrMissingHashes()) {
                return;
            } else {
                updateLastHashes();
            }
            my_graph.elements().remove();
            available_publishers = {};
            available_servers = {};
            for (avatar of current_avatars) {
                console.log(avatar);
                my_graph.add([{ data: { id: avatar.node_id, label: avatar.node_id + "\n" + avatar.name } }]);
                if (!avatar.ports) { continue; }
                // Add a node for each pub and connect, then connect avatar to every pub node
                for (pub of avatar.ports.pub) {
                    my_graph.add([{ data: { id: pub, "publish_subject": true, label: pub + "\npublisher" } }])
                    available_publishers[pub] = true;
                    my_graph.add([{ data: { source: avatar.node_id, target: pub, "publish_edge": true } }]);
                }
                // clients should point to servers
                // client node --> [port] --> server node
                // publisher node --> [port] --> subscriber node
                for (srv of avatar.ports.srv) {
                    my_graph.add([{ data: { id: srv, serve_subject: true, label: srv + "\nserver" } }])
                    my_graph.add([{ data: { source: srv, target: avatar.node_id, label: "A nice label", "serve_edge": true } }])
                }

            }
            for (avatar of current_avatars) {
                for (sub of avatar.ports.sub) {
                    if (available_publishers[sub]) {
                        my_graph.add([{ data: { source: sub, target: avatar.node_id, label: "A nice label" } }]);
                    }
                }
                for (cln of avatar.ports.cln) {
                    if (available_servers[cln]) {
                        my_graph.add([{ data: { source: avatar.node_id, target: cln, label: "A nice label" } }]);
                    }
                }
            }
            refresh_graph_layout();
        }
        function update_plot() {
            // Plotly.newPlot("plot_placeholder", /* JSON object */ {
            //     "data": [{ "y": [1, 2, 3] }],
            //     "layout": { "width": 600, "height": 400 }
            // })
        }


        function get_and_display_avatars() {
            update_avatars_table();
            pywebview.api.get_avatars().then(
                function (avatars) {
                    current_avatars = JSON.parse(avatars);
                    update_directed_graph(avatars);
                }
            );
        }
        setInterval(get_and_display_avatars, 1000);
        create_directed_graph();
        update_directed_graph();
        // Call update_messages every second
        setInterval(update_messages, 1000);
        //        var btnFetch = document.getElementById('btnFetch');
        //        btnFetch.addEventListener('click', function () {
        //            update_messages()
        //        });
        var btnRefreshGraphLayout = document.getElementById('btnRefreshGraphLayout');
        btnRefreshGraphLayout.addEventListener('click', function () {
            refresh_graph_layout()
        });
        // if hide-yakut is checked then send a message to the server to hide the yakut
        var hideYakut = document.getElementById('hide-yakut');
        hideYakut.addEventListener('change', function () {
            if (hideYakut.checked) {
                pywebview.api.hide_yakut();
            } else {
                pywebview.api.show_yakut();
            }
        });
        // This is actually one of the tabs in the tabbed interface but it also acts as a refresh layout button
        btnMonitorTab = document.getElementById('btnMonitorTab');
        btnMonitorTab.addEventListener('click', function () {
            refresh_graph_layout();
        });
    });
} catch (e) {
    addLocalMessage("Error: " + e);
    console.error(e);
}
