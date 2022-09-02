(function () {
    function addLocalMessage(message) {
        zubax_api.add_local_message(message)
    }
    function doStuffWhenReady() {
        // Make a callback on the page load event
        console.log("monitor ready");
        const iRegistersFilter = document.getElementById('iRegistersFilter');
        const cbSimplifyRegisters = document.getElementById('cbSimplifyRegisters');
        var current_avatars = [];
        let last_hashes = { set: new Set() };
        let last_table_hashes = { set: new Set() }; // The same avatar hashes but for tables
        let lastHash = "";
        let my_graph = null;
        let available_configurations = {};
        let simplified_configurations_flags = {}; // The key is the file_name and true is is simplified
        let number_input_for_configuration = {}; // The key is the file_name and the value is the input element
        let selected_config = null;
        let selected_registers = {}; // Key is array of nodeid and register name, value is true if selected
        let selected_columns = {}; // Key is the node_id and value is true if selected
        let selected_rows = {}; // Key is register_name and value is true if selected
        let is_selection_mode_complicated = false;
        let lastInternalMessageIndex = -1;
        let showAlotOfButtons = false;
        let myContext = this;
        const colors = {
            "selected_register": 'rgba(0, 255, 0, 0.5)',
            "selected_column": 'rgba(0, 155, 255, 0.5)',
            "selected_row": "rgba(255, 255, 0, 0.5)",
            "selected_row_and_column": "rgba(255, 165, 0, 0.5)",
            "not_selected": "rgba(255, 255, 255, 0.5)",
            "no_value": "rgba(0, 0, 0, 0.5)"
        }
        const copyIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

        const cutIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`;

        const pasteIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px; position: relative; top: -1px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;

        const downloadIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px; position: relative; top: -1px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

        const deleteIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 7px" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

        // For table cells
        const table_cell_context_menu_items = [
            {
                content: `${downloadIcon}Set value`,
                events: {
                    click: (e) => {

                    }
                },
            },
            {
                content: `${pasteIcon}Set value from config`,
                events: {
                    click: (e) => {

                    }
                }
            },
            {
                content: `${copyIcon}Copy datatype`, divider: "top",
                events: {
                    click: (e) => {

                    }
                }
            }, 
            {
                content: `${copyIcon}Copy values`,
                events: {
                    click: (e) => {

                    }
                }
            },
            {
                content: `${downloadIcon}Reread registers`,
                events: {
                    click: (e) => {

                    }
                }
            }
        ];

        const table_cell_context_menu = new ContextMenu({
            target: "table-cell",
            menuItems: table_cell_context_menu_items,
            mode: "dark",
            context: this
        });
        table_cell_context_menu.init();
        // For table cell headers
        const table_header_context_menu_items = [
            { content: `${pasteIcon}Select column` },
            {
                content: `${downloadIcon}Apply a config from a file`,
                events: {
                    click: (e, elementOpenedOn) => {
                        zubax_api.import_node_configuration().then(
                            function (result) {
                                if (result == "") {
                                    addLocalMessage("No configuration imported");
                                } else {
                                    const headerCell = elementOpenedOn;
                                    const node_id = headerCell.getAttribute("data-node_id");
                                    const avatar = Object.values(current_avatars).find((e) => e.node_id == parseInt(node_id));
                                    addLocalMessage("Configuration imported");
                                    result_deserialized = JSON.parse(result);
                                    available_configurations[result_deserialized["__file_name"]] = result;
                                    selected_config = result_deserialized["__file_name"];
                                    update_available_configurations_list();
                                    const current_config = available_configurations[selected_config];
                                    if (current_config) {
                                        const selections = getAllEntireColumnsThatAreSelected();
                                        // For key and value in selections
                                        for (const key in selections) {
                                            const value = selections[key];
                                            const node_id2 = key;
                                            if(node_id2 == node_id) {
                                                // The column that the context menu is activated on is used anyway
                                                continue;
                                            }
                                            if(value) {
                                                // If any other columns are fully selected then they are applied aswell.
                                                console.log("Column " + key + " is fully selected");
                                                applyConfiguration(current_config, parseInt(node_id2));
                                            }
                                        }
                                        // The column that the context menu is activated on is used anyway
                                        applyConfiguration(current_config, parseInt(avatar.node_id));
                                    } else {
                                        console.log("No configuration selected");
                                    }
                                }
                            }
                        )
                    }
                },
                divider: "top"
            },
            {
                content: `${copyIcon}Export column`,
                events: {
                    click: (e, elementOpenedOn) => {
                        const headerCell = elementOpenedOn;
                        const node_id = headerCell.getAttribute("data-node_id");
                        const avatar = Object.values(current_avatars).find((e) => e.node_id == parseInt(node_id));
                        e.stopPropagation();
                        addLocalMessage("Exporting registers of " + avatar.node_id);
                        //const result = window.chooseFileSystemEntries({ type: "save-file" });
                        // Export all but only for this avatar, dried up code
                        export_all_selected_registers(avatar.node_id);
                    }
                }
            },
            {
                content: `${copyIcon}Copy values`,
                events: {
                    click: (e) => {

                    }
                }
            },
            {
                content: `${downloadIcon}Reread registers`,
                events: {
                    click: (e) => {
                        const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": true, "only_of_register_name": null });
                        let pairs = [];
                        // For every key, value in all_selected_pairs, then for every key in the value make an array for each key, value pair
                        for (const node_id of Object.keys(data)) {
                            const value = data[node_id];
                            for (const register_name of Object.keys(value)) {
                                pairs.push([node_id, register_name]);
                            }
                        }
                        zubax_api.reread_registers(pairs)
                    }
                }
            }
        ];

        const table_header_context_menu = new ContextMenu({
            target: "node_id_header",
            mode: "dark",
            menuItems: table_header_context_menu_items,
            context: this
        });
        table_header_context_menu.init();
        function getAllEntireColumnsThatAreSelected() {
            let all_registers_selected = {};
            // For every register in the avatar with the node_id
            for (var i = 0; i < current_avatars.length; i++) {
                const current_avatar = current_avatars[i]
                const node_id = current_avatar.node_id;
                all_registers_selected[current_avatar.node_id] = true;
                for (var j = 0; j < current_avatars[i].registers.length; j++) {
                    const register_name = current_avatars[i].registers[j];
                    if (!selected_registers[[node_id, register_name]]) {
                        all_registers_selected[current_avatar.node_id] = false;
                        break;
                    }
                }
            }
            return all_registers_selected;
        }
        function createMonitorPopup(text) {
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
            label.style.left = '0px';
            label.style.width = '380px';
            label.style.minHeight = '90px';
            label.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            label.style.color = 'white';
            label.style.textAlign = 'center';
            label.style.fontSize = '20px';
            label.style.fontWeight = 'bold';
            label.style.paddingTop = '20px';
            label.style.paddingBottom = '20px';
            label.style.zIndex = '1';
            label.style.pointerEvents = 'none';
            // Remove the label after 3 seconds
            setTimeout(function () {
                label.parentNode.removeChild(label);
            }, 3000);
        }
        function markCellWithMessage(table_cell, message, delay) {
            // Make an absolute positioned div positioned over the table cell
            var div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.top = table_cell.offsetTop + 'px';
            div.style.left = table_cell.offsetLeft + 'px';
            div.style.width = table_cell.offsetWidth + 'px';
            div.style.height = table_cell.offsetHeight + 'px';
            // Add an underlined paragraph to the div containing the message
            var p = document.createElement('p');
            p.innerHTML = message;
            p.style.textDecoration = 'underline';
            div.appendChild(p);
            // Add the div to the table cell
            table_cell.appendChild(div);
            setTimeout(function () {
                div.parentNode.removeChild(div);
            }, delay);
        }
        function findTableCell(node_id2, register_name2) {
            for (var i = 1; i < registers_table.rows.length; i++) {
                for (var j = 1; j < registers_table.rows[i].cells.length; j++) {
                    const table_cell = registers_table.rows[i].cells[j]
                    let node_id = table_cell.getAttribute("node_id")
                    let register_name = table_cell.getAttribute("register_name")
                    if (register_name == null) {
                        continue; // Must be the header cell at the end
                    }
                    if (parseInt(node_id) == parseInt(node_id2) && register_name == register_name2) {
                        return table_cell
                    }
                }
            }
        }
        function fetchAndHandleInternalMessages() {
            zubax_api.get_messages(lastInternalMessageIndex + 1).then(
                function (received_messages) {
                    let deserialized_messages = JSON.parse(received_messages);
                    // if deserialized_messages is empty then return
                    if (deserialized_messages.length == 0) {
                        return;
                    }
                    for (message in deserialized_messages) {
                        if (message.internal) {
                            if (message.message.includes("is not mutable")) {
                                addLocalMessage(message.message);
                            } else if (message.message.includes("does not exist on node")) {
                                addLocalMessage(message.message);
                                markCellWithMessage(findTableCell(message.arguments[0], message.arguments[1]), "This node has no such register but you tried to set it.", 3000);
                            } else if (message.message.includes("was supplied the wrong value.")) {
                                markCellWithMessage();
                            } else {
                                addLocalMessage("Internal message: " + message.message);
                            }
                        }
                    }
                    lastInternalMessageIndex = deserialized_messages[deserialized_messages.length - 1].index || -1;
                }
            );
        }
        setInterval(fetchAndHandleInternalMessages, 1000);
        function applyConfiguration(configuration, set_node_id) {
            let configuration_deserialized = JSON.parse(configuration);
            let potential_node_id;
            let number_input;
            if (!set_node_id) {
                number_input = number_input_for_configuration[selected_config];
                potential_node_id = parseInt(number_input.value);
            } else {
                potential_node_id = set_node_id;
            }
            zubax_api.is_network_configuration(configuration_deserialized).then(function (result) {
                const is_network_configuration = JSON.parse(result);
                zubax_api.is_configuration_simplified(configuration_deserialized).then(function (result) {
                    const is_configuration_simplified = JSON.parse(result);
                    if (is_network_configuration && is_configuration_simplified) {
                        // Start fetching datatypes
                        zubax_api.unsimplify_configuration(configuration).then(function (result) {
                            console.log("Unsimplified configuration: " + selected_config);
                            zubax_api.apply_all_of_configuration(result);
                            let interval1 = setInterval(() => update_tables(true), 1000);
                            setTimeout(() => clearInterval(interval1), 6000);
                        });
                    } else if (!is_network_configuration && is_configuration_simplified) {
                        const isValidNodeid = potential_node_id > 0 || potential_node_id < 128;
                        if (isValidNodeid) {
                            console.log("Applying configuration: " + selected_config + " to node " + potential_node_id);
                            zubax_api.apply_configuration_to_node(potential_node_id, JSON.stringify(configuration_deserialized))
                            let interval1 = setInterval(() => update_tables(true), 1000);
                            setTimeout(() => clearInterval(interval1), 6000);
                        } else if (number_input) {
                            console.log("There was no valid node id supplied.");
                            // Add a small label to the bottom of number_input to indicate that the node id is invalid, color the input red
                            number_input.style.borderColor = "red";
                            // Remove 3 seconds later
                            setTimeout(function () {
                                // Remove the red border
                                number_input.style.borderColor = "";
                            }, 3000);
                        }
                    }
                });
            });
        }
        function update_available_configurations_list() {
            var available_configurations_radios = document.querySelector("#available_configurations_radios");
            available_configurations_radios.innerHTML = "";
            number_input_for_configuration = {};
            simplified_configurations_flags = {};
            for (const [file_name, configuration_string] of Object.entries(available_configurations)) {
                // Fill in the available_configurations_radios with radio buttons
                var radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "configuration";
                radio.value = file_name;
                radio.id = file_name;
                // if the file_name is the selected_config, then set the radio button to checked
                if (file_name == selected_config) {
                    radio.checked = true;
                }
                radio.onmousedown = function () {
                    select_configuration(file_name);
                }
                available_configurations_radios.appendChild(radio);
                // Label for radio
                var label = document.createElement("label");
                label.htmlFor = file_name;
                label.innerHTML = file_name;
                label.onmousedown = function () {
                    select_configuration(file_name);
                }
                conf_deserialized = JSON.parse(configuration_string);
                zubax_api.is_network_configuration(conf_deserialized).then(function (result) {
                    const is_network_configuration = JSON.parse(result);
                    zubax_api.is_configuration_simplified(conf_deserialized).then(function (result) {
                        const is_simplified = JSON.parse(result);
                        if (is_simplified) {
                            label.innerHTML += " (simplified)";
                            simplified_configurations_flags[file_name] = true;
                        }
                        // For each key in the conf_deserialized, add a checkbox under the label with the key as the text and id
                        let noKeysWereNumbers = true; // This is essentially the same as is_configuration_simplified, but it is determined here locally
                        for (const [key, value] of Object.entries(conf_deserialized)) {
                            // If key is not a number continue
                            if (isNaN(key)) {
                                console.log("Key is not a number: " + key);
                                continue;
                            }
                            noKeysWereNumbers = false;
                            var checkbox = document.createElement("input");
                            checkbox.type = "checkbox";
                            checkbox.id = key;
                            checkbox.checked = true;
                            checkbox.onmousedown = function () {
                                // If the checkbox is checked, add the key to the configuration
                                if (checkbox.checked) {

                                } else {

                                }
                            }
                            label.appendChild(checkbox);
                            var text = document.createElement("span");
                            text.innerHTML = key;
                            label.appendChild(text);
                        }
                        if (!is_network_configuration && is_simplified) {
                            var number_input = document.createElement("input");
                            number_input.type = "number";
                            number_input.placeholder = "Node id needed";
                            number_input.title = "For determining datatypes, a node id is needed";
                            number_input_for_configuration[JSON.parse(JSON.stringify(file_name))] = number_input;
                            label.appendChild(number_input);
                        }
                        available_configurations_radios.appendChild(label);
                    });
                });

            }
        }
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
                console.log("Mouseover on node " + node.id());
                // Find the avatar for the node
                var avatar = current_avatars.find(function (avatar) {
                    return avatar.node_id == node.id();
                });
                if (avatar) {
                    // Create a label with the avatar's name
                    createMonitorPopup(avatar.name + " (" + avatar.node_id + ")" + "<br>" + secondsToString(avatar.last_heartbeat.uptime) + "<br>" + avatar.last_heartbeat.health_text + " (" + avatar.last_heartbeat.health + ")");
                }
            });
        }
        // A pair is a pair of nodeid and register name
        function get_all_selected_pairs(options) {
            let final_dict = {};
            // For each avatar in current_avatars
            for (var i = 0; i < current_avatars.length; i++) {
                let avatar_dto = {
                    // "uavcan.node.id": current_avatars[i].node_id,
                };
                var avatar = current_avatars[i];
                let saving_all = selected_columns[avatar.node_id] || options.only_of_avatar_of_node_id == avatar.node_id;
                if (options.only_of_avatar_of_node_id && current_avatars[i].node_id != options.only_of_avatar_of_node_id) {
                    continue;
                }

                // For each key in avatar.registers_exploded_values
                for (var key in avatar.registers_exploded_values) {
                    let register_name = key;
                    let register_value = avatar.registers_exploded_values[key];
                    if (options.get_everything) {
                        avatar_dto[register_name] = register_value;
                        continue;
                    }
                    if (options.only_of_register_name && register_name != options.only_of_register_name) {
                        continue;
                    }
                    if (saving_all || selected_rows[register_name] ||
                        selected_registers[[avatar.node_id, register_name]]) {
                        avatar_dto[register_name] = register_value;
                    }
                }
                if (Object.keys(avatar_dto).length > 0) {
                    final_dict[parseInt(avatar.node_id)] = avatar_dto;
                }
            }
            return final_dict;
        }
        function export_all_selected_registers(only_of_avatar_of_node_id = null, get_everything) {
            // A pair is the register_name and the node_id
            let pairs_object = get_all_selected_pairs({ "only_of_avatar_of_node_id": only_of_avatar_of_node_id, "get_everything": get_everything, "only_of_register_name": null });
            let json_string = JSON.stringify(pairs_object);
            var yaml_string = jsyaml.dump(pairs_object);
            if (cbSimplifyRegisters.checked) {
                zubax_api.simplify_configuration(json_string).then(function (simplified_json_string) {
                    intermediary_structure = JSON.parse(simplified_json_string);
                    const simplified_yaml_string = jsyaml.dump(intermediary_structure);
                    return zubax_api.save_text(simplified_yaml_string);
                });
            } else {
                return zubax_api.save_text(yaml_string);
            }
        }
        function refresh_graph_layout() {
            var layout = my_graph.layout(
                {
                    name: 'klay',
                    klay: {
                        // Following descriptions taken from http://layout.rtsys.informatik.uni-kiel.de:9444/Providedlayout.html?algorithm=de.cau.cs.kieler.klay.layered
                        addUnnecessaryBendpoints: true, // Adds bend points even if an edge does not change direction.
                        aspectRatio: 1.6, // The aimed aspect ratio of the drawing, that is the quotient of width by height
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
        // Look  through the list of current_avatars
        // and check if any of them have a hash that is not included in the existingHashesList array
        // If so then return true
        function eqSet(xs, ys) {
            return xs.size === ys.size && [...xs].every((x) => ys.has(x));
        }

        function areThereAnyNewOrMissingHashes(existingHashesSet, hash_property) {
            current_hashes_set = new Set();
            for (var i = 0; i < current_avatars.length; i++) {
                current_hashes_set.add(current_avatars[i][hash_property]);
            }
            return !eqSet(current_hashes_set, existingHashesSet.set);
        }
        // Clear all existing hashes in last_hashes array
        // Add all hashes from current_avatars array to last_hashes array
        function updateLastHashes(existingHashesSet, hash_property) {
            existingHashesSet.set = new Set();
            for (var i = 0; i < current_avatars.length; i++) {
                existingHashesSet.set.add(current_avatars[i][hash_property]);
            }
        }
        function update_register_value(register_name, register_value, node_id) {
            // Find the avatar which has the node_id
            const the_avatar = current_avatars.find((avatar) => avatar.node_id === parseInt(node_id));
            let unprocessed_value = JSON.parse(JSON.stringify(the_avatar["registers_exploded_values"][register_name]))
            // if unprocessed_value[Object.keys(the_value)[0]]["value"]
            if (typeof unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] == "string") {
                unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] = register_value
            } else if (typeof unprocessed_value[Object.keys(unprocessed_value)[0]]["value"][0] == "number") {
                // Split register_value by comma and convert to array of numbers
                let register_values = register_value.split(",").map(Number);
                unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] = register_values
            }
            console.log("Register value updated for " + register_name + " to " + register_value + " for node " + node_id)
            zubax_api.update_register_value(register_name, unprocessed_value, node_id);
        }
        function updateTextOut(refresh_anyway = false) {
            zubax_api.get_avatars().then(
                function (avatars) {
                    const textOut = document.querySelector("#textOut");
                    const DTO = JSON.parse(avatars);
                    if (DTO.hash != lastHash || refresh_anyway) {
                        lastHash = DTO.hash;
                        textOut.innerHTML = JSON.stringify(DTO.avatars, null, 4)
                    }
                    // Parse avatars as json
                }
            );
        }
        setInterval(updateTextOut, 1000);
        function select_configuration(i) {
            selected_config = i;
            addLocalMessage("Configuration " + i + " selected");
        }
        function updateRegistersTableColors() {
            var registers_table = document.querySelector('#registers_table')
            // For all table cells in registers_table, if the cell has the attribute node_id set to node_id then color it red if the node is selected or white if not
            for (var i = 1; i < registers_table.rows.length; i++) {
                for (var j = 1; j < registers_table.rows[i].cells.length; j++) {
                    const table_cell = registers_table.rows[i].cells[j]
                    let register_name = table_cell.getAttribute("id")
                    if (register_name == null) {
                        continue; // Must be the header cell at the end
                    }
                    // Remove the string "register_" from the register_name
                    register_name = register_name.substring(9);
                    const node_id = table_cell.getAttribute("node_id");
                    const is_register_selected = selected_registers[[node_id, register_name]]
                    const is_column_selected = selected_columns[node_id];
                    const is_row_selected = selected_rows[register_name];
                    const contained_input_element = table_cell.querySelector('input');
                    if (!contained_input_element) {
                        continue;
                    }
                    if (!register_name) {
                        console.warn("No register name found in table cell " + i + "," + j)
                        continue;
                    }
                    if (table_cell.getAttribute("no_value") == "true") {
                        contained_input_element.style.backgroundColor = colors["no_value"];
                        continue;
                    }
                    if (is_register_selected || is_column_selected || is_row_selected) {
                        contained_input_element.classList.add("selected_element");
                    } else {
                        // Remove the class "selected_element" from the input element if it has it
                        contained_input_element.classList.remove("selected_element");
                    }
                    if (is_register_selected) {
                        contained_input_element.style.backgroundColor = colors["selected_register"];

                    } else if (is_row_selected) {
                        contained_input_element.style.backgroundColor = colors["selected_row"];
                        if (is_column_selected) {
                            contained_input_element.style.backgroundColor = colors["selected_row_and_column"];
                        }
                    } else if (is_column_selected) {
                        contained_input_element.style.backgroundColor = colors["selected_column"];
                    } else {
                        contained_input_element.style.backgroundColor = colors["not_selected"];
                    }
                }
            }
        }

        function make_select_column(node_id, is_mouse_over = false) {
            return function (event) {
                if (is_mouse_over) {
                    if (!event.buttons == 1) {
                        return;
                    }
                }
                // Check if the mouse button was not a left click
                if (event.button !== 0) {
                    return;
                }
                // I want to make sure that the user is not selecting text, that's not when we activate this.
                if (window.getSelection().toString() !== "") {
                    return;
                }
                event.stopPropagation();
                if (is_selection_mode_complicated) {
                    if (selected_columns[node_id]) {
                        selected_columns[node_id] = false;
                        addLocalMessage("Column " + node_id + " deselected");
                    } else {
                        selected_columns[node_id] = true;
                        addLocalMessage("Column " + node_id + " selected");
                    }
                } else {
                    // See if any register of this node_id is selected
                    let any_register_selected = false;
                    // For every register in the avatar with the node_id
                    for (var i = 0; i < current_avatars.length; i++) {
                        const current_avatar = current_avatars[i]
                        if (current_avatar.node_id == node_id) {
                            for (var j = 0; j < current_avatars[i].registers.length; j++) {
                                const register_name = current_avatars[i].registers[j];
                                if (selected_registers[[node_id, register_name]]) {
                                    any_register_selected = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (any_register_selected) {
                        // Deselect all registers of this node_id
                        for (var i = 0; i < current_avatars.length; i++) {
                            const current_avatar = current_avatars[i]
                            if (current_avatar.node_id == node_id) {
                                for (var j = 0; j < current_avatars[i].registers.length; j++) {
                                    const register_name = current_avatars[i].registers[j];
                                    selected_registers[[node_id, register_name]] = false;
                                }
                            }
                        }
                        addLocalMessage("Column " + node_id + " deselected");
                    } else {
                        // Select all registers of this node_id
                        for (var i = 0; i < current_avatars.length; i++) {
                            const current_avatar = current_avatars[i]
                            if (current_avatar.node_id == node_id) {
                                for (var j = 0; j < current_avatars[i].registers.length; j++) {
                                    const register_name = current_avatars[i].registers[j];
                                    selected_registers[[node_id, register_name]] = true;
                                }
                            }
                        }
                        addLocalMessage("Column " + node_id + " selected");
                    }

                }
                updateRegistersTableColors();

            }
        }
        function make_select_row(register_name, is_mouse_over = false) {
            return function (event) {
                // If left mouse button is pressed
                if (is_mouse_over) {
                    if (!event.buttons == 1) {
                        return;
                    }
                }

                // I want to make sure that the user is not selecting text, that's not when we activate this.
                // if (window.getSelection().toString() !== "") {
                //     return;
                // }
                if (is_selection_mode_complicated) {
                    if (!selected_rows[register_name]) {
                        selected_rows[register_name] = true;
                    } else {
                        selected_rows[register_name] = false;
                    }
                } else {
                    // See if any register of this node_id is selected
                    let any_register_selected = false;
                    // For every register in the avatar with the node_id
                    for (var i = 0; i < current_avatars.length; i++) {
                        const current_avatar = current_avatars[i];
                        const node_id = current_avatar.node_id;
                        for (var j = 0; j < current_avatars[i].registers.length; j++) {
                            const register_name2 = current_avatars[i].registers[j];
                            if (register_name2 == register_name) {
                                if (selected_registers[[node_id, register_name]]) {
                                    any_register_selected = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (any_register_selected) {
                        // Deselect all registers with this register_name
                        for (var i = 0; i < current_avatars.length; i++) {
                            const current_avatar = current_avatars[i]
                            const node_id = current_avatar.node_id;
                            for (var j = 0; j < current_avatars[i].registers.length; j++) {
                                const register_name2 = current_avatars[i].registers[j];
                                if (register_name2 == register_name) {
                                    selected_registers[[node_id, register_name]] = false;
                                }
                            }
                        }
                    } else {
                        // Select all registers with this register_name
                        for (var i = 0; i < current_avatars.length; i++) {
                            const current_avatar = current_avatars[i]
                            const node_id = current_avatar.node_id;
                            for (var j = 0; j < current_avatars[i].registers.length; j++) {
                                const register_name2 = current_avatars[i].registers[j];
                                if (register_name2 == register_name) {
                                    selected_registers[[node_id, register_name]] = true;
                                }
                            }
                        }
                    }
                }
                updateRegistersTableColors();
                event.stopPropagation();
            }
        }
        function make_select_cell(avatar, register_name, is_mouse_over = false) {
            let selectCell = function () {
                if (!selected_registers[[avatar.node_id, register_name]]) {
                    selected_registers[[avatar.node_id, register_name]] = true;
                } else {
                    selected_registers[[avatar.node_id, register_name]] = false;
                }
                updateRegistersTableColors();
            }
            return function (event) {
                if (is_mouse_over) {
                    if (!event.buttons == 1) {
                        return;
                    }
                    if (event.target.matches(':hover')) {
                        selectCell();
                        event.stopPropagation();
                    }
                } else {
                    selectCell();
                }

            }
        }
        function update_tables(override = false) {
            if (override || areThereAnyNewOrMissingHashes(last_table_hashes, "hash")) {
                create_registers_table();
            }
            updateLastHashes(last_table_hashes, "hash");
        }
        setInterval(update_tables, 1000)
        setInterval(update_avatars_table, 1000);
        function create_registers_table(_filter_keyword_inclusive = null) {
            // Clear the table
            const filter_keyword_inclusive = _filter_keyword_inclusive || iRegistersFilter.value;
            var registers_table = document.querySelector('#registers_table')
            registers_table.innerHTML = '';
            var registers_table_body = document.createElement('tbody');
            registers_table.appendChild(registers_table_body);
            var registers_table_header = document.createElement('thead');
            registers_table.appendChild(registers_table_header);
            // Add the table headers
            var table_header_row = document.createElement('tr');
            function make_empty_table_header_row_cell() {
                var empty_table_header_row_cell = document.createElement('th');
                if (showAlotOfButtons) {
                    // Add a button into the empty table header row cell
                    var button = document.createElement('button');
                    button.innerHTML = 'Apply sel. conf to all nodes';
                    button.onclick = function () {
                        if (selected_config != null && available_configurations[selected_config] != null) {
                            applyConfiguration(available_configurations[selected_config]);
                        }
                    }
                    empty_table_header_row_cell.appendChild(button);
                    var button = document.createElement('button');
                    button.innerHTML = 'Save all of configuration';
                    button.onclick = function () {
                        export_all_selected_registers(null, true)
                    }
                    empty_table_header_row_cell.appendChild(button);
                }
                table_header_row.appendChild(empty_table_header_row_cell);
            }
            make_empty_table_header_row_cell();
            current_avatars.forEach(function (avatar) {
                let table_header_cell = document.createElement('th');
                table_header_cell.innerHTML = avatar.node_id;
                table_header_cell.title = avatar.name;
                table_header_cell.classList.add("node_id_header");
                table_header_cell.setAttribute("data-node_id", avatar.node_id);
                table_header_row.appendChild(table_header_cell);
                if (showAlotOfButtons) {
                    // Add a button to table_header_cell for downloading the table column
                    let btnExportConfig = document.createElement('button');
                    btnExportConfig.innerHTML = 'Export';
                    // Attach an event listener on the button click event
                    btnExportConfig.addEventListener('mousedown', function (event) {
                        event.stopPropagation();
                        addLocalMessage("Exporting registers of " + avatar.node_id);
                        //const result = window.chooseFileSystemEntries({ type: "save-file" });
                        // Export all but only for this avatar, dried up code
                        export_all_selected_registers(avatar.node_id);
                    });
                    table_header_cell.appendChild(btnExportConfig);
                    let btnApplyImportedConfig = document.createElement('button');
                    btnApplyImportedConfig.innerHTML = 'Apply imported config';
                    btnApplyImportedConfig.addEventListener('mousedown', function (event) {
                        event.stopPropagation();
                        const current_config = available_configurations[selected_config];
                        if (current_config) {
                            applyConfiguration(current_config, parseInt(avatar.node_id));
                        } else {
                            console.log("No configuration selected");
                        }
                    });
                    table_header_cell.appendChild(btnApplyImportedConfig);
                    let btnSelectColumn = document.createElement('button');
                    btnSelectColumn.innerHTML = 'Select column';
                    btnSelectColumn.addEventListener('mousedown', make_select_column(avatar.node_id));
                    table_header_cell.appendChild(btnSelectColumn);
                }
                table_header_cell.onmousedown = make_select_column(avatar.node_id);
                table_header_cell.onmouseover = make_select_column(avatar.node_id, true);
            });
            make_empty_table_header_row_cell()
            registers_table_header.appendChild(table_header_row);
            // Combine all register names from avatar.registers into an array
            var register_names = [];
            current_avatars.forEach(function (avatar) {
                avatar.registers.forEach(function (register) {
                    if (register != "" && !register_names.includes(register)) {
                        register_names.push(register);
                    }
                });
            });
            register_names.sort();
            // Add the table row headers for each register name
            register_names.forEach(function (register_name) {
                if (filter_keyword_inclusive != "" && !register_name.includes(filter_keyword_inclusive)) {
                    return;
                }
                let table_register_row = document.createElement('tr');
                registers_table_body.appendChild(table_register_row);
                function make_header_cell() {
                    let table_header_cell = document.createElement('th');
                    // REGISTER NAME HERE
                    table_header_cell.innerHTML = register_name;
                    table_header_cell.onmousedown = make_select_row(register_name);
                    table_header_cell.onmouseover = make_select_row(register_name, true);
                    if (showAlotOfButtons) {
                        let btnSelectRow = document.createElement('button');
                        btnSelectRow.innerHTML = 'Select row';
                        // Attach an event listener on the button click event
                        btnSelectRow.onmousedown = make_select_row(register_name);
                        table_header_cell.appendChild(btnSelectRow);
                    }

                    table_register_row.appendChild(table_header_cell);
                }
                make_header_cell();

                // Add table cells for each avatar, containing the value of the register from register_name
                current_avatars.forEach(function (avatar) {
                    // ALL THE REGISTER VALUES HERE
                    const table_cell = document.createElement('td');
                    table_register_row.appendChild(table_cell);
                    // Add a table_cell class to table_cell
                    table_cell.classList.add('no-padding');
                    // Set an attribute on td to store the register name
                    table_cell.setAttribute('id', "register_" + register_name);
                    table_cell.setAttribute("register_name", register_name);
                    table_cell.setAttribute("node_id", avatar.node_id);
                    table_cell.title = "Register name: " + register_name;
                    let register_value = avatar.registers_exploded_values[register_name];
                    // Here we check if the register value is a byte string and then we convert it to hex
                    let inputFieldReference = null;
                    if (register_value == null) {
                        table_cell.setAttribute("no_value", "true");
                        table_cell.classList.add("no-value");
                        table_cell.style.backgroundColor = colors["no_value"];
                        table_cell.title = "This register doesn't exist for this node";
                        return;
                    }
                    let type_string = Object.keys(register_value)[0];
                    let value = Object.values(register_value)[0].value;
                    let isOnlyValueInArray = false;
                    // If value is an array
                    if (Array.isArray(value)) {
                        // If the length of the array value is 1 then display the value without brackets
                        let text_input = document.createElement('input');
                        inputFieldReference = text_input;
                        text_input.setAttribute('type', 'text');
                        if (value.length == 1) {
                            isOnlyValueInArray = true;
                            text_input.value = value[0];
                        } else {
                            text_input.value = JSON.stringify(value);
                        }
                        // When the text input is clicked
                    } else if (type_string.includes("natural")) {
                        // Create a number input field
                        let number_input_field = document.createElement('input');
                        inputFieldReference = number_input_field;
                        number_input_field.type = 'number';
                        if (register_value == 65535) {
                            number_input_field.style.backgroundColor = '#ee0e0e';
                        }
                        number_input_field.value = value;
                    } else if (type_string === "string") {
                        let text_input = document.createElement('input');
                        inputFieldReference = text_input;
                        text_input.setAttribute('type', 'text');
                        text_input.value = value;
                        // When the text input is clicked
                    } else {
                        let text_input = document.createElement('input');
                        inputFieldReference = text_input;
                        text_input.setAttribute('type', 'text');
                        text_input.disabled = 'true';
                        text_input.style.backgroundColor = '#ee0e0e !important';
                        text_input.value = "Unhandled: " + type_string;
                    }
                    table_cell.appendChild(inputFieldReference);
                    function styleLabel(label) {
                        label.style.height = '0px';
                        label.style.position = 'absolute';
                        label.style.bottom = '13px';
                        label.style.fontSize = '10px';
                        label.style.color = '#000000';
                        label.style.backgroundColor = 'transparent !important';
                        label.style.padding = '0px';
                        label.style.margin = '1px';
                        label.style.border = '0px';
                        label.style.borderRadius = '0px';
                        label.style.display = 'inline';
                        label.style.width = 'calc(100% - 4px)';
                        label.style.fontFamily = 'monospace';
                        label.style.whiteSpace = 'nowrap';
                        label.style["pointer-events"] = 'none';
                        // label.style.zIndex = '-1';
                        // label.onmouseover = function(event) {
                        //     event.stopPropagation();
                        // }
                    }
                    // Create a new 10% height label in inputFieldReference and place it in the bottom right corner of the input field
                    {
                        // For displaying the value
                        const label = document.createElement('label');
                        styleLabel(label);
                        label.style.textAlign = 'right';
                        label.style.fontFamily = 'monospace';
                        label.style.zIndex = '1';
                        table_cell.style.position = 'relative';
                        label.style.right = '2px';
                        label.style.left = '2px';
                        let dimensionality = "";
                        if (Array.isArray(value)) {
                            dimensionality = "[" + value.length + "]";
                        }
                        label.innerHTML = type_string + dimensionality;
                        table_cell.insertBefore(label, inputFieldReference);
                    }
                    {
                        // For displaying the mutability and persistence
                        const explodedRegister = avatar.registers_exploded_values[register_name];
                        const isMutable = explodedRegister["_meta_"].mutable;
                        const isPersistent = explodedRegister["_meta_"].persistent;
                        const label = document.createElement('label');
                        styleLabel(label);
                        label.style.textAlign = 'left';
                        label.style.verticalAlign = 'bottom';
                        label.style.right = '2px';
                        label.style.left = '2px';
                        label.style.zIndex = '1';
                        table_cell.style.position = 'relative'; ``
                        label.innerHTML = "";
                        if (isMutable) {
                            label.innerHTML += "M";
                            table_cell.setAttribute("mutable", "true");
                        }
                        if (isPersistent) {
                            label.innerHTML += "P";
                            table_cell.setAttribute("persistent", "true");
                        }
                        table_cell.insertBefore(label, inputFieldReference);
                    }
                    // Set the height of inputFieldReference to match the height of the table cell
                    inputFieldReference.style.height = 100 + '%';
                    inputFieldReference.style.padding = '15px 10px';
                    inputFieldReference.style.lineHeight = '140%';
                    inputFieldReference.style.zIndex = '0';
                    inputFieldReference.setAttribute("spellcheck", "false");
                    inputFieldReference.classList.add('table-cell');
                    inputFieldReference.onmouseover = make_select_cell(avatar, register_name, is_mouse_over = true);
                    // inputFieldReference.onmousedown = make_select_cell(avatar, register_name);
                    var lastClick = null;
                    inputFieldReference.addEventListener('mousedown', function (event) {
                        // Check if the mouse button was left click
                        if (event.button !== 0) {
                            return;
                        }
                        if (lastClick && new Date() - lastClick < 500 && table_cell.getAttribute("mutable") == "true") {
                            // Make a dialog box to enter the new value
                            var new_value = prompt("Enter new value for " + register_name + ":", value);
                            // If the user entered a value
                            if (new_value != null) {
                                // Update the value in the table
                                // text_input.value = new_value;
                                // Update the value in the server
                                update_register_value(register_name, new_value, avatar.node_id);
                                // Run update_tables every second, do that only for the next 4 seconds
                                let interval1 = setInterval(() => update_tables(true), 1000);
                                setTimeout(() => clearInterval(interval1), 4000);
                            } else {
                                addLocalMessage("No value entered");
                            }
                        } else {
                            make_select_cell(avatar, register_name)(event)
                        }
                        lastClick = new Date();
                    });
                    // Create a text input element in the table cell
                });
                make_header_cell();
            });
            updateRegistersTableColors();
        }
        function setTableCellSelectability(selectable) {
            for (var i = 1; i < registers_table.rows.length; i++) {
                for (var j = 1; j < registers_table.rows[i].cells.length; j++) {
                    let table_cell = registers_table.rows[i].cells[j]
                    table_cell.style["user-select"] = "none";
                }
            }
        }
        function secondsToString(seconds) {
            var numyears = Math.floor(seconds / 31536000);
            var numdays = Math.floor((seconds % 31536000) / 86400);
            var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
            var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
            var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
            return numyears + " years " + numdays + " days " + numhours + " hours " + numminutes + " minutes " + numseconds + " seconds";
        }
        function update_avatars_table() {
            var table_body = document.querySelector('#avatars_table tbody');
            table_body.innerHTML = "";
            // Take every avatar from current_avatars and make a row in the table
            for (var i = 0; i < current_avatars.length; i++) {
                const row = table_body.insertRow(i);
                const node_id = row.insertCell(0);
                node_id.innerHTML = current_avatars[i].node_id;
                const name = row.insertCell(1);
                name.innerHTML = current_avatars[i].name || "No name";
                // Insert cells for pub, sub, cln and srv
                const sub_cell = row.insertCell(2);
                const pub_cell = row.insertCell(3);
                const cln_cell = row.insertCell(4);
                const srv_cell = row.insertCell(5);
                const health_cell = row.insertCell(6);
                const software_version_cell = row.insertCell(7);
                const hardware_version_cell = row.insertCell(8);
                const uptime_cell = row.insertCell(9);
                if (!current_avatars[i].ports) { continue; }
                pub_cell.innerHTML = current_avatars[i].ports.pub.toString();
                if (current_avatars[i].ports.sub.length == 8192) {
                    sub_cell.innerHTML = "All";
                } else {
                    sub_cell.innerHTML = current_avatars[i].ports.sub.toString();
                }
                cln_cell.innerHTML = current_avatars[i].ports.cln.toString();
                srv_cell.innerHTML = current_avatars[i].ports.srv.toString();
                health_cell.innerHTML = current_avatars[i].last_heartbeat.health_text;
                software_version_cell.innerHTML = current_avatars[i].versions.software_version;
                hardware_version_cell.innerHTML = current_avatars[i].versions.hardware_version;
                uptime_cell.innerHTML = secondsToString(current_avatars[i].last_heartbeat.uptime);
            }
        }
        function serialize_configuration_of_all_avatars() {
            var configuration = {};
            current_avatars.forEach(function (avatar) {
                configuration[avatar.node_id] = avatar.registers_exploded_values;
            });
            return JSON.stringify(configuration);
        }
        function update_directed_graph() {
            if (!areThereAnyNewOrMissingHashes(last_hashes, "monitor_view_hash")) {
                updateLastHashes(last_hashes, "monitor_view_hash");
                return;
            }
            updateLastHashes(last_hashes, "monitor_view_hash");
            my_graph.elements().remove();
            available_publishers = {};
            available_servers = {};
            for (avatar of current_avatars) {
                console.log(avatar);
                my_graph.add([{ data: { id: avatar.node_id, label: avatar.node_id + "\n" + avatar.name } }]);
                if (!avatar.ports) { continue; }
                // Add a node for each pub and connect, then connect avatar to every pub node
                for (pub of avatar.ports.pub) {
                    my_graph.add([{ data: { id: pub, "publish_subject": true, label: pub + "\nsubject" } }])
                    available_publishers[pub] = true;
                    my_graph.add([{ data: { source: avatar.node_id, target: pub, "publish_edge": true } }]);
                }
                // clients should point to servers
                // client node --> [port] --> server node
                // publisher node --> [port] --> subscriber node
                for (srv of avatar.ports.srv) {
                    my_graph.add([{ data: { id: srv, serve_subject: true, label: srv + "\nservice" } }])
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
            zubax_api.get_avatars().then(
                function (avatars) {
                    var DTO = JSON.parse(avatars);
                    current_avatars = DTO.avatars;
                    update_directed_graph();
                }
            );
        }

        setInterval(get_and_display_avatars, 1000);
        create_directed_graph();
        update_directed_graph();

        //        var btnFetch = document.getElementById('btnFetch');
        //        btnFetch.addEventListener('click', function () {
        //            update_messages()
        //        });
        var btnRefreshGraphLayout = document.getElementById('btnRefreshGraphLayout');
        btnRefreshGraphLayout.addEventListener('click', function () {
            refresh_graph_layout()
        });
        var messagesList = document.querySelector("#messages-list");
        cbShowTimestamp.addEventListener('change', function () {
            if (cbShowTimestamp.checked) {
                // For every message, add a timestamp to the message, use a for each loop
                for (message of messagesList.children) {
                    message.setAttribute("title", message.getAttribute("timeStampReadable"));
                }
            } else {
                // Remove the timestamp from every message
                for (message of messagesList.children) {
                    message.removeAttribute("title");
                }
            }
        });
        // if hide-yakut is checked then send a message to the server to hide the yakut
        var hideYakut = document.getElementById('hide-yakut');
        hideYakut.addEventListener('change', function () {
            if (hideYakut.checked) {
                zubax_api.hide_yakut().then(() => {
                    updateTextOut(true);
                });
            } else {
                zubax_api.show_yakut().then(() => {
                    updateTextOut(true);
                });
            }
        });
        // This is actually one of the tabs in the tabbed interface but it also acts as a refresh layout button
        btnMonitorTab = document.getElementById('btnMonitorTab');
        btnMonitorTab.addEventListener('click', function () {
            refresh_graph_layout();
        });
        btnAddAnotherTransport = document.getElementById('btnAddAnotherTransport');
        btnAddAnotherTransport.addEventListener('click', function () {
            zubax_api.open_add_transport_window();
        });
        btnImportRegistersConfig = document.getElementById('btnImportRegistersConfig');
        btnImportRegistersConfig.addEventListener('click', function () {
            zubax_api.import_node_configuration().then(
                function (result) {
                    if (result == "") {
                        addLocalMessage("No configuration imported");
                    } else {
                        addLocalMessage("Configuration imported");
                        result_deserialized = JSON.parse(result);
                        available_configurations[result_deserialized["__file_name"]] = result;
                        update_available_configurations_list();
                    }
                }
            )
        });
        btnSelectedSetFromPrompt = document.getElementById('btnSelectedSetFromPrompt');
        btnSelectedSetFromPrompt.addEventListener('click', function () {
            new_value = prompt("Enter the new value of selected registers", "")
            if (new_value == null) { addLocalMessage("No value was provided in the prompt."); return; }
            addLocalMessage("Setting selected registers to " + new_value);
            for (const key of Object.keys(selected_registers)) {
                if (selected_registers[key] == false) {
                    continue;
                }
                const [node_id, register_name] = key.split(",");
                if (node_id && register_name) {
                    update_register_value(register_name, new_value, node_id);
                }
            }
            // Run update_tables every second, do that only for the next 4 seconds
            let interval1 = setInterval(() => update_tables(true), 1000);
            setTimeout(() => clearInterval(interval1), 4000);
        });
        const btnSelectedUnsetValues = document.getElementById('btnSelectedUnsetValues');
        btnSelectedUnsetValues.addEventListener('click', function () {
            addLocalMessage("Unsetting selected registers");
            for (const key of Object.keys(selected_registers)) {
                if (selected_registers[key] == false) {
                    continue;
                }
                const [node_id, register_name] = key.split(",");
                if (node_id && register_name) {
                    update_register_value(register_name, "65535", node_id);
                }
            }
            // Run update_tables every second, do that only for the next 4 seconds
            let interval1 = setInterval(() => update_tables(true), 1000);
            setTimeout(() => clearInterval(interval1), 4000);
        });
        const btnUnselectAll = document.getElementById('btnUnselectAll');
        btnUnselectAll.addEventListener('click', function () {
            addLocalMessage("Unselecting all registers");
            selected_registers = {};
            selected_columns = {};
            selected_rows = {};
            updateRegistersTableColors();
        });
        const btnExportAllSelectedRegisters = document.getElementById('btnExportAllSelectedRegisters');
        btnExportAllSelectedRegisters.addEventListener('click', function (event) {
            export_all_selected_registers();
            event.stopPropagation();
        });

        var timer = null;
        iRegistersFilter.addEventListener("input", function () {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                create_registers_table()
            }, 500);
        });
        const btnRereadAllRegisters = document.getElementById('btnRereadAllRegisters');
        btnRereadAllRegisters.addEventListener('click', function () {
            const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": true, "only_of_register_name": null });
            let pairs = [];
            // For every key, value in all_selected_pairs, then for every key in the value make an array for each key, value pair
            for (const node_id of Object.keys(data)) {
                const value = data[node_id];
                for (const register_name of Object.keys(value)) {
                    pairs.push([node_id, register_name]);
                }
            }
            zubax_api.reread_registers(pairs)
        });
        const btnRereadSelectedRegisters = document.getElementById('btnRereadSelectedRegisters');
        btnRereadSelectedRegisters.addEventListener('click', function () {
            const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": false, "only_of_register_name": null });
            let pairs = [];
            // For every key, value in all_selected_pairs, then for every key in the value make an array for each key, value pair
            for (const node_id of Object.keys(data)) {
                const value = data[node_id];
                for (const register_name of Object.keys(value)) {
                    pairs.push([node_id, register_name]);
                }
            }
            zubax_api.reread_registers(pairs)
        });
    }
    try {
        if (zubax_api_ready) {
            doStuffWhenReady();
        } else {
            window.addEventListener('zubax_api_ready', function () {
                doStuffWhenReady();
            });
        }
    } catch (e) {
        addLocalMessage("Error: " + e);
        console.error(e);
    }
})();
