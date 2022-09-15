import { make_context_menus } from './context-menu.module.js';
import { create_directed_graph, refresh_graph_layout } from './monitor.module.js';
import { secondsToString } from "./utilities.module.js";
import { add_node_id_headers, make_empty_table_header_row_cell, addContentForRegisterName, updateRegistersTableColors } from './registers.module.js';
import { applyConfiguration, export_all_selected_registers, update_available_configurations_list, loadConfigurationFromOpenDialog } from './yaml.configurations.module.js';
import { areThereAnyNewOrMissingHashes, updateLastHashes } from './hash_checks.module.js';
import { create_registers_table, update_tables } from './registers.module.js';
import {get_all_selected_pairs, unselectAll, selectAll} from './registers.selection.module.js';
import { rereadPairs } from "./registers.data.module.js"
import { openFile } from "./yaml.configurations.module.js"

(async function () {
    function waitForElm(selector, timeOutMilliSeconds) {
        return new Promise(resolve => {
            let timeOutTimeout = setTimeout(() => {
                console.error("Timeout waiting for element: " + selector);
                resolve(null);
            }, timeOutMilliSeconds);
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }
    
            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    clearTimeout(timeOutTimeout);
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });
    
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
        });
    }
    yukon_state.addLocalMessage = function (message) {
        zubax_api.add_local_message(message)
    }
    yukon_state.navigator = navigator;
    yukon_state.document = document;
    yukon_state.window = window;
    const addLocalMessage = yukon_state.addLocalMessage;
    async function doStuffWhenReady() {
        var config = {
            content: [{
                type: 'row',
                content:[{
                    type: 'component',
                    componentName: 'statusComponent',
                    componentState: { label: 'A' }
                },
                {
                    type: 'column',
                    content:[{
                        type: 'component',
                        componentName: 'messagesComponent',
                        componentState: { label: 'B' }
                    },{
                        type: 'component',
                        componentName: 'monitorComponent',
                        componentState: { label: 'C' }
                    },
                    {
                        type: 'component',
                        componentName: 'registersComponent',
                        componentState: { label: 'C' }
                    }
                ]   
                }]
            }]
        };
        var myLayout = new GoldenLayout( config );
        myLayout.registerComponent('registersComponent', function( container, componentState ){
            const xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        container.getElement().html(this.responseText);
                    }
                    if (this.status == 404) {container.getElement().html("Page not found.");}
                }
            }
            xhttp.open("GET", "../registers.panel.html", true);
            xhttp.send();
        });
        myLayout.registerComponent('statusComponent', function( container, componentState ){
            const xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        container.getElement().html(this.responseText);
                    }
                    if (this.status == 404) {container.getElement().html("Page not found.");}
                }
            }
            xhttp.open("GET", "../status.panel.html", true);
            xhttp.send();
        });
        myLayout.registerComponent('monitorComponent', function( container, componentState ){
            const xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        container.getElement().html(this.responseText);
                        setTimeout(function()
                        {
                            yukon_state.my_graph = create_directed_graph(yukon_state);
                        }, 100);
                    }
                    if (this.status == 404) {container.getElement().html("Page not found.");}
                }
            }
            xhttp.open("GET", "monitor-window.html", true);
            xhttp.send();
        });
        myLayout.registerComponent('messagesComponent', function( container, componentState ){
            const xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        container.getElement().html(this.responseText);
                    }
                    if (this.status == 404) {container.getElement().html("Page not found.");}
                }
            }
            xhttp.open("GET", "../messages.panel.html", true);
            xhttp.send();
        });
        myLayout.init();
        yukon_state.zubax_api = zubax_api;
        yukon_state.jsyaml = jsyaml;
        // Make a callback on the page load event
        console.log("monitor ready");
        const iRegistersFilter = document.getElementById('iRegistersFilter');
        const cbSimplifyRegisters = document.getElementById('cbSimplifyRegisters');
        const divAllRegistersButtons = await waitForElm('#divAllRegistersButtons', 300);
        divAllRegistersButtons.style.display = 'none';
        var selected_registers = yukon_state.selections.selected_registers;
        var recently_reread_registers = {};
        let lastInternalMessageIndex = -1;
        yukon_state.selectingTableCellsIsDisabledStyle = document.createElement('style');
        yukon_state.selectingTableCellsIsDisabledStyle.innerHTML = `
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
                selectAll(yukon_state);
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
            if (e.keyCode == 69 && yukon_state.pressedKeys[18]) {
                openFile(yukon_state);
            }
        });
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
        let isRefreshTextOutAllowed = true;
        async function updateTextOut(refresh_anyway = false) {
            if(!isRefreshTextOutAllowed && !refresh_anyway) {return;}
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
        const cbStopTextOutRefresh = document.querySelector("#cbStopTextOutRefresh");
        cbStopTextOutRefresh.addEventListener("change", () => {
            if(cbStopTextOutRefresh.checked) {
                isRefreshTextOutAllowed = false;
            } else {
                isRefreshTextOutAllowed = true;
            }
        });
        const btnRefreshTextOut = document.querySelector("#btnRefreshTextOut");
        btnRefreshTextOut.addEventListener("click", async () => {
            await updateTextOut(true);
        });

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
            let my_graph = yukon_state.my_graph;
            if(typeof my_graph == "undefined") {return;}
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
        update_directed_graph();

        //        var btnFetch = document.getElementById('btnFetch');
        //        btnFetch.addEventListener('click', function () {
        //            update_messages()
        //        });
        var btnRefreshGraphLayout = document.getElementById('btnRefreshGraphLayout');
        btnRefreshGraphLayout.addEventListener('click', function () {
            refresh_graph_layout(yukon_state.my_graph)
        });
        var messagesList = document.querySelector("#messages-list");
        var cbShowTimestamp = await waitForElm('#cbShowTimestamp', 300);
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
        hideYakut.addEventListener('change', async function () {
            if (hideYakut.checked) {
                await zubax_api.hide_yakut()
                await updateTextOut(true);
            } else {
                await zubax_api.show_yakut()
                await updateTextOut(true);
            }
        });
        // This is actually one of the tabs in the tabbed interface but it also acts as a refresh layout button
        const btnMonitorTab = document.getElementById('btnMonitorTab');
        btnMonitorTab.addEventListener('click', function () {
            refresh_graph_layout(yukon_state.my_graph);
        });
        const btnAddAnotherTransport = document.getElementById('btnAddAnotherTransport');
        btnAddAnotherTransport.addEventListener('click', function () {
            zubax_api.open_add_transport_window();
        });
        const btnImportRegistersConfig = await waitForElm('#btnImportRegistersConfig', 300);
        btnImportRegistersConfig.addEventListener('click', async function () {
            loadConfigurationFromOpenDialog(false, yukon_state)
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
        btnExportAllSelectedRegisters.addEventListener('click', async function (event) {
            await export_all_selected_registers(null, null, yukon_state);
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
            await doStuffWhenReady();
        } else {
            window.addEventListener('zubax_api_ready', async function () {
                await doStuffWhenReady();
            });
        }
    } catch (e) {
        addLocalMessage("Error: " + e);
        console.error(e);
    }
})();
