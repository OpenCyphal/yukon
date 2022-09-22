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
        const text_result = await zubax_api.get_avatars();
        const obj_result = JSON.parse(text_result);
        yukon_state.current_avatars = obj_result.avatars;
    }
    function setUpMonitorComponent() {
        yukon_state.my_graph = create_directed_graph(yukon_state);
        async function get_and_display_avatars() {
            await update_avatars_dto();
            update_directed_graph(yukon_state);
        }

        setInterval(get_and_display_avatars, 1000);
        update_directed_graph(yukon_state);
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
    async function setUpRegistersComponent(immediateCreateTable) {
        if (immediateCreateTable) {
            await update_avatars_dto();
            update_tables(true);
        }
        setInterval(async () => {
            await update_avatars_dto();
            update_tables();
        }, 1000)
        var timer = null;
        const iRegistersFilter = document.getElementById('iRegistersFilter');
        iRegistersFilter.addEventListener("input", function () {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                create_registers_table(iRegistersFilter.value, yukon_state)
            }, 500);
        });
        const btnImportRegistersConfig = document.getElementById('btnImportRegistersConfig');
        btnImportRegistersConfig.addEventListener('click', async function () {
            loadConfigurationFromOpenDialog(false, yukon_state)
        });
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
                for (const message of messagesList.children) {
                    message.setAttribute("title", message.getAttribute("timeStampReadable"));
                }
            } else {
                // Remove the timestamp from every message
                for (const message of messagesList.children) {
                    message.removeAttribute("title");
                }
            }
        });
        var messagesList = document.querySelector("#messages-list");
        let messagesListWidth = messagesList.getBoundingClientRect().width
        var lastMessageIndex = -1;
        function displayOneMessage(message) {
            var messageItem = document.createElement("textarea");
            messageItem.classList.add("message-item");
            messageItem.classList.add("is-active");
            messageItem.setAttribute("spellcheck", "false");
            messageItem.innerHTML = message;
            messagesList.appendChild(messageItem);
            autosize(messageItem);
        }
        function fetchAndDisplayMessages() {
            zubax_api.get_messages(lastMessageIndex + 1).then(function (messages) {
                var messagesObject = JSON.parse(messages);
                for (const message of messagesObject) {
                    displayOneMessage(message.message);
                    // For the last message
                    if (message == messagesObject[messagesObject.length - 1]) {
                        lastMessageIndex = message.index;
                    }
                }
            });
        }
        setInterval(fetchAndDisplayMessages, 1000);
        console.log("Messages javascript is ready");
        var lastIndex = -1;
        var messagesList = await waitForElm("#messages-list");
        var cbAutoscroll = await waitForElm("#cbAutoscroll");
        function showAllMessages() {
            var messagesList = document.querySelector("#messages-list");
            if (!messagesList) { return; }
            // For each message in messagesList
            for (const child of messagesList.children) {
                child.style.display = "block";
            }
        }
        function applyExcludingTextFilterToMessage() {
            var messagesList = document.querySelector("#messages-list");
            var taExcludedKeywords = document.getElementById("taExcludedKeywords");
            var excludedKeywords = taExcludedKeywords.value.split("\n");
            for (const child of messagesList.children) {
                // For every excluded keyword in the list, hide the message if it contains the keyword
                for (const keyword of excludedKeywords) {
                    // If keyword is empty then continue
                    if (keyword == "") {
                        continue;
                    }
                    if (child.innerHTML.includes(keyword)) {
                        child.style.display = "none";
                        break;
                    }
                }
            }
        }
        function applyTextFilterToMessages() {
            // Get the filter text from iTextFilter and save it in a variable
            var iTextFilter = document.getElementById("iTextFilter");
            var messagesList = document.querySelector("#messages-list");
            var textFilter = iTextFilter.value;
            for (const child of messagesList.children) {
                // Hide all messages that do not contain the filter text
                if (!child.innerHTML.includes(textFilter)) {
                    child.style.display = "none";
                }
            }
        }
        function timeSince(date) {
            var seconds = Math.floor(((new Date().getTime() / 1000) - date))

            var interval = seconds / 31536000;

            if (interval >= 1) {
                return Math.floor(interval) + " years";
            }
            interval = seconds / 2592000;
            if (interval >= 1) {
                return Math.floor(interval) + " months";
            }
            interval = seconds / 86400;
            if (interval >= 1) {
                return Math.floor(interval) + " days";
            }
            interval = seconds / 3600;
            if (interval >= 1) {
                return Math.floor(interval) + " hours";
            }
            interval = seconds / 60;
            if (interval >= 1) {
                return Math.floor(interval) + " minutes";
            }
            return Math.floor(seconds) + " seconds";
        }
        function update_messages() {
            var messagesList = document.querySelector("#messages-list");
            var cbAutoscroll = document.querySelector("#cbAutoscroll");
            if (!messagesList || !cbAutoscroll) { return; }
            zubax_api.get_messages(lastIndex + 1).then(
                function (messages) {
                    // Clear messages-list
                    if (document.getElementById("cDeleteOldMessages").checked) {
                        for (const child of messagesList.children) {
                            if (child && child.getAttribute("timestamp")) {
                                var timestamp = child.getAttribute("timestamp");
                                // if timestamp is older than 10 seconds, remove it
                                if (new Date().getTime() - timestamp > 10000) {
                                    messagesList.removeChild(child);
                                }
                            }
                        }
                    }
                    // Add messages to messages-list
                    var messagesObject = JSON.parse(messages);
                    // Make sure that type of d is array
                    console.assert(messagesObject instanceof Array);
                    for (const el of messagesObject) {
                        var li = document.createElement("textarea");
                        li.innerHTML = el.message;
                        // Set an attribute on the list element with current timestamp
                        autosize(li);
                        if (el.internal) {
                            li.style.backgroundColor = "lightgreen !important";
                        }
                        li.setAttribute("timestamp", el.timestamp);
                        li.setAttribute("spellcheck", "false");
                        var date1 = new Date(el.timestamp);
                        li.setAttribute("timeStampReadable", date1.toLocaleTimeString() + " " + date1.getMilliseconds() + "ms");
                        // If el is the last in d
                        if (messagesObject.indexOf(el) == messagesObject.length - 1) {
                            // Scroll to bottom of messages-list

                            var iAutoscrollFilter = document.getElementById("iAutoscrollFilter");
                            if (cbAutoscroll.checked && (iAutoscrollFilter.value == "" || el.includes(iAutoscrollFilter.value))) {
                                messagesList.scrollTop = messagesList.scrollHeight;
                            }
                            lastIndex = el.index;
                        }
                        messagesList.appendChild(li);
                    }
                    showAllMessages();
                    applyExcludingTextFilterToMessage();
                    applyTextFilterToMessages();
                }
            );
        }

        // Call update_messages every second
        setInterval(update_messages, 1000);
        // btnTextOutput.addEventListener('click', function () {
        //     var textOut = document.querySelector("#textOut");
        //     autosize.update(textOut);
        // });
        // var tabTextOut = document.querySelector("#tabTextOut");
        // window.addEventListener('mouseup', function () {
        //     if (tabTextOut.classList.contains("is-active")) {
        //         var textOut = document.querySelector("#textOut");
        //         autosize.update(textOut);
        //     }
        // });

        // Run applyTextFilterToMessages() when there is a change in the filter text after the input has
        // stopped for 0.5 seconds
        var iTextFilter = document.getElementById("iTextFilter");
        var taExcludedKeywords = document.getElementById("taExcludedKeywords");
        var timer = null;
        cbAutoscroll.addEventListener('change', function () {
            if (cbAutoscroll.checked && (iAutoscrollFilter.value == "" || el.includes(iAutoscrollFilter.value))) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        });
        iTextFilter.addEventListener("input", function () {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                applyTextFilterToMessages();
            }, 500);
        });
        var timer2 = null;
        taExcludedKeywords.addEventListener("input", function () {
            if (timer2) {
                clearTimeout(timer2);
            }
            timer2 = setTimeout(function () {
                applyExcludingTextFilterToMessage();
            }, 1000);
        });

        var textOut = document.querySelector("#textOut");
        autosize(textOut);
        var messagesList = document.querySelector("#messages-list");
        // On resize event
        addLocalMessage("Found messageList")
        // at interval of 3 seconds
        messagesListWidth = messagesList.getBoundingClientRect().width

        setInterval(function () {
            var messagesList = document.querySelector("#messages-list");
            if (!messagesList) { return; }
            let currentWidth = messagesList.getBoundingClientRect().width
            if (currentWidth != messagesListWidth) {
                messagesListWidth = currentWidth
                for (const child of messagesList.children) {
                    autosize.update(child);
                }
            }
        }, 500);
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
                                            isClosable: true,
                                            title: 'Monitor',
                                        },
                                        {
                                            type: 'component',
                                            componentName: 'registersComponent',
                                            isClosable: true,
                                            title: 'Registers',
                                        },
                                    ]
                                },
                                {
                                    type: 'component',
                                    height: 15,
                                    componentName: 'statusComponent',
                                    isClosable: true,
                                    title: 'Status',
                                }
                            ]
                        },
                        {
                            type: 'column',
                            width: 30,
                            isClosable: false,
                            content: [
                                {
                                    type: 'stack',
                                    activeItemIndex: 1,
                                    content: [
                                        {
                                            type: 'component',
                                            componentName: 'messagesComponent',
                                            isClosable: true,
                                            title: 'Messages',
                                        },
                                        {
                                            type: "component",
                                            componentName: "transportsComponent",
                                            isClosable: true,
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
        function setUpTransportsComponent(container) {
            initTransports(container, yukon_state);
        }
        const btnAddAnotherTransport = document.getElementById('btnAddAnotherTransport');
        btnAddAnotherTransport.addEventListener('click', function () {
            myLayout.root.contentItems[0].contentItems[0].addChild({
                type: 'component',
                componentName: "transportsComponent",
                isClosable: true,
                title: "Transports",
            });
        });
        const outsideContext = this;
        function addRestoreButton(buttonText, buttonComponentName) {
            const toolbar = document.querySelector("#toolbar");
            const btnRestore = document.createElement("button");
            btnRestore.classList.add("restore-btn");
            btnRestore.innerHTML = buttonText;
            btnRestore.addEventListener('click', function () {
                myLayout.root.contentItems[0].contentItems[0].addChild({
                    type: 'component',
                    componentName: buttonComponentName,
                    isClosable: true,
                    title: buttonText,
                });
                btnRestore.parentElement.removeChild(btnRestore);
            });
            toolbar.appendChild(btnRestore);
        }
        var myLayout = new GoldenLayout(config, document.querySelector("#layout"));
        const btnShowHideToolbar = document.getElementById('btnShowHideToolbar');
        btnShowHideToolbar.addEventListener('click', function () {
            var toolbar = document.getElementById('toolbar');
            if (toolbar.style.display == "none") {
                toolbar.style.display = "flex";
                btnShowHideToolbar.parentElement.removeChild(btnShowHideToolbar);
                btnShowHideToolbar.style.right = "0.5em";
                toolbar.appendChild(btnShowHideToolbar);
                // // A hack
                // document.body.style.overflow = "scroll";
                // setTimeout(function () {
                //     document.body.style.overflow = "hidden";
                // }, 100);
                btnShowHideToolbar.innerHTML = "∧";
            } else {
                // Set the parent of btnShowHideToolbar to the body so that it is not removed when the toolbar is hidden
                // Also set it to position top right
                btnShowHideToolbar.style.top = "-0.5em";
                btnShowHideToolbar.style.right = "3em";
                btnShowHideToolbar.style.bottom = "auto";
                btnShowHideToolbar.parentElement.removeChild(btnShowHideToolbar);
                document.body.appendChild(btnShowHideToolbar);
                toolbar.style.display = "none";
                btnShowHideToolbar.style.zIndex = "1000";
                btnShowHideToolbar.innerHTML = "∨";
            }
            setTimeout(function () {
                myLayout.updateSize();
            }, 50);
        });
        function registerComponentAction(uri, componentName, container, actionWhenCreating) {
            let isDestroyed = true;
            dynamicallyLoadHTML(uri, container, () => {
                if (isDestroyed) {
                    actionWhenCreating();
                    isDestroyed = false;
                }
            }, 100);
            container.on("open", function () {
                container.on("show", function () {
                    if (isDestroyed) {
                        setTimeout(() => {
                            actionWhenCreating();
                            isDestroyed = false;
                        }, 100);
                    }
                });
            });
            container.on("destroy", function () {
                addRestoreButton(container._config.title, componentName);
                isDestroyed = true;
            });
        }
        myLayout.registerComponent('registersComponent', function (container, componentState) {
            registerComponentAction("../registers.panel.html", "registersComponent", container, () => {
                setUpRegistersComponent.bind(outsideContext)(true);
            });
        });
        myLayout.registerComponent('statusComponent', function (container, componentState) {
            registerComponentAction("../status.panel.html", "statusComponent", container, () => {
                setUpStatusComponent.bind(outsideContext)();
            });
        });
        myLayout.registerComponent('monitorComponent', function (container, componentState) {
            registerComponentAction("../monitor.panel.html", "monitorComponent", container, () => {
                setUpMonitorComponent.bind(outsideContext)();
            });
        });
        myLayout.registerComponent('messagesComponent', function (container, componentState) {
            registerComponentAction("../messages.panel.html", "messagesComponent", container, () => {
                setUpMessagesComponent.bind(outsideContext)();
            });
        });
        myLayout.registerComponent('transportsComponent', function (container, componentState) {
            registerComponentAction("../add_transport.panel.html", "transportsComponent", container, () => {
                setUpTransportsComponent.bind(outsideContext)(container);
            });
        });
        myLayout.init();
        yukon_state.zubax_api = zubax_api;
        yukon_state.jsyaml = jsyaml;
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
        // var hideYakut = document.getElementById('hide-yakut');
        // hideYakut.addEventListener('change', async function () {
        //     if (hideYakut.checked) {
        //         await zubax_api.hide_yakut()
        //         await updateTextOut(true);
        //     } else {
        //         await zubax_api.show_yakut()
        //         await updateTextOut(true);
        //     }
        // });
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
