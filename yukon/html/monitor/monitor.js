(function () {
    function addLocalMessage(message) {
        zubax_api.add_local_message(message)
    }
    function doStuffWhenReady() {
        // Make a callback on the page load event
        console.log("monitor ready");
        var current_avatars = [];
        var last_hashes = { set: new Set() };
        var last_table_hashes = { set: new Set() }; // The same avatar hashes but for tables
        var lastHash = "";
        var my_graph = null;
        var available_configurations = {};
        var selected_config = null
        var selected_registers = {}; // Key is array of nodeid and register name, value is true if selected
        var selected_columns = {}; // Key is the node_id and value is true if selected
        let selected_rows = {}; // Key is register_name and value is true if selected
        let colors = {
            "selected_register": 'rgba(0, 255, 0, 0.5)',
            "selected_column": 'rgba(0, 0, 255, 0.5)',
            "selected_row": "rgba(255, 255, 0, 0.5)",
            "selected_row_and_column": "rgba(255, 165, 0, 0.5)",
            "not_selected": "rgba(255, 255, 255, 0.5)",
            "no_value": "rgba(0, 0, 0, 0.5)"
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
            });
        }
        // A pair is a pair of nodeid and register name
        function get_all_selected_pairs(only_of_avatar_of_node_id = null, only_of_register_name = null, get_everything = false) {
            let final_dict = {};
            // For each avatar in current_avatars
            for (var i = 0; i < current_avatars.length; i++) {
                let avatar_dto = {
                    // "uavcan.node.id": current_avatars[i].node_id,
                };
                var avatar = current_avatars[i];
                if(get_everything) {
                    avatar_dto[register_name] = register_value;
                }
                let saving_all = selected_columns[avatar.node_id];
                if (only_of_avatar_of_node_id && current_avatars[i].node_id != only_of_avatar_of_node_id) {
                    continue;
                } else {
                    saving_all = true;
                }
                
                // For each key in avatar.registers_exploded_values
                for (var key in avatar.registers_exploded_values) {
                    let register_name = key;
                    let register_value = avatar.registers_exploded_values[key];
                    if(only_of_register_name && register_name != only_of_register_name) {
                        continue;
                    }
                    if (saving_all || selected_rows[register_name] ||
                        selected_registers[[avatar.node_id, register_name]]) {
                        avatar_dto[register_name] = register_value;
                    }
                }
                final_dict[avatar.node_id] = avatar_dto;
            }
            return final_dict;
        }
        function export_all_selected_registers(only_of_avatar_of_node_id = null) {
            // A pair is the register_name and the node_id
            var yaml_string = jsyaml.dump(get_all_selected_pairs(only_of_avatar_of_node_id));

            return zubax_api.save_text(yaml_string);
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
            let the_avatar = current_avatars.find((avatar) => avatar.node_id === parseInt(node_id));
            let unprocessed_value = the_avatar["registers_exploded_values"][register_name]
            // if unprocessed_value[Object.keys(the_value)[0]]["value"]
            if (typeof unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] == "string") {
                unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] = register_value
            } else if (typeof unprocessed_value[Object.keys(unprocessed_value)[0]]["value"][0] == "number") {
                unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] = [parseInt(register_value)]
            }
            zubax_api.update_register_value(register_name, unprocessed_value, node_id);
        }
        function updateTextOut(refresh_anyway = false) {
            zubax_api.get_avatars().then(
                function (avatars) {
                    var textOut = document.querySelector("#textOut");
                    var DTO = JSON.parse(avatars);
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
                    let table_cell = registers_table.rows[i].cells[j]
                    let register_name = table_cell.getAttribute("id")
                    // Remove the string "register_" from the register_name
                    register_name = register_name.substring(9);
                    let node_id = table_cell.getAttribute("node_id");
                    let is_register_selected = selected_registers[[node_id, register_name]]
                    let is_column_selected = selected_columns[node_id];
                    let is_row_selected = selected_rows[register_name];
                    let contained_input_element = table_cell.querySelector('input');
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

        function update_available_configurations_list() {
            var available_configurations_radios = document.querySelector("#available_configurations_radios");
            available_configurations_radios.innerHTML = "";
            for (const [key, value] of Object.entries(available_configurations)) {
                // Fill in the available_configurations_radios with radio buttons
                var radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "configuration";
                radio.value = key;
                radio.id = key;
                radio.onmousedown = function () {
                    select_configuration(this.id);
                }
                available_configurations_radios.appendChild(radio);
                // Label for radio
                var label = document.createElement("label");
                label.htmlFor = key;
                label.innerHTML = key;
                available_configurations_radios.appendChild(label);
            }
        }
        function make_select_column(node_id, is_mouse_over = false) {
            return function (event) {
                if (is_mouse_over) {
                    if (!event.buttons == 1) {
                        return;
                    }
                }
                // I want to make sure that the user is not selecting text, that's not when we activate this.
                if (window.getSelection().toString() !== "") {
                    return;
                }
                if (selected_columns[node_id]) {
                    selected_columns[node_id] = false;
                    addLocalMessage("Column " + node_id + " deselected");
                } else {
                    selected_columns[node_id] = true;
                    addLocalMessage("Column " + node_id + " selected");
                }
                updateRegistersTableColors();
                event.stopPropagation();
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
                if (window.getSelection().toString() !== "") {
                    return;
                }
                if (!selected_rows[register_name]) {
                    selected_rows[register_name] = true;
                } else {
                    selected_rows[register_name] = false;
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
                update_avatars_table();
                create_registers_table();
            }
            updateLastHashes(last_table_hashes, "hash");
        }
        setInterval(update_tables, 1000)
        function create_registers_table(filter_keyword_inclusive = "") {
            // Clear the table
            var registers_table = document.querySelector('#registers_table')
            registers_table.innerHTML = '';
            var registers_table_body = document.createElement('tbody');
            registers_table.appendChild(registers_table_body);
            var registers_table_header = document.createElement('thead');
            registers_table.appendChild(registers_table_header);
            // Add the table headers
            var table_header_row = document.createElement('tr');
            var empty_table_header_row_cell = document.createElement('th');
            // Add a button into the empty table header row cell
            var button = document.createElement('button');
            button.innerHTML = 'Apply sel. conf to all nodes';
            button.onclick = function () {
                if (selected_config != null && available_configurations[selected_config] != null) {
                    zubax_api.apply_all_of_configuration(available_configurations[selected_config]);
                }
            }
            empty_table_header_row_cell.appendChild(button);
            var button = document.createElement('button');
            button.innerHTML = 'Save all of configuration';
            button.onclick = function () {
                zubax_api.save_all_of_register_configuration(serialize_configuration_of_all_avatars());
            }
            empty_table_header_row_cell.appendChild(button);
            table_header_row.appendChild(empty_table_header_row_cell);
            current_avatars.forEach(function (avatar) {
                let table_header_cell = document.createElement('th');
                table_header_cell.innerHTML = avatar.node_id;
                table_header_row.appendChild(table_header_cell);
                // Add a button to table_header_cell for downloading the table column
                let btnExportConfig = document.createElement('button');
                btnExportConfig.innerHTML = 'Export';
                // Attach an event listener on the button click event
                btnExportConfig.addEventListener('click', function (event) {
                    addLocalMessage("Exporting registers of " + avatar.node_id);
                    const result = window.chooseFileSystemEntries({ type: "save-file" });
                    // Export all but only for this avatar, dried up code
                    export_all_selected_registers(avatar.node_id);
                    event.stopPropagation();
                });
                table_header_cell.appendChild(btnExportConfig);
                let btnApplyImportedConfig = document.createElement('button');
                btnApplyImportedConfig.innerHTML = 'Apply imported config';
                btnApplyImportedConfig.addEventListener('click', function (event) {
                    zubax_api.apply_configuration_to_node();
                    event.stopPropagation();
                });
                table_header_cell.appendChild(btnApplyImportedConfig);
                let btnSelectColumn = document.createElement('button');
                btnSelectColumn.innerHTML = 'Select column';
                btnSelectColumn.addEventListener('mousedown', make_select_column(avatar.node_id));
                table_header_cell.onmousedown = make_select_column(avatar.node_id);
                table_header_cell.onmouseover = make_select_column(avatar.node_id, true);
                table_header_cell.appendChild(btnSelectColumn);
            });
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
                let table_header_cell = document.createElement('th');
                // REGISTER NAME HERE
                table_header_cell.innerHTML = register_name;
                table_header_cell.onmousedown = make_select_row(register_name);
                table_header_cell.onmouseover = make_select_row(register_name, true);
                let btnSelectRow = document.createElement('button');
                btnSelectRow.innerHTML = 'Select row';
                // Attach an event listener on the button click event
                btnSelectRow.onmousedown = make_select_row(register_name);
                table_header_cell.appendChild(btnSelectRow);
                table_register_row.appendChild(table_header_cell);

                // Add table cells for each avatar, containing the value of the register from register_name
                current_avatars.forEach(function (avatar) {
                    // ALL THE REGISTER VALUES HERE
                    const table_cell = document.createElement('td');
                    table_register_row.appendChild(table_cell);
                    table_cell.className = 'no-padding';
                    // Set an attribute on td to store the register name
                    table_cell.setAttribute('id', "register_" + register_name);
                    table_cell.setAttribute("node_id", avatar.node_id);
                    let register_value = avatar.registers_exploded_values[register_name];
                    // Here we check if the register value is a byte string and then we convert it to hex
                    let inputFieldReference = null;
                    if (register_value == null) {
                        table_cell.setAttribute("no_value", "true");
                        table_cell.style.backgroundColor = colors["no_value"];
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
                    }
                    table_cell.appendChild(inputFieldReference);
                    function styleLabel(label) {
                        label.style.height = '0.1em';
                        label.style.position = 'absolute';
                        label.style.fontSize = '10px';
                        label.style.color = '#000000';
                        label.style.backgroundColor = 'transparent';
                        label.style.padding = '0px';
                        label.style.margin = '1px';
                        label.style.border = '0px';
                        label.style.borderRadius = '0px';
                        label.style.display = 'inline';
                        label.style.width = '100%';
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
                        label.style.width = '100%';
                        label.style.textAlign = 'right';
                        label.style.fontFamily = 'monospace';
                        label.style.zIndex = '1';
                        table_cell.style.position = 'relative';
                        label.style.bottom = '10px';
                        label.style.right = '0';
                        label.style.left = '0';
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
                        label.style.bottom = '10px';
                        label.style.right = '0';
                        label.style.left = '0';
                        label.style.zIndex = '1';
                        table_cell.style.position = 'relative';
                        label.innerHTML = "";
                        if (isMutable) {
                            label.innerHTML += "M";
                        }
                        if (isPersistent) {
                            label.innerHTML += "P";
                        }
                        table_cell.insertBefore(label, inputFieldReference);
                    }
                    // Set the height of inputFieldReference to match the height of the table cell
                    inputFieldReference.style.height = 100 + '%';
                    inputFieldReference.style.padding = '15px 10px';
                    inputFieldReference.style.lineHeight = '140%';
                    inputFieldReference.style.zIndex = '0';
                    inputFieldReference.setAttribute("spellcheck", "false");
                    inputFieldReference.onmouseover = make_select_cell(avatar, register_name, is_mouse_over = true);
                    // inputFieldReference.onmousedown = make_select_cell(avatar, register_name);
                    var lastClick = null;
                    inputFieldReference.addEventListener('mousedown', function (event) {
                        if (lastClick && new Date() - lastClick < 500) {
                            // Make a dialog box to enter the new value
                            var new_value = prompt("Enter new value for " + register_name + ":", value);
                            // If the user entered a value
                            if (new_value != null) {
                                // Update the value in the table
                                // text_input.value = new_value;
                                // Update the value in the avatar
                                avatar.registers_values[register_name] = new_value;
                                // Update the value in the server
                                update_register_value(register_name, new_value, avatar.node_id);
                                setTimeout(function () { update_tables(override = true) }, 500);
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

            });
            updateRegistersTableColors();
        }
        function update_avatars_table() {
            var table_body = document.querySelector('#avatars_table tbody');
            table_body.innerHTML = "";
            // Take every avatar from current_avatars and make a row in the table
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
                if (current_avatars[i].ports.sub.length == 8192) {
                    sub_cell.innerHTML = "All";
                } else {
                    sub_cell.innerHTML = current_avatars[i].ports.sub.toString();
                }
                cln_cell.innerHTML = current_avatars[i].ports.cln.toString();
                srv_cell.innerHTML = current_avatars[i].ports.srv.toString();
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
            setTimeOut(() => clearInterval(interval1), 4000);
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
            setTimeOut(() => clearInterval(interval1), 4000);
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
        const iRegistersFilter = document.getElementById('iRegistersFilter');
        var timer = null;
        iRegistersFilter.addEventListener("input", function () {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                create_registers_table(iRegistersFilter.value)
            }, 500);
        });
        const btnRereadAllRegisters = document.getElementById('btnRereadAllRegisters');
        btnRereadAllRegisters.addEventListener('click', function () {
            zubax_api.reread_registers(get_all_selected_pairs())
        });
        const btnRereadSelectedRegisters = document.getElementById('btnRereadSelectedRegisters');
        btnRereadSelectedRegisters.addEventListener('click', function () {

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
