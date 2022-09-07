import { make_context_menus } from './context-menu.module.js';
import { create_directed_graph, refresh_graph_layout } from './monitor.module.js';
import { add_node_id_headers, make_empty_table_header_row_cell, addContentForRegisterName, updateRegistersTableColors } from './registers.module.js';
import { applyConfiguration, export_all_selected_registers, update_available_configurations_list } from './yaml.configurations.module.js';
import { areThereAnyNewOrMissingHashes, updateLastHashes } from './hash_checks.module.js';
import { create_registers_table, update_tables } from './registers.module.js';
import {get_all_selected_pairs} from './registers.selection.module.js';
import { rereadPairs } from "./registers.data.module.js"

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
        var selected_registers = yukon_state.selections.selected_registers;
        var recently_reread_registers = {};
        let lastInternalMessageIndex = -1;
        const selectingTableCellsIsDisabledStyle = document.createElement('style');
        selectingTableCellsIsDisabledStyle.innerHTML = `
        .table-cell {
            user-select:none;
        }
        `;
        make_context_menus(yukon_state);
        // When escape is double pressed within 400ms, run unselectAll
        let escape_timer = null;
        window.onkeyup = function (e) { yukon_state.pressedKeys[e.keyCode] = false; }
        // Add event listeners for focus and blur event handlers to window
        window.addEventListener('focus', function () {
            console.log("Window focused");
            yukon_state.pressedKeys[18] = false;
        });
        window.addEventListener('blur', function () {
            console.log("Window blurred");
            yukon_state.pressedKeys[18] = false;
        });

        window.onkeydown = function (e) {
            // If alt tab was pressed return
            yukon_state.pressedKeys[e.keyCode] = true;
            // If ctrl a was pressed, select all
            if (yukon_state.pressedKeys[17] && yukon_state.pressedKeys[65]) {
                selectAll();
                e.preventDefault();
            }
            // If F5 is pressed, reread registers
            if (e.keyCode == 116) {
                const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": true, "only_of_register_name": null }, yukon_state);
                let pairs = [];
                // For every key, value in all_selected_pairs, then for every key in the value make an array for each key, value pair
                for (const node_id of Object.keys(data)) {
                    const value = data[node_id];
                    pairs[node_id] = {};
                    for (const register_name of Object.keys(value)) {
                        pairs[node_id][register_name] = true;
                    }
                }
                rereadPairs(pairs, yukon_state);
            }
        }
        document.addEventListener('keydown', function (e) {
            if (e.keyCode == 27) {
                if (escape_timer) {
                    clearTimeout(escape_timer);
                    escape_timer = null;
                    unselectAll(yukon_state);
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

        function unselectAll(yukon_state) {
            addLocalMessage("Unselecting all registers");
            yukon_state.selections.selected_registers = {};
            yukon_state.selections.selected_columns = {};
            yukon_state.selections.selected_rows = {};
            updateRegistersTableColors(yukon_state);
            window.getSelection()?.removeAllRanges();
            yukon_state.selections.last_cell_selected = null;
        }
        function selectAll() {
            // Iterate through every avatar in current_avatars and register_name and add them to the selected_registers
            addLocalMessage("Selecting all registers");
            if (isAllSelected()) {
                unselectAll(yukon_state);
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
            updateRegistersTableColors(yukon_state);
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
                    if (DTO.hash != yukon_state.lastHash || refresh_anyway) {
                        yukon_state.lastHash = DTO.hash;
                        textOut.innerHTML = JSON.stringify(DTO.avatars, null, 4)
                    }
                    // Parse avatars as json
                }
            );
        }
        setInterval(updateTextOut, 1000);
        

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
                updateLastHashes("monitor_view_hash", yukon_state);
                return;
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
            rereadPairs(pairs, yukon_state);
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
            rereadPairs(data, yukon_state);
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
