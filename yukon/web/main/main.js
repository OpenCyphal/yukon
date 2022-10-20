import { make_context_menus } from '../modules/context-menu.module.js';
import { create_directed_graph, refresh_graph_layout, update_directed_graph } from '../modules/monitor.module.js';
import { secondsToString, JsonParseHelper, isRunningInElectron, areThereAnyActiveModals } from "../modules/utilities.module.js";
import { loadConfigurationFromOpenDialog, return_all_selected_registers_as_yaml } from '../modules/yaml.configurations.module.js';
import { create_registers_table, update_tables } from '../modules/registers.module.js';
import { get_all_selected_pairs, unselectAll, selectAll, oneSelectedConstraint, moreThanOneSelectedConstraint } from '../modules/registers.selection.module.js';
import { rereadPairs } from "../modules/registers.data.module.js"
import { openFile } from "../modules/yaml.configurations.module.js"
import { initTransports } from "../modules/transports.module.js"
import { copyTextToClipboard } from "../modules/copy.module.js"

(async function () {
    yukon_state.zubax_api = zubax_api;
    if (isRunningInElectron(yukon_state)) {
        zubax_api.announce_running_in_electron();
    } else {
        zubax_api.announce_running_in_browser();
    }
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
        const obj_result = text_result;
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
    function setUpCommandsComponent(container) {
        const containerElement = container.getElement()[0];
        const iNodeId = containerElement.querySelector("#iNodeId");
        const iCommandId = containerElement.querySelector("#iCommandId");
        const sCommands = containerElement.querySelector("#sCommands");
        const iCommandArgument = containerElement.querySelector("#iCommandArgument");
        const btnSendCommand = containerElement.querySelector("#btnSendCommand");
        const feedbackMessage = containerElement.querySelector(".feedback-message");
        sCommands.addEventListener("change", function (event) {
            // Get the selected option and take the attribute data-command-id from it
            const selectedOptionValue = sCommands.value;
            let selectedOptionElement = null;
            // For every child of sCommands that is an OPTION element
            for (let i = 0; i < sCommands.childNodes.length; i++) {
                const element = sCommands.childNodes[i];
                if (element.value == selectedOptionValue) {
                    selectedOptionElement = element;
                    break;
                }
            }
            if (selectedOptionElement) {
                if (selectedOptionElement.getAttribute("data-has-arguments") == "true") {
                    iCommandArgument.removeAttribute("disabled")
                } else {
                    iCommandArgument.setAttribute("disabled", "")
                }
                iCommandId.value = selectedOptionElement.getAttribute("data-command-id");
            } else {
                console.error("Didn't find the element for " + selectedOptionValue);
            }
        });
        function disableOrEnableArguments() {
            const children = sCommands.children;
            let matchedAny = false;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                // If the tag of the child element is option
                if (child.tagName == "OPTION") {
                    if (child.getAttribute("data-command-id") === iCommandId.value) {
                        matchedAny = true;
                        if (child.getAttribute("data-has-arguments") == "true") {
                            iCommandArgument.removeAttribute("disabled")
                        } else {
                            iCommandArgument.setAttribute("disabled", "")
                        }
                        break;
                    }
                }
            }
            if (!matchedAny) {
                iCommandArgument.removeAttribute("disabled");
            }
        }
        // When the input text in iCommandId is changed, see if the id corresponds to any of the command-ids specified in data-command-ids of any of the options in sCommand
        iCommandId.addEventListener("input", function (event) {
            // For all children of sCommands that are options
            disableOrEnableArguments();
        });
        btnSendCommand.addEventListener("click", async function (event) {
            const result = await zubax_api.send_command(iNodeId.value, iCommandId.value, iCommandArgument.value);
            if (result.message == undefined) {
                result.message = "No response.";
            }
            if (!result.success) {
                feedbackMessage.classList.remove("success");
                feedbackMessage.style.display = "block";
                feedbackMessage.innerHTML = result.message;
            } else {
                feedbackMessage.classList.add("success");
                feedbackMessage.style.display = "block";
                feedbackMessage.innerHTML = result.message;
            }

        });
    }
    function setUpStatusComponent() {
        async function update_avatars_table() {
            await update_avatars_dto();
            var table_body = document.querySelector('#avatars_table tbody');
            table_body.innerHTML = "";
            if (yukon_state.current_avatars.length == 0) {
                table_body.innerHTML = "No data, connect a transport from the panel on the right side."
                return;
            }
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

    function setUpTransportsListComponent() {
        let lastTransportsListHash = 0;
        async function syncList() {
            const transportsList = document.querySelector('#transports_list');
            const received_transport_interfaces_string = await zubax_api.get_connected_transport_interfaces();
            const received_transport_interfaces_object = JSON.parse(received_transport_interfaces_string, JsonParseHelper);
            if (received_transport_interfaces_object.hash == lastTransportsListHash) {
                return;
            }
            transportsList.innerHTML = "";
            lastTransportsListHash = received_transport_interfaces_object.hash;
            const received_transport_interfaces = received_transport_interfaces_object.interfaces;
            for (const _interface of received_transport_interfaces) {
                const transport_interface = document.createElement('div');
                transport_interface.classList.add('transport_interface');
                // Add a div for the name of the interface
                const name = document.createElement('P');
                name.innerHTML = JSON.stringify(_interface);
                transport_interface.appendChild(name);
                // Add a button to remove the interface
                const remove_button = document.createElement('button');
                remove_button.innerHTML = "Remove";
                remove_button.addEventListener('click', async () => {
                    await zubax_api.detach_transport(_interface.hash);
                    await syncList();
                });
                transport_interface.appendChild(remove_button);
                transportsList.appendChild(transport_interface);
            }
        }
        setInterval(syncList, 1000);
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
        btnImportRegistersConfig.addEventListener('click', async function (click_event) {
            loadConfigurationFromOpenDialog(false, yukon_state, click_event)
        });
    }
    function setUpDebugTextOutComponent() {
        let isRefreshTextOutAllowed = true;
        async function updateTextOut(refresh_anyway = false) {
            if (!isRefreshTextOutAllowed && !refresh_anyway) { return; }
            const avatars = await zubax_api.get_avatars()
            const textOut = document.querySelector("#textOut");
            const DTO = JSON.parse(avatars, JsonParseHelper);
            if (DTO.hash != yukon_state.lastHash || refresh_anyway) {
                yukon_state.lastHash = DTO.hash;
                textOut.innerHTML = JSON.stringify(DTO.avatars, null, 4)
            }
            // Parse avatars as json
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
    async function setUpMessagesComponent(container) {

        const containerElement = container.getElement()[0];
        var messagesList = document.querySelector("#messages-list");
        const optionsPanel = await waitForElm(".options-panel");
        function setDisplayState() {
            if (containerElement.getAttribute("data-isexpanded")) {
                containerElement.scrollTop = 0;
                cbAutoscroll.checked = false;
                optionsPanel.style.display = "block";
            } else {
                optionsPanel.style.display = "none";
            }
        }
        setDisplayState();
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === "attributes") {
                    if (mutation.attributeName === "data-isexpanded") {
                        // Toggle visibility of options panel
                        setDisplayState();
                    }
                }
            });
        });

        observer.observe(containerElement, {
            attributes: true //configure it to listen to attribute changes
        });
        var cbShowTimestamp = await waitForElm('#cbShowTimestamp');
        const sLogLevel = document.querySelector("#sLogLevel");
        sLogLevel.addEventListener("change", async () => {
            await zubax_api.set_log_level(sLogLevel.value);
        });
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
        //        function fetchAndDisplayMessages() {
        //            zubax_api.get_messages(lastMessageIndex + 1).then(function (messages) {
        //                var messagesObject = JSON.parse(messages, JsonParseHelper);
        //                for (const message of messagesObject) {
        //                    displayOneMessage(message.message);
        //                    // For the last message
        //                    if (message == messagesObject[messagesObject.length - 1]) {
        //                        lastMessageIndex = message.index;
        //                    }
        //                }
        //            });
        //        }
        //        setInterval(fetchAndDisplayMessages, 1000);
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
                            setTimeout(function () {
                                var iAutoscrollFilter = document.getElementById("iAutoscrollFilter");
                                if (cbAutoscroll.checked && (iAutoscrollFilter.value == "" || el.includes(iAutoscrollFilter.value))) {
                                    containerElement.scrollTop = containerElement.scrollHeight;
                                }
                            }, 50);
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
        addLocalMessage("Found messageList");
        // at interval of 3 seconds
        messagesListWidth = messagesList.getBoundingClientRect().width;

        setInterval(function () {
            var messagesList = document.querySelector("#messages-list");
            if (!messagesList) { return; }
            let currentWidth = messagesList.getBoundingClientRect().width;
            if (currentWidth != messagesListWidth) {
                messagesListWidth = currentWidth;
                for (const child of messagesList.children) {
                    autosize.update(child);
                }
            }
        }, 500);
    }
    yukon_state.addLocalMessage = function (message) {
        zubax_api.add_local_message(message);
    }
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
                                    type: "stack",
                                    content: [
                                        {
                                            type: 'component',
                                            componentName: 'messagesComponent',
                                            isClosable: true,
                                            doesRequireSettingsButton: true,
                                            title: 'Messages',
                                        },
                                        {
                                            type: 'component',
                                            height: 15,
                                            componentName: 'statusComponent',
                                            isClosable: true,
                                            title: 'Status',
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            type: 'column',
                            width: 30,
                            content: [
                                {
                                    type: 'stack',
                                    activeItemIndex: 0,
                                    content: [
                                        {
                                            type: "component",
                                            componentName: "transportsComponent",
                                            isClosable: true,
                                            title: "Transports",
                                        },
                                        {
                                            type: "component",
                                            componentName: "commandsComponent",
                                            isClosable: true,
                                            title: "Commands",
                                        }
                                    ]
                                },
                                {
                                    type: "component",
                                    componentName: "transportsListComponent",
                                    isClosable: true,
                                    title: "Transports list",
                                },
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
        function addComponentToLayout(componentName, componentText) {
            const addedComponent = {
                type: 'component',
                componentName: componentName,
                isClosable: true,
                title: componentText,
            };
            try {
                yukon_state.myLayout.root.contentItems[0].addChild(addedComponent);
            } catch (e) {
                console.log(e);
                yukon_state.myLayout.root.addChild(addedComponent);
            }
        }
        const outsideContext = this;
        function addRestoreButton(buttonText, buttonComponentName) {
            const toolbar = document.querySelector("#toolbar");
            const btnRestore = document.createElement("button");
            btnRestore.classList.add("restore-btn");
            btnRestore.innerHTML = buttonText;
            btnRestore.addEventListener('click', function () {
                addComponentToLayout(buttonComponentName, buttonText);
                btnRestore.parentElement.removeChild(btnRestore);
            });
            toolbar.appendChild(btnRestore);
        }
        function initalizeLayout() {
            let hadPreviousLayout = false;
            if (typeof yukon_state.myLayout !== 'undefined') {
                try {
                    hadPreviousLayout = true;
                    yukon_state.myLayout.destroy();
                } catch (e) {
                    console.log(e);
                }
            }
            let requiredTimeout = 0;
            if (hadPreviousLayout) {
                requiredTimeout = 3;
            }
            setTimeout(function () {
                yukon_state.myLayout = new GoldenLayout(config, document.querySelector("#layout"));
                var myLayout = yukon_state.myLayout;
                myLayout.registerComponent('registersComponent', function (container, componentState) {
                    registerComponentAction("../registers.panel.html", "registersComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpRegistersComponent.bind(outsideContext)(true);
                    });
                });
                myLayout.registerComponent('statusComponent', function (container, componentState) {
                    registerComponentAction("../status.panel.html", "statusComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpStatusComponent.bind(outsideContext)();
                    });
                });
                myLayout.registerComponent('monitorComponent', function (container, componentState) {
                    registerComponentAction("../monitor.panel.html", "monitorComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpMonitorComponent.bind(outsideContext)();
                    });
                });
                myLayout.registerComponent('messagesComponent', function (container, componentState) {
                    registerComponentAction("../messages.panel.html", "messagesComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpMessagesComponent.bind(outsideContext)(container);
                    });
                });
                myLayout.registerComponent('transportsComponent', function (container, componentState) {
                    registerComponentAction("../transport.panel.html", "transportsComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpTransportsComponent.bind(outsideContext)(container);
                    });
                });
                myLayout.registerComponent("transportsListComponent", function (container, componentState) {
                    registerComponentAction("../transports_list.panel.html", "transportsListComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpTransportsListComponent.bind(outsideContext)();
                    });
                });
                myLayout.registerComponent("commandsComponent", function (container, componentState) {
                    registerComponentAction("../commands.panel.html", "transportsListComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpCommandsComponent.bind(outsideContext)(container);
                    });
                });
                const useSVG = true;
                let caretDownImgSrc = null;
                let caretUpImgSrc = null;
                if (useSVG) {
                    caretDownImgSrc = "../images/caret-down.svg";
                    caretUpImgSrc = "../images/caret-up.svg";
                    caretDownImgSrc = "../images/gear.svg";
                    caretUpImgSrc = "../images/gear.svg";
                } else {
                    caretDownImgSrc = "../images/caret-down-18-18.png";
                    caretUpImgSrc = "../images/caret-up-18-18.png";
                }

                myLayout.on('stackCreated', function (stack) {
                    console.log("Stack:", stack);
                    //HTML for the colorDropdown is stored in a template tag
                    const btnPanelShowHideToggle = document.createElement("li");
                    btnPanelShowHideToggle.setAttribute("id", "btn-panel-show-hide-yakut");
                    const caretDownImageElement = document.createElement("img");
                    // Make sure it has 100% width and height
                    caretDownImageElement.setAttribute("width", "100%");
                    caretDownImageElement.setAttribute("height", "100%");
                    caretDownImageElement.setAttribute("src", caretDownImgSrc);
                    btnPanelShowHideToggle.appendChild(caretDownImageElement);
                    const caretUpImageElement = document.createElement("img");
                    // Make sure it has 100% width and height
                    caretUpImageElement.setAttribute("width", "100%");
                    caretUpImageElement.setAttribute("height", "100%");
                    caretUpImageElement.setAttribute("src", caretUpImgSrc);
                    btnPanelShowHideToggle.appendChild(caretUpImageElement);
                    btnPanelShowHideToggle.addEventListener("click",
                        function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            const container = stack.getActiveContentItem().container.getElement()[0];
                            // Use the data-isExpanded attribute and toggle it
                            if (container.getAttribute("data-isExpanded") == "true") {
                                container.removeAttribute("data-isExpanded");
                            } else {
                                container.setAttribute("data-isExpanded", "true");
                            }
                            const isExpanded = container.getAttribute("data-isExpanded");
                            if (isExpanded) {
                                caretDownImageElement.style.display = "none";
                                caretUpImageElement.style.display = "block";
                            } else {
                                caretDownImageElement.style.display = "block";
                                caretUpImageElement.style.display = "none";
                            }
                        }
                    );
                    // Add the btnPanelShowHideToggle to the header
                    stack.header.controlsContainer.prepend(btnPanelShowHideToggle);
                    stack.on('activeContentItemChanged', function (contentItem) {
                        const activeElementName = stack.getActiveContentItem().config.componentName;
                        console.log("Active element changed to " + activeElementName);
                        const requiresSettingsButton = stack.getActiveContentItem().config.hasOwnProperty("doesRequireSettingsButton") && stack.getActiveContentItem().config.doesRequireSettingsButton == true;
                        if (!requiresSettingsButton) {
                            btnPanelShowHideToggle.style.display = "none";
                        } else {
                            btnPanelShowHideToggle.style.display = "block";
                        }
                        console.log(activeElementName + " requires settings button: " + requiresSettingsButton);
                        const container = stack.getActiveContentItem().container.getElement()[0];
                        // If the key "isExpanded" is not contained in the state of the container

                        const isExpanded = container.getAttribute("data-isExpanded");
                        if (isExpanded) {
                            caretDownImageElement.style.display = "none";
                            caretUpImageElement.style.display = "block";
                        } else {
                            caretDownImageElement.style.display = "block";
                            caretUpImageElement.style.display = "none";
                        }
                    });
                });
                myLayout.init();
            }, requiredTimeout);
        } // initializeLayout
        initalizeLayout();
        btnRestoreDefaultLayout.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            yukon_state.is_currently_restoring_default_layout = true;
            initalizeLayout();
            setTimeout(function () {
                yukon_state.is_currently_restoring_default_layout = false;
            }, 3000);
        });
        const btnShowHideToolbar = document.getElementById('btnShowHideToolbar');
        btnShowHideToolbar.addEventListener('click', function () {
            const toolbar = document.getElementById('toolbar');
            const compStyles = window.getComputedStyle(toolbar);
            const displayStyle = compStyles.getPropertyValue('display');
            if (displayStyle === "none") {
                toolbar.classList.add("shown");
                btnShowHideToolbar.classList.add("bottom-right");
                btnShowHideToolbar.classList.remove("top-right");
                btnShowHideToolbar.parentElement.removeChild(btnShowHideToolbar);
                toolbar.appendChild(btnShowHideToolbar);
            } else {
                // Set the parent of btnShowHideToolbar to the body so that it is not removed when the toolbar is hidden
                // Also set it to position top right
                btnShowHideToolbar.parentElement.removeChild(btnShowHideToolbar);
                document.body.appendChild(btnShowHideToolbar);
                toolbar.classList.remove("shown");
                btnShowHideToolbar.classList.add("top-right");
                btnShowHideToolbar.classList.remove("bottom-right");
            }
            setTimeout(function () {
                yukon_state.myLayout.updateSize();
            }, 50);
        });
        window.addEventListener("resize", () => {
            console.log("resize event");
            setTimeout(function () {
                yukon_state.myLayout.updateSize();
            }, 50);
        });
        document.querySelector("#layout").addEventListener("resize", () => {
            setTimeout(function () {
                yukon_state.myLayout.updateSize();
            }, 50);
        });
        let last_time_when_a_window_was_opened = null;
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
                try {
                    const lastOpenPopoutsLength = yukon_state.myLayout.openPopouts.length;
                    setTimeout(() => {
                        // The popout event is not fired, I believe it is a bug in GoldenLayout
                        //                    if(last_time_when_a_window_was_opened != null && Date.now() - last_time_when_a_window_was_opened < 100) {
                        //                        return;
                        //                    }
                        if (lastOpenPopoutsLength < yukon_state.myLayout.openPopouts.length) {
                            console.log("Not making a restore button because a popout was opened");
                            return;
                        }
                        if (yukon_state.is_currently_restoring_default_layout) {
                            return;
                        }
                        addRestoreButton(container._config.title, componentName);
                        isDestroyed = true;
                    }, 1000);
                } catch (e) {
                    console.error(e);
                }

            });
        }
        let containerElementToContainerObjectMap = new WeakMap();

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
            yukon_state.pressedKeys[18] = false;
        });
        window.addEventListener('blur', function () {
            yukon_state.pressedKeys[18] = false;
        });
        var mousePos;

        document.onmousemove = handleMouseMove;

        function handleMouseMove(event) {
            var dot, eventDoc, doc, body, pageX, pageY;

            event = event || window.event; // IE-ism

            // If pageX/Y aren't available and clientX/Y are,
            // calculate pageX/Y - logic taken from jQuery.
            // (This is to support old IE)
            if (event.pageX == null && event.clientX != null) {
                eventDoc = (event.target && event.target.ownerDocument) || document;
                doc = eventDoc.documentElement;
                body = eventDoc.body;

                event.pageX = event.clientX +
                    (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                    (doc && doc.clientLeft || body && body.clientLeft || 0);
                event.pageY = event.clientY +
                    (doc && doc.scrollTop || body && body.scrollTop || 0) -
                    (doc && doc.clientTop || body && body.clientTop || 0);
            }

            mousePos = {
                x: event.pageX,
                y: event.pageY
            };
        }
        window.onkeydown = async function (e) {
            // If alt tab was pressed return
            yukon_state.pressedKeys[e.keyCode] = true;
            // If ctrl a was pressed, select all
            if (yukon_state.pressedKeys[17] && yukon_state.pressedKeys[65]) {
                if (areThereAnyActiveModals(yukon_state)) {
                    // The modal should handle its own copy and paste events (natively)
                    return;
                }
                selectAll(yukon_state);
                e.preventDefault();
            }
            // If ctrl c was pressed
            if (yukon_state.pressedKeys[17] && yukon_state.pressedKeys[67]) {
                if (areThereAnyActiveModals(yukon_state)) {
                    // The modal should handle its own copy and paste events (natively)
                    return;
                }
                // If there are any cells selected
                // If there aren't any cells selected then get the element that the mouse is hovering over and copy its value
                if (oneSelectedConstraint() || moreThanOneSelectedConstraint()) {
                    let pairs = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": false, "only_of_register_name": null }, yukon_state);
                    const yaml_text = await return_all_selected_registers_as_yaml(pairs, yukon_state);
                    copyTextToClipboard(yaml_text, e);
                    e.stopPropagation();
                } else {
                    console.log("Just copying from under the mouse")
                    let element = document.elementFromPoint(mousePos.x, mousePos.y);
                    const copyTextOfElement = function (element, event) {
                        copyTextToClipboard(element.innerText, event);
                        const previousText = element.innerHTML;
                        element.innerHTML = "Copied!";
                        setTimeout(function () {
                            if (element.innerHTML == "Copied!") {
                                element.innerHTML = previousText;
                            }
                        }, 700);
                    }
                    if (element.classList.contains("input") || element.classList.contains("left-side-table-header")) {
                        copyTextOfElement(element, e);
                        return;
                    }
                    // Check if any child of the element has the class input
                    let inputElement = element.querySelector(".input") || element.querySelector(".left-side-table-header");
                    if (inputElement) {
                        console.log("A child had the class");
                        copyTextOfElement(element, e);
                        return;
                    }
                }
            }
            // If ctrl space was pressed, toggle maximize-minimize of the currently hovered over ContentItem
            if (yukon_state.pressedKeys[17] && yukon_state.pressedKeys[32]) {
                const elementOn = document.elementFromPoint(mousePos.x, mousePos.y);
                if (elementOn == null) {
                    return;
                }
                // Start navigating up through parents (ancestors) of elementOn, until one of the parents has the class lm_content
                let currentElement = elementOn
                while (elementOn != document.body) {
                    if (currentElement.parentElement == null) {
                        return;
                    }
                    if (currentElement.classList.contains("lm_content")) {
                        break;
                    } else {
                        currentElement = currentElement.parentElement;
                    }
                }
                // Now we need every initialization of a panel to keep adding to a global dictionary where they have keys as the actual html element and the value is the golden-layout object
                let containerObject = null;
                if (containerElementToContainerObjectMap.has(currentElement)) {
                    containerObject = containerElementToContainerObjectMap.get(currentElement);
                }
                containerObject.parent.parent.toggleMaximise();
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
                    let deserialized_messages = JSON.parse(received_messages, JsonParseHelper);
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
