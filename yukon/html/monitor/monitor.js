import { make_context_menus } from './context-menu.module.js';
import { create_directed_graph, refresh_graph_layout } from './monitor.module.js';
import { add_node_id_headers, make_empty_table_header_row_cell, addContentForRegisterName } from './registers.module.js';
import { applyConfiguration, export_all_selected_registers, update_available_configurations_list } from './yaml.configurations.module.js';
import { areThereAnyNewOrMissingHashes, updateLastHashes } from './hash_checks.module.js';
import { create_registers_table, update_tables } from './registers.module.js';

(function () {
    yukon_state.addLocalMessage = function (message) {
        zubax_api.add_local_message(message)
    }
    const addLocalMessage = yukon_state.addLocalMessage;
    function doStuffWhenReady() {
        yukon_state.zubax_api = zubax_api;
        // Make a callback on the page load event
        console.log("monitor ready");
        const iRegistersFilter = document.getElementById('iRegistersFilter');
        const cbSimplifyRegisters = document.getElementById('cbSimplifyRegisters');
        const divAllRegistersButtons = document.getElementById('divAllRegistersButtons');
        divAllRegistersButtons.style.display = 'none';
        let lastHash = "";
        let simplified_configurations_flags = {}; // The key is the file_name and true is is simplified
        let number_input_for_configuration = {}; // The key is the file_name and the value is the input element
        let selected_config = null;
        var selected_registers = yukon_state.selections.selected_registers;
        var selected_columns = yukon_state.selections.selected_columns;
        var selected_rows = yukon_state.selections.selected_rows;
        var recently_reread_registers = {};
        var last_cell_selected = null;
        let is_selection_mode_complicated = false;
        let lastInternalMessageIndex = -1;
        let showAlotOfButtons = false;
        let showDoubleRowHeadersFromCount = 6;
        let shouldDoubleClickPromptToSetValue = false;
        let shouldDoubleClickOpenModal = true;
        var isTableCellTextSelectable = true;
        let myContext = this;
        const selectingTableCellsIsDisabledStyle = document.createElement('style');
        selectingTableCellsIsDisabledStyle.innerHTML = `
        .table-cell {
            user-select:none;
        }
        `;
        const colors = {
            "selected_register": '#0003EE',
            "selected_column": 'rgba(0, 155, 255, 0.5)',
            "selected_row": "rgba(255, 255, 0, 0.5)",
            "selected_row_and_column": "rgba(255, 165, 0, 0.5)",
            "not_selected": "rgba(255, 255, 255, 0.5)",
            "recently_read": "#B00036",
            "no_value": "#007E87"
        }
        make_context_menus(yukon_state);
        // When escape is double pressed within 400ms, run unselectAll
        let escape_timer = null;
        var pressedKeys = {};
        window.onkeyup = function (e) { pressedKeys[e.keyCode] = false; }
        // Add event listeners for focus and blur event handlers to window
        window.addEventListener('focus', function () {
            console.log("Window focused");
            pressedKeys[18] = false;
        });
        window.addEventListener('blur', function () {
            console.log("Window blurred");
            pressedKeys[18] = false;
        });

        window.onkeydown = function (e) {
            // If alt tab was pressed return
            pressedKeys[e.keyCode] = true;
            // If ctrl a was pressed, select all
            if (pressedKeys[17] && pressedKeys[65]) {
                selectAll();
                e.preventDefault();
            }
            // If F5 is pressed, reread registers
            if (e.keyCode == 116) {
                const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": true, "only_of_register_name": null }, current_avatars);
                let pairs = [];
                // For every key, value in all_selected_pairs, then for every key in the value make an array for each key, value pair
                for (const node_id of Object.keys(data)) {
                    const value = data[node_id];
                    pairs[node_id] = {};
                    for (const register_name of Object.keys(value)) {
                        pairs[node_id][register_name] = true;
                    }
                }
                rereadPairs(pairs);
            }
        }
        document.addEventListener('keydown', function (e) {
            if (e.keyCode == 27) {
                if (escape_timer) {
                    clearTimeout(escape_timer);
                    escape_timer = null;
                    unselectAll();
                } else {
                    escape_timer = setTimeout(function () {
                        escape_timer = null;
                    }, 400);
                }
            }
        });
        function isAllSelected() {
            let allSelected = true;
            for (let avatar of yukon_state.current_avatars) {
                for (let register_name of avatar.registers) {
                    if (!register_name) {
                        continue;
                    }
                    if (selected_registers[[avatar.node_id, register_name]]) {
                        continue;
                    } else {
                        allSelected = false;
                        break;
                    }
                }
            }
            return allSelected;
        }
        function fallbackCopyTextToClipboard(text) {
            var textArea = document.createElement("textarea");
            textArea.value = text;

            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                var successful = document.execCommand('copy');
                var msg = successful ? 'successful' : 'unsuccessful';
                console.log('Fallback: Copying text command was ' + msg);
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }

            document.body.removeChild(textArea);
        }
        function copyTextToClipboard(text) {
            if (!navigator.clipboard) {
                fallbackCopyTextToClipboard(text);
                return;
            }
            navigator.clipboard.writeText(text).then(function () {
                console.log('Async: Copying to clipboard was successful!');
            }, function (err) {
                console.error('Async: Could not copy text: ', err);
            });
        }

        function unselectAll() {
            addLocalMessage("Unselecting all registers");
            selected_registers = {};
            selected_columns = {};
            selected_rows = {};
            updateRegistersTableColors();
            window.getSelection()?.removeAllRanges();
            last_cell_selected = null;
        }
        function selectAll() {
            // Iterate through every avatar in current_avatars and register_name and add them to the selected_registers
            addLocalMessage("Selecting all registers");
            if (isAllSelected()) {
                unselectAll();
                return;
            }
            for (let avatar of yukon_state.current_avatars) {
                for (let register_name of avatar.registers) {
                    if (!register_name) {
                        continue;
                    }
                    selected_registers[[avatar.node_id, register_name]] = true;
                }
            }
            updateRegistersTableColors();
        }


        function rereadPairs(pairs) {
            // For every key of node_id in pairs
            for (let node_id in pairs) {
                if (!recently_reread_registers[node_id]) {
                    recently_reread_registers[node_id] = {};
                }
                // For every key of register_name in pairs[node_id]
                for (let register_name in pairs[node_id]) {
                    // Add the register to recently_reread_registers
                    recently_reread_registers[node_id][register_name] = true;
                }
            }
            updateRegistersTableColors();
            let registers_to_reset = JSON.parse(JSON.stringify(recently_reread_registers));
            setTimeout(() => {
                // Iterate through registers_to_reset and remove them from recently_reread_registers
                for (let node_id in registers_to_reset) {
                    for (let register_name in registers_to_reset[node_id]) {
                        recently_reread_registers[node_id][register_name] = false;
                    }
                }
            }, 600);
            zubax_api.reread_registers(pairs);
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
                    for (const message in deserialized_messages) {
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
        let updateRegistersTableColorsAgainTimer = null;
        function updateRegistersTableColors() {
            var registers_table = document.querySelector('#registers_table')
            // For all table cells in registers_table, if the cell has the attribute node_id set to node_id then color it red if the node is selected or white if not
            let needsRefresh = false;
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
                    const is_register_selected = selected_registers[[node_id, register_name]];
                    const is_column_selected = selected_columns[node_id];
                    const is_row_selected = selected_rows[register_name];
                    const temp_node = recently_reread_registers[node_id];
                    const is_recently_reread = temp_node && temp_node[register_name] === true;
                    if (!table_cell) {
                        continue;
                    }
                    if (!register_name) {
                        console.warn("No register name found in table cell " + i + "," + j)
                        continue;
                    }
                    if (is_register_selected || is_column_selected || is_row_selected) {
                        table_cell.classList.add("selected-cell");
                    } else {
                        // Remove the class "selected_element" from the input element if it has it
                        table_cell.classList.remove("selected-cell");
                    }
                    if (is_register_selected) {
                        table_cell.classList.add("selected-cell");
                        if (is_recently_reread) {
                            table_cell.classList.add("recently_reread_register");
                            needsRefresh = true;
                        }
                    } else if (is_row_selected) {
                        table_cell.style.backgroundColor = colors["selected_row"];
                        if (is_column_selected) {
                            table_cell.classList.add("selected_row_and_column");
                        }
                    } else if (is_column_selected) {
                        table_cell.classList.add("selected_column");
                    } else {
                        table_cell.classList.remove("selected-cell");
                    }
                    if (is_recently_reread) {
                        table_cell.classList.add("recently_reread_register");
                        needsRefresh = true;
                    } else {
                        table_cell.classList.remove("recently_reread_register");
                    }
                }
            }
            if (needsRefresh) {
                if (updateRegistersTableColorsAgainTimer != null) {
                    clearTimeout(updateRegistersTableColorsAgainTimer);
                }
                updateRegistersTableColorsAgainTimer = setTimeout(updateRegistersTableColors, 1000);
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
                    for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                        const current_avatar = yukon_state.current_avatars[i];
                        const node_id = current_avatar.node_id;
                        for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                            const register_name2 = yukon_state.current_avatars[i].registers[j];
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
                        for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                            const current_avatar = yukon_state.current_avatars[i]
                            const node_id = current_avatar.node_id;
                            for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                                const register_name2 = yukon_state.current_avatars[i].registers[j];
                                if (register_name2 == register_name) {
                                    selected_registers[[node_id, register_name]] = false;
                                }
                            }
                        }
                    } else {
                        // Select all registers with this register_name
                        for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                            const current_avatar = yukon_state.current_avatars[i]
                            const node_id = current_avatar.node_id;
                            for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                                const register_name2 = yukon_state.current_avatars[i].registers[j];
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
        function getAllCellsInBetween(start_cell, end_cell) {
            let row_based_selection = false;
            let column_based_selection = false;
            if (start_cell.node_id == end_cell.node_id) {
                column_based_selection = true;
            } else if (start_cell.register_name == end_cell.register_name) {
                row_based_selection = true;
            } else {
                return [];
            }
            let all_cells = [];
            let start_table_cell = null;
            let end_table_cell = null;
            if (row_based_selection) {
                start_table_cell = document.getElementById("cell_" + start_cell.node_id + "_" + start_cell.register_name);
                end_table_cell = document.getElementById("cell_" + end_cell.node_id + "_" + end_cell.register_name);
                for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                    const current_avatar = yukon_state.current_avatars[i];
                    // For every register in the avatar
                    for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                        const register_name = yukon_state.current_avatars[i].registers[j];
                        if (!register_name || register_name !== start_cell.register_name) {
                            continue;
                        }
                        // Get the cell corresponding to this register
                        const table_cell = document.getElementById("cell_" + current_avatar.node_id + "_" + register_name);

                        if (table_cell.offsetLeft > start_table_cell.offsetLeft && table_cell.offsetLeft < end_table_cell.offsetLeft ||
                            table_cell.offsetLeft < start_table_cell.offsetLeft && table_cell.offsetLeft > end_table_cell.offsetLeft) {
                            // Add it to the list
                            all_cells.push({ "node_id": current_avatar.node_id, "register_name": register_name });
                        }
                    }
                }
            } else {
                start_table_cell = document.getElementById("cell_" + start_cell.node_id + "_" + start_cell.register_name);
                end_table_cell = document.getElementById("cell_" + end_cell.node_id + "_" + end_cell.register_name);
                for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                    const current_avatar = yukon_state.current_avatars[i];
                    if (current_avatar.node_id !== start_cell.node_id) {
                        continue;
                    }
                    // For every register in the avatar
                    for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                        const register_name = yukon_state.current_avatars[i].registers[j];
                        if (!register_name) {
                            continue;
                        }
                        // Get the cell corresponding to this register
                        const table_cell = document.getElementById("cell_" + current_avatar.node_id + "_" + register_name);
                        // If the table_cell is above the start_table_cell and below the end_table_cell
                        if (table_cell.offsetTop > start_table_cell.offsetTop && table_cell.offsetTop < end_table_cell.offsetTop ||
                            table_cell.offsetTop < start_table_cell.offsetTop && table_cell.offsetTop > end_table_cell.offsetTop) {
                            // Add it to the list
                            all_cells.push({ "node_id": current_avatar.node_id, "register_name": register_name });
                        }

                    }
                }
            }
            return all_cells;
        }
        function createGenericModal() {
            let modal = document.createElement("div");
            modal.id = "modal";
            modal.style.position = "fixed";
            modal.style.top = "0px";
            modal.style.left = "0px";
            modal.style.width = "100%";
            modal.style.height = "100%";
            modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            modal.style.zIndex = "100";
            modal.style.display = "flex";
            modal.style.alignItems = "center";
            modal.style.justifyContent = "center";
            let modal_content = document.createElement("div");
            modal_content.style.backgroundColor = "white";
            modal_content.style.padding = "20px";
            modal_content.style.borderRadius = "10px";
            modal_content.style.width = "80%";
            modal.appendChild(modal_content);
            let modal_close = document.createElement("button");
            modal_close.innerHTML = "Close";
            modal_close.onclick = function () {
                document.body.removeChild(modal);
            }
            modal_content.appendChild(modal_close);
            // Also close the modal if escape is pressed
            document.addEventListener("keydown", function (event) {
                if (event.key == "Escape") {
                    document.removeEventListener("keydown", this);
                    document.body.removeChild(modal);
                }
            });
            return { "modal": modal, "modal_content": modal_content };
        }
        function editSelectedCellValues(pairs) {
            let returnObject = createGenericModal();
            let modal = returnObject.modal;
            let modal_content = returnObject.modal_content;
            let modal_title = document.createElement("h2");
            modal_title.innerHTML = "Selected cell values";
            modal_content.appendChild(modal_title);
            let modal_value = document.createElement("textarea");
            modal_value.value = "";
            modal_value.style.width = "100%";

            modal_content.appendChild(modal_value);
            autosize(modal_value);
            let submit_modal = function () {
                let new_value = modal_value.value;
                if (new_value != null) {
                    // Update the value in the table
                    // text_input.value = new_value;
                    // Update the value in the server
                    update_register_value(register_name, new_value, avatar.node_id, yukon_state);
                    // Run update_tables every second, do that only for the next 4 seconds
                    let interval1 = setInterval(() => update_tables(true), 1000);
                    setTimeout(() => clearInterval(interval1), 4000);
                    document.body.removeChild(modal);
                } else {
                    addLocalMessage("No value entered");
                }
            }
            let datatypes = new Set();
            let register_count = 0;
            // Create a list with all pairs, displaying the register name and the value and a submit button
            // When the submit button is clicked then the value is updated in the server and the list element is removed
            // Make a div that is at max 80% of the screen height and has a scrollbar
            let modal_list = document.createElement("div");
            modal_list.style.maxHeight = "80vh";
            modal_list.style.overflowY = "auto";
            modal_list.style.overflowX = "hidden";
            modal_list.style.marginBottom = "10px";
            modal_content.appendChild(modal_list);
            let array_size = null;
            for (node_id in pairs) {
                const registers = pairs[node_id];
                for (register_name in registers) {
                    register_count += 1;
                    const register_value = registers[register_name];
                    const datatype = Object.keys(register_value)[0];
                    datatypes.add(datatype);
                    const register_value_object = register_value[datatype].value;
                    let pair_div = document.createElement("div");
                    pair_div.classList.add("pair-div");
                    pair_div.style.display = "flex";
                    pair_div.style.alignItems = "center";
                    let pair_name = document.createElement("span");
                    pair_name.innerHTML = register_name;
                    pair_name.style.marginRight = "10px";
                    pair_div.appendChild(pair_name);
                    let is_pair_incompatible = false;
                    let current_array_size = 0;
                    // Add a span for datatype
                    // if register_value[datatype].value is an array
                    if (Array.isArray(register_value_object)) {
                        current_array_size = register_value[datatype].value.length;
                    } else {
                        current_array_size = 1;
                    }
                    if (array_size === null) {
                        array_size = current_array_size;
                    } else if (array_size == current_array_size) {
                        // Do nothing
                    } else {
                        // Color the pair div red
                        pair_div.style.backgroundColor = "red";
                        is_pair_incompatible = true;
                    }
                    let pair_datatype = document.createElement("span");
                    pair_datatype.innerHTML = datatype + "[" + current_array_size + "]";
                    pair_datatype.style.marginRight = "10px";
                    pair_div.appendChild(pair_datatype);
                    let pair_value = document.createElement("input");
                    pair_value.value = JSON.stringify(register_value_object);
                    pair_value.style.width = "100%";
                    pair_value.disabled = true;
                    pair_div.appendChild(pair_value);
                    // Add a discard button
                    let discard_button = document.createElement("button");
                    discard_button.innerHTML = "Discard";
                    discard_button.style.marginLeft = "10px";
                    discard_button.onclick = function () {
                        pair_div.remove();
                    }
                    pair_div.appendChild(discard_button);
                    let pair_submit = document.createElement("button");
                    pair_submit.innerHTML = "Update";
                    if (is_pair_incompatible) {
                        pair_submit.disabled = true;
                    }
                    pair_submit.onclick = function () {
                        if (modal_value.value != "") {
                            // Remove the list element
                            pair_div.parentNode.removeChild(pair_div);
                            // Update the value in the table
                            // text_input.value = new_value;
                            // Update the value in the server
                            update_register_value(register_name, modal_value.value, node_id, yukon_state);
                            // Run update_tables every second, do that only for the next 4 seconds
                            let interval1 = setInterval(() => update_tables(true), 1000);
                            setTimeout(() => clearInterval(interval1), 4000);
                            if (register_count == 1) {
                                document.body.removeChild(modal);
                            } else {
                                register_count -= 1;
                                // Remove the submit button
                                pair_submit.parentNode.removeChild(pair_submit);
                            }
                        } else {
                            addLocalMessage("No value entered");
                        }
                    }
                    pair_div.appendChild(pair_submit);
                    modal_list.appendChild(pair_div);
                }
            }

            // Add a submit button
            let modal_submit = document.createElement("button");
            modal_submit.innerHTML = "Submit all";
            modal_submit.onclick = submit_modal;
            // If enter is pressed the modal should submit too
            document.addEventListener("keydown", function (event) {
                if (event.key == "Enter") {
                    console.log("Enter pressed");
                    submit_modal();
                    document.removeEventListener("keydown", arguments.callee);
                }
            });
            modal_content.appendChild(modal_submit);
            // For each pair in pairs, add the datatype to a string variable called type_string

            let modal_type = document.createElement("p");
            const datatypes_string = Array.from(datatypes).join(", ");
            modal_type.innerHTML = "The value you are entering has to be castable to these types: " + datatypes_string + "<br>It also has to be of size: " + array_size;
            modal_content.appendChild(modal_type);
            document.body.appendChild(modal);
            setTimeout(() => modal_value.focus(), 100);
        }
        function showCellValue(node_id, register_name) {
            const avatar = yukon_state.current_avatars.find((avatar) => avatar.node_id == node_id);
            let register_value = avatar.registers_exploded_values[register_name];
            let type_string = Object.keys(register_value)[0];
            let value = Object.values(register_value)[0].value;
            // Create a modal with the value of the register
            let returnObject = createGenericModal();
            let modal = returnObject.modal;
            document.body.appendChild(modal);
            let modal_content = returnObject.modal_content;
            document.body.appendChild(modal);
            let modal_title = document.createElement("h2");
            modal_title.innerHTML = "Value of " + register_name;
            modal_content.appendChild(modal_title);

            let modal_value = document.createElement("textarea");
            modal_value.value = value;
            modal_value.style.width = "100%";

            modal_content.appendChild(modal_value);
            autosize(modal_value);
            let submit_modal = function () {
                let new_value = modal_value.value;
                if (new_value != null) {
                    // Update the value in the table
                    // text_input.value = new_value;
                    // Update the value in the server
                    update_register_value(register_name, new_value, avatar.node_id, yukon_state);
                    // Run update_tables every second, do that only for the next 4 seconds
                    let interval1 = setInterval(() => update_tables(true), 1000);
                    setTimeout(() => clearInterval(interval1), 4000);
                    document.body.removeChild(modal);
                } else {
                    addLocalMessage("No value entered");
                }
            }
            // Add a submit button
            let modal_submit = document.createElement("button");
            modal_submit.innerHTML = "Submit";
            modal_submit.onclick = submit_modal;
            // If enter is pressed the modal should submit too
            document.addEventListener("keydown", function (event) {
                if (event.key == "Enter") {
                    console.log("Enter pressed");
                    submit_modal();
                    document.removeEventListener("keydown", arguments.callee);
                }
            });
            modal_content.appendChild(modal_submit);

            let modal_type = document.createElement("p");
            modal_type.innerHTML = type_string;
            modal_content.appendChild(modal_type);
            setTimeout(() => modal_value.focus(), 100);
        }

        function make_select_cell(avatar, register_name, is_mouse_over = false) {
            let selectCell = function () {
                if (!selected_registers[[avatar.node_id, register_name]]) {
                    selected_registers[[avatar.node_id, register_name]] = true;
                    // If shift is being held down
                    if (pressedKeys[16] && last_cell_selected) {
                        const allCells = getAllCellsInBetween(last_cell_selected, { "node_id": avatar.node_id, "register_name": register_name });
                        for (var i = 0; i < allCells.length; i++) {
                            const cell = allCells[i];
                            selected_registers[[cell.node_id, cell.register_name]] = true;
                        }
                    }
                    last_cell_selected = { "node_id": avatar.node_id, "register_name": register_name };
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
                        // If alt is pressed
                        if (pressedKeys[18]) {
                            // Reread the register
                            let pairs_object = {};
                            pairs_object[avatar.node_id] = {};
                            pairs_object[avatar.node_id][register_name] = true;
                            rereadPairs(pairs_object);
                            return;
                        }
                        selectCell();
                        event.stopPropagation();
                    }
                } else {
                    // If alt is pressed
                    if (pressedKeys[18]) {
                        // Reread the register
                        let pairs_object = {};
                        pairs_object[avatar.node_id] = {};
                        pairs_object[avatar.node_id][register_name] = true;
                        rereadPairs(pairs_object);
                        return;
                    }
                    // If control is pressed
                    if (pressedKeys[17]) {
                        showCellValue(avatar.node_id, register_name);
                        return;
                    }
                    selectCell();
                }
            }
        }
        setInterval(update_tables, 1000)
        setInterval(update_avatars_table, 1000);

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
            // Take every avatar from yukon_state.current_avatars and make a row in the table
            for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                const row = table_body.insertRow(i);
                const node_id = row.insertCell(0);
                node_id.innerHTML = yukon_state.current_avatars[i].node_id;
                const name = row.insertCell(1);
                name.innerHTML = yukon_state.current_avatars[i].name || "No name";
                // Insert cells for pub, sub, cln and srv
                const sub_cell = row.insertCell(2);
                const pub_cell = row.insertCell(3);
                const cln_cell = row.insertCell(4);
                const srv_cell = row.insertCell(5);
                const health_cell = row.insertCell(6);
                const software_version_cell = row.insertCell(7);
                const hardware_version_cell = row.insertCell(8);
                const uptime_cell = row.insertCell(9);
                if (!yukon_state.current_avatars[i].ports) { continue; }
                pub_cell.innerHTML = yukon_state.current_avatars[i].ports.pub.toString();
                if (yukon_state.current_avatars[i].ports.sub.length == 8192) {
                    sub_cell.innerHTML = "All";
                } else {
                    sub_cell.innerHTML = yukon_state.current_avatars[i].ports.sub.toString();
                }
                cln_cell.innerHTML = yukon_state.current_avatars[i].ports.cln.toString();
                srv_cell.innerHTML = yukon_state.current_avatars[i].ports.srv.toString();
                health_cell.innerHTML = yukon_state.current_avatars[i].last_heartbeat.health_text;
                software_version_cell.innerHTML = yukon_state.current_avatars[i].versions.software_version;
                hardware_version_cell.innerHTML = yukon_state.current_avatars[i].versions.hardware_version;
                uptime_cell.innerHTML = secondsToString(yukon_state.current_avatars[i].last_heartbeat.uptime);
            }
        }
        function serialize_configuration_of_all_avatars() {
            var configuration = {};
            yukon_state.current_avatars.forEach(function (avatar) {
                configuration[avatar.node_id] = avatar.registers_exploded_values;
            });
            return JSON.stringify(configuration);
        }
        function update_directed_graph() {
            if (!areThereAnyNewOrMissingHashes("monitor_view_hash", yukon_state)) {
                updateLastHashes("monitor_view_hash");
                return;
            }
            updateLastHashes(yukon_state.last_hashes, "monitor_view_hash");
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
                    yukon_state.current_avatars = DTO.avatars;
                    update_directed_graph();
                }
            );
        }

        setInterval(get_and_display_avatars, 1000);
        var my_graph = create_directed_graph(yukon_state.current_avatars);
        update_directed_graph();

        //        var btnFetch = document.getElementById('btnFetch');
        //        btnFetch.addEventListener('click', function () {
        //            update_messages()
        //        });
        var btnRefreshGraphLayout = document.getElementById('btnRefreshGraphLayout');
        btnRefreshGraphLayout.addEventListener('click', function () {
            refresh_graph_layout(my_graph)
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
        const btnMonitorTab = document.getElementById('btnMonitorTab');
        btnMonitorTab.addEventListener('click', function () {
            refresh_graph_layout(my_graph);
        });
        const btnAddAnotherTransport = document.getElementById('btnAddAnotherTransport');
        btnAddAnotherTransport.addEventListener('click', function () {
            zubax_api.open_add_transport_window();
        });
        const btnImportRegistersConfig = document.getElementById('btnImportRegistersConfig');
        btnImportRegistersConfig.addEventListener('click', function () {
            zubax_api.import_node_configuration().then(
                function (result) {
                    if (result == "") {
                        addLocalMessage("No configuration imported");
                    } else {
                        addLocalMessage("Configuration imported");
                        result_deserialized = JSON.parse(result);
                        yukon_state.available_configurations[result_deserialized["__file_name"]] = result;
                        update_available_configurations_list(yukon_state);
                    }
                }
            )
        });
        const btnSelectedSetFromPrompt = document.getElementById('btnSelectedSetFromPrompt');
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
                    update_register_value(register_name, new_value, node_id, yukon_state);
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
                    update_register_value(register_name, "65535", node_id, yukon_state);
                }
            }
            // Run update_tables every second, do that only for the next 4 seconds
            let interval1 = setInterval(() => update_tables(true), 1000);
            setTimeout(() => clearInterval(interval1), 4000);
        });
        const btnUnselectAll = document.getElementById('btnUnselectAll');
        btnUnselectAll.addEventListener('click', function () {

        });
        const btnExportAllSelectedRegisters = document.getElementById('btnExportAllSelectedRegisters');
        btnExportAllSelectedRegisters.addEventListener('click', function (event) {
            export_all_selected_registers(null, null, yukon_state);
            event.stopPropagation();
        });

        var timer = null;
        iRegistersFilter.addEventListener("input", function () {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                create_registers_table(null, yukon_state)
            }, 500);
        });
        const btnRereadAllRegisters = document.getElementById('btnRereadAllRegisters');
        btnRereadAllRegisters.addEventListener('click', function () {
            const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": true, "only_of_register_name": null });
            let pairs = [];
            // For every key, value in all_selected_pairs, then for every key in the value make an array for each key, value pair
            for (const node_id of Object.keys(data)) {
                const value = data[node_id];
                pairs[node_id] = {};
                for (const register_name of Object.keys(value)) {
                    pairs[node_id][register_name] = true;
                }
            }
            rereadPairs(pairs);
        });
        const btnRereadSelectedRegisters = document.getElementById('btnRereadSelectedRegisters');
        btnRereadSelectedRegisters.addEventListener('click', function () {
            const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": false, "only_of_register_name": null });
            let pairs = {};
            // For every key, value in all_selected_pairs, then for every key in the value make an array for each key, value pair
            for (const node_id of Object.keys(data)) {
                const value = data[node_id];
                pairs[node_id] = {};
                for (const register_name of Object.keys(value)) {
                    pairs[node_id][register_name] = true;
                }
            }
            rereadPairs(data);
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
