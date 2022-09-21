import { make_context_menus } from './context-menu.module.js';
import { create_directed_graph, refresh_graph_layout, update_directed_graph } from './monitor.module.js';
import { secondsToString } from "./utilities.module.js";
import { add_node_id_headers, make_empty_table_header_row_cell, addContentForRegisterName, updateRegistersTableColors } from './registers.module.js';
import { applyConfiguration, export_all_selected_registers, update_available_configurations_list, loadConfigurationFromOpenDialog } from './yaml.configurations.module.js';
import { areThereAnyNewOrMissingHashes, updateLastHashes } from './hash_checks.module.js';
import { create_registers_table, update_tables } from './registers.module.js';
import { get_all_selected_pairs, unselectAll, selectAll } from './registers.selection.module.js';
import { rereadPairs } from "./registers.data.module.js"
import { openFile } from "./yaml.configurations.module.js"
import { initTransports } from "./transports.module.js"

(async function () {
    function waitForElm(selector, timeOutMilliSeconds) {
        return new Promise(resolve => {
            let timeOutTimeout
            if (timeOutMilliSeconds) {
                timeOutTimeout = setTimeout(() => {
                    console.error("Timeout waiting for element: " + selector);
                    resolve(null);
                }, timeOutMilliSeconds);
            }
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    if (timeOutTimeout) {
                        clearTimeout(timeOutTimeout);
                    }
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
    async function update_avatars_dto() {
        yukon_state.current_avatars = JSON.parse(await zubax_api.get_avatars()).avatars;
    }
    function setUpMonitorComponent() {
        // This is actually one of the tabs in the tabbed interface but it also acts as a refresh layout button
        const btnMonitorTab = document.getElementById('btnMonitorTab');
        btnMonitorTab.addEventListener('click', function () {
            refresh_graph_layout(yukon_state.my_graph);
        });
        yukon_state.my_graph = create_directed_graph(yukon_state);
        async function get_and_display_avatars() {
            await update_avatars_dto();
            update_directed_graph(yukon_state);
        }

        setInterval(get_and_display_avatars, 1000);
        update_directed_graph(yukon_state);
        var btnRefreshGraphLayout = document.getElementById('btnRefreshGraphLayout');
        btnRefreshGraphLayout.addEventListener('click', function () {
            refresh_graph_layout(yukon_state.my_graph)
        });
    }
    function setUpStatusComponent() {
        async function update_avatars_table() {
            await update_avatars_dto();
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
        setInterval(update_avatars_table, 1000);
    }
    async function setUpRegistersComponent() {
        setInterval(async () => {
            await update_avatars_dto();
            update_tables();
        }, 1000)
    }
    function setUpDebugTextOutComponent() {
        let isRefreshTextOutAllowed = true;
        async function updateTextOut(refresh_anyway = false) {
            if (!isRefreshTextOutAllowed && !refresh_anyway) { return; }
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
            if (cbStopTextOutRefresh.checked) {
                isRefreshTextOutAllowed = false;
            } else {
                isRefreshTextOutAllowed = true;
            }
        });
        const btnRefreshTextOut = document.querySelector("#btnRefreshTextOut");
        btnRefreshTextOut.addEventListener("click", async () => {
            await updateTextOut(true);
        });
    }
    async function setUpMessagesComponent() {
        var messagesList = document.querySelector("#messages-list");
        var cbShowTimestamp = await waitForElm('#cbShowTimestamp');
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
    }
    function setUpTransportsComponent() {
        initTransports(yukon_state);
        const btnAddAnotherTransport = document.getElementById('btnAddAnotherTransport');
        btnAddAnotherTransport.addEventListener('click', function () {
            zubax_api.open_add_transport_window();
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
            content: [
                {
                    type: 'row',
                    content: [
                        {
                            type: "column",
                            content: [
                                {
                                    type: 'stack',
                                    content: [
                                        {
                                            type: 'component',
                                            componentName: 'monitorComponent',
                                            isClosable: false,
                                            title: 'Monitor',
                                        },
                                        {
                                            type: 'component',
                                            componentName: 'registersComponent',
                                            isClosable: false,
                                            title: 'Registers',
                                        },
                                    ]
                                },
                                {
                                    type: 'component',
                                    height: 15,
                                    componentName: 'statusComponent',
                                    isClosable: false,
                                    title: 'Status',
                                }
                            ]
                        },
                        {
                            type: 'column',
                            width: 30,
                            content: [
                                {
                                    type: 'stack',
                                    activeItemIndex: 1,
                                    content: [
                                        {
                                            type: 'component',
                                            componentName: 'messagesComponent',
                                            isClosable: false,
                                            title: 'Messages',
                                        },
                                        {
                                            type: "component",
                                            componentName: "transportsComponent",
                                            isClosable: false,
                                            title: "Transports",
                                        }
                                    ]
                                }

                            ]
                        }
                    ]
                }
            ]
        };
        function dynamicallyLoadHTML(path, container, callback, callback_delay) {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        container.getElement().html(this.responseText);
                        if (callback_delay) {
                            setTimeout(callback, callback_delay);
                        } else {
                            callback();
                        }
                    } else if (this.status == 404) {
                        container.getElement().html("Page not found.");
                    } else {
                        container.getElement().html("Error: " + this.status);
                    }
                }
            }
            xhr.open("GET", path, true);
            xhr.send();
        }
        var myLayout = new GoldenLayout(config);
        myLayout.registerComponent('registersComponent', function (container, componentState) {
            dynamicallyLoadHTML("../registers.panel.html", container, setUpRegistersComponent, 100);
        });
        myLayout.registerComponent('statusComponent', function (container, componentState) {
            dynamicallyLoadHTML("../status.panel.html", container, setUpStatusComponent, 100);
        });
        myLayout.registerComponent('monitorComponent', function (container, componentState) {
            dynamicallyLoadHTML("../monitor.panel.html", container, setUpMonitorComponent, 100);
        });
        myLayout.registerComponent('messagesComponent', function (container, componentState) {
            dynamicallyLoadHTML("../messages.panel.html", container, setUpMessagesComponent, 100);
        });
        myLayout.registerComponent('transportsComponent', function (container, componentState) {
            dynamicallyLoadHTML("../add_transport.panel.html", container, setUpTransportsComponent, 100);
        });
        myLayout.init();
        yukon_state.zubax_api = zubax_api;
        yukon_state.jsyaml = jsyaml;
        // Make a callback on the page load event
        console.log("monitor ready");
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

        function setTableCellSelectability(selectable) {
            for (var i = 1; i < registers_table.rows.length; i++) {
                for (var j = 1; j < registers_table.rows[i].cells.length; j++) {
                    let table_cell = registers_table.rows[i].cells[j]
                    table_cell.style["user-select"] = "none";
                }
            }
        }

        function serialize_configuration_of_all_avatars() {
            var configuration = {};
            yukon_state.current_avatars.forEach(function (avatar) {
                configuration[avatar.node_id] = avatar.registers_exploded_values;
            });
            return JSON.stringify(configuration);
        }

        //        var btnFetch = document.getElementById('btnFetch');
        //        btnFetch.addEventListener('click', function () {
        //            update_messages()
        //        });

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
