// Make a callback on the page load event
window.addEventListener('pywebviewready', function () {
    localMessages = [];
    var current_avatars = [];
    var my_graph = null;
    function addLocalMessage(message) {
        localMessages.push(message);
    }
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
                        'label': 'data(id)'
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
        var layout = my_graph.layout({name: 'circle'});
        layout.run();
    }
    function update_avatars_table() {
        var table_body = document.querySelector('#avatars_table tbody');
        table_body.innerHTML = "";
        // Take every avatar from current_avatars and make a row in the table
        if(current_avatars.length > 0) {
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
            if(!current_avatars[i].ports) { continue; }
            pub_cell.innerHTML = current_avatars[i].ports.pub.toString();
            sub_cell.innerHTML = current_avatars[i].ports.sub.toString();
            cln_cell.innerHTML = current_avatars[i].ports.cln.toString();
            srv_cell.innerHTML = current_avatars[i].ports.srv.toString();
        }
    }
    function update_directed_graph() {
        my_graph.elements().remove();
        
        for(avatar of current_avatars) {
            console.log(avatar);
            my_graph.add([{data:{id: avatar.node_id, label: avatar.node_id}}]);
            if(!avatar.ports) { continue; }
            // Add a node for each pub and connect, then connect avatar to every pub node
            for(pub of avatar.ports.pub) {
                my_graph.add([{data:{id: pub}}])
                my_graph.add([{data:{source: avatar.node_id, target: pub, label: "A nice label"}}]);
            }
            for(sub of avatar.ports.sub) {
                my_graph.add([{data:{id: sub}}])
                // same as pub but flip direction
                my_graph.add([{data:{source: sub, target: avatar.node_id, label: "A nice label"}}])
            }
            // clients should point to servers
            // client node --> [port] --> server node
            for(cln of avatar.ports.cln) {
                my_graph.add([{data:{id: cln}}])

            }
            for(srv of avatar.ports.srv) {
                my_graph.add([{data:{id: srv}}])
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
    pywebview.api.get_ports_list().then(
        function (portsList) {
            var stuff = document.querySelector("#stuff");
            var btnStart = document.getElementById('btnStart');
            var textOut = document.querySelector("#textOut");
            textOut.innerHTML = "Waiting to start...";
            addLocalMessage("Waiting to start...");
            var selector = document.querySelector("#sInterfaces");
            var d = JSON.parse(portsList);
            for (el of d) {
                var option = document.createElement("option");
                option.value = el;
                option.text = el;
                selector.appendChild(option);
            }
            // Get datarate and arbitration rate values from input fields
            var data_rate = document.getElementById('iDataRate').value;
            var arb_rate = document.getElementById('iArbRate').value;
            var node_id = document.getElementById('iNodeId').value;
            var mtu = document.getElementById('iMtu').value;
            btnStart.addEventListener('click', function () {
                var port = selector.value;
                pywebview.api.attach_transport(port, data_rate, arb_rate, node_id, mtu).then(
                    function (result) {
                        addLocalMessage("Now attached: " + result);
                        textOut.innerHTML = "Now attached: " + result;
                        // After 2 seconds hide stuff
                        setTimeout(function () {
                            stuff.style.display = "none";
                            update_plot();
                        }, 2000);
                    }
                );
            });
        });
    function update_messages() {
        pywebview.api.get_avatars().then(
            function (avatars) {
                var textOut = document.querySelector("#textOut");
                textOut.innerHTML = avatars;
            }
        );
        pywebview.api.get_messages().then(
            function (messages) {
                // Clear messages-list
                var messagesList = document.querySelector("#messages-list");
                for (child of messagesList.children) {
                    if (child && child.getAttribute("timestamp")) {
                        var timestamp = child.getAttribute("timestamp");
                        // if timestamp is older than 10 seconds, remove it
                        if (new Date().getTime() - timestamp > 10000) {
                            messagesList.removeChild(child);
                        }
                    }
                }
                // Add messages to messages-list
                var d = JSON.parse(messages);
                // Make sure that type of d is array
                console.assert(d instanceof Array);
                d = d.concat(localMessages)
                localMessages = [];
                for (el of d) {
                    var li = document.createElement("li");
                    li.innerHTML = el;
                    // Set an attribute on the list element with current timestamp
                    li.setAttribute("timestamp", new Date().getTime());
                    messagesList.appendChild(li);
                }
            }
        );
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
})