try {
    // Make a callback on the page load event
    window.addEventListener('pywebviewready', function () {
        var current_avatars = [];
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
                            'text-halign': 'center'
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
                    }
                ]

            });
        }
        function refresh_graph_layout() {
            var layout = my_graph.layout({ name: 'circle' });
            layout.run();
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
            my_graph.elements().remove();

            for (avatar of current_avatars) {
                console.log(avatar);
                my_graph.add([{ data: { id: avatar.node_id, label: avatar.node_id } }]);
                if (!avatar.ports) { continue; }
                // Add a node for each pub and connect, then connect avatar to every pub node
                for (pub of avatar.ports.pub) {
                    my_graph.add([{ data: { id: pub } }])
                    my_graph.add([{ data: { source: avatar.node_id, target: pub, label: "A nice label" } }]);
                }
                for (sub of avatar.ports.sub) {
                    my_graph.add([{ data: { id: sub } }])
                    // same as pub but flip direction
                    my_graph.add([{ data: { source: sub, target: avatar.node_id, label: "A nice label" } }])
                }
                // clients should point to servers
                // client node --> [port] --> server node
                for (cln of avatar.ports.cln) {
                    my_graph.add([{ data: { id: cln } }])
                }
                for (srv of avatar.ports.srv) {
                    my_graph.add([{ data: { id: srv } }])
                    my_graph.add([{ data: { source: srv, target: avatar.node_id, label: "A nice label" } }])
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
