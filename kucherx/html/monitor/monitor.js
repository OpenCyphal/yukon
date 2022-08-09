try {
    // Make a callback on the page load event
    window.addEventListener('pywebviewready', function () {
        var current_avatars = [];
        var last_hashes = []
        var my_graph = null;
        function create_directed_graph() {
            my_graph = cytoscape({
                container: document.getElementById('cy'), // container to render in

                elements: [ // flat array of nodes and edges
                ],

                layout: {
                    name: 'grid'
                },

                // so we can see the ids
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(id)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'width': '100px',
                            'height': '100px',
                            'background-color': '#0E6BA8'
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
                            'height': '70px'
                        }
                    },
                    {
                        selector: 'node[?serve_subject]',
                        style: {
                            'background-color': '#0A2472',
                            'color': '#A6E1FA',
                            'width': '70px',
                            'height': '70px'
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
            my_graph.on('mouseover', 'node', function(evt){
              var node = evt.target;
            });
        }
        function refresh_graph_layout() {
            var layout = my_graph.layout({ name: 'cose' });
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
                if(!wasThisHashFound) {
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
                var cell = row.insertCell(0);
                cell.innerHTML = current_avatars[i].node_id;
                // Insert cells for pub, sub, cln and srv
                var pub_cell = row.insertCell(1);
                var sub_cell = row.insertCell(2);
                var cln_cell = row.insertCell(3);
                var srv_cell = row.insertCell(4);
                if (!current_avatars[i].ports) { continue; }
                pub_cell.innerHTML = current_avatars[i].ports.pub.toString();
                sub_cell.innerHTML = current_avatars[i].ports.sub.toString();
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
                my_graph.add([{ data: { id: avatar.node_id, label: avatar.node_id } }]);
                if (!avatar.ports) { continue; }
                // Add a node for each pub and connect, then connect avatar to every pub node
                for (pub of avatar.ports.pub) {
                    my_graph.add([{ data: { id: pub, "publish_subject": true  } }])
                    available_publishers[pub] = true;
                    my_graph.add([{ data: { source: avatar.node_id, target: pub, label: "A nice label", "publish_edge": true} }]);
                }
                // clients should point to servers
                // client node --> [port] --> server node
                for (srv of avatar.ports.srv) {
                    my_graph.add([{ data: { id: srv, serve_subject: true } }])
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
                    if(available_servers[cln]) {
                        my_graph.add([{ data: { source: cln, target: avatar.node_id, label: "A nice label" } }]);
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
        var btnFetch = document.getElementById('btnFetch');
        btnFetch.addEventListener('click', function () {
            update_messages()
        });
        var btnRefreshGraphLayout = document.getElementById('btnRefreshGraphLayout');
        btnRefreshGraphLayout.addEventListener('click', function () {
            refresh_graph_layout()
        });
    });
} catch (e) {
    addLocalMessage("Error: " + e);
    console.error(e);
}
