import { make_context_menus } from '../modules/context-menu.module.js';
import { create_directed_graph, refresh_graph_layout, update_directed_graph } from '../modules/monitor.module.js';
import { secondsToString, JsonParseHelper, isRunningInElectron, areThereAnyActiveModals, getKnownDatatypes, waitForElm } from "../modules/utilities.module.js";
import { loadConfigurationFromOpenDialog, return_all_selected_registers_as_yaml } from '../modules/yaml.configurations.module.js';
import { create_registers_table, update_tables } from '../modules/registers.module.js';
import { get_all_selected_pairs, unselectAll, selectAll, oneSelectedConstraint, moreThanOneSelectedConstraint } from '../modules/registers.selection.module.js';
import { rereadPairs } from "../modules/registers.data.module.js"
import { openFile } from "../modules/yaml.configurations.module.js"
import { initTransports } from "../modules/panels/transports.module.js"
import { copyTextToClipboard } from "../modules/copy.module.js"
import { setUpStatusComponent } from "../modules/panels/status.module.js"
import { setUpTransportsListComponent } from "../modules/panels/transports-list.module.js"
import { setUpCommandsComponent } from "../modules/panels/commands.module.js"
import { update_avatars_dto } from "../modules/data.module.js"
import { setUpMessagesComponent } from "../modules/panels/messages.module.js"
import { setUpRegisterUpdateLogComponent } from "../modules/panels/register_update_log.module.js"
import { layout_config } from "../modules/panels/_layout_config.module.js"

(async function () {
    yukon_state.zubax_api = zubax_api;
    yukon_state.zubax_apij = zubax_apij;
    yukon_state.autosize = autosize;
    yukon_state.navigator = window.navigator;
    yukon_state.jsyaml = jsyaml;
    if (isRunningInElectron(yukon_state)) {
        zubax_api.announce_running_in_electron();
    } else {
        zubax_api.announce_running_in_browser();
    }

    function setUpMonitorComponent() {
        yukon_state.my_graph = create_directed_graph(yukon_state);
        async function get_and_display_avatars() {
            await update_avatars_dto(yukon_state);
            update_directed_graph(yukon_state);
        }

        setInterval(get_and_display_avatars, 3000);
        update_directed_graph(yukon_state);
    }

    async function setUpSubscriptionsComponent(container) {
        const containerElement = container.getElement()[0];
        const iSelectDatatype = containerElement.querySelector('#iSelectDatatype');
        const iSubjectId = containerElement.querySelector('#iSubjectId');
        const btnSubscribeToSubject = containerElement.querySelector('#btnSubscribeToSubject');
        const iSelectAny = containerElement.querySelector('#iSelectAny');
        const iSelectFixedIdMessageType = containerElement.querySelector('#iSelectFixedIdMessageType');
        const iFixedIdSubscriptionNodeId = containerElement.querySelector('#iFixedIdSubscriptionNodeId');
        const divMessagesHere = containerElement.querySelector('#divMessagesHere');
        const btnRefresh1 = containerElement.querySelector('#btnRefresh1');
        const btnRefresh2 = containerElement.querySelector('#btnRefresh2');
        const btnRefresh3 = containerElement.querySelector('#btnRefresh3');
        const rbUseSelectAdvertised = containerElement.querySelector('#rbUseSelectAdvertised');
        const rbUseSelectFixedId = containerElement.querySelector('#rbUseSelectFixedId');
        const rbUseSelectAny = containerElement.querySelector('#rbUseSelectAny');
        function getCurrentDesiredDatatype() {
            if (rbUseSelectAdvertised.checked) {
                return iSelectDatatype.value;
            } else if (rbUseSelectFixedId.checked) {
                return iSelectFixedIdMessageType.value;
            } else if (rbUseSelectAny.checked) {
                return iSelectAny.value;
            } else {
                return null;
            }
        }
        // If any of the rbUseSelect* radio buttons is clicked, we need to disabled the other two
        // and enable the one that was clicked.
        const rbUseSelectAdvertisedClickHandler = () => {
            iSelectDatatype.disabled = false;
            iSubjectId.disabled = false;
            iSelectAny.disabled = true;
            iSelectFixedIdMessageType.disabled = true;
            iFixedIdSubscriptionNodeId.disabled = true;
        };
        const rbUseSelectFixedIdClickHandler = () => {
            iSelectDatatype.disabled = true;
            iSubjectId.disabled = true;
            iSelectAny.disabled = true;
            iSelectFixedIdMessageType.disabled = false;
            iFixedIdSubscriptionNodeId.disabled = false;
        };
        const rbUseSelectAnyClickHandler = () => {
            iSelectDatatype.disabled = true;
            iSubjectId.disabled = false;
            iSelectAny.disabled = false;
            iSelectFixedIdMessageType.disabled = true;
            iFixedIdSubscriptionNodeId.disabled = true;
        };
        rbUseSelectAdvertised.addEventListener('click', rbUseSelectAdvertisedClickHandler);
        rbUseSelectFixedId.addEventListener('click', rbUseSelectFixedIdClickHandler);
        rbUseSelectAny.addEventListener('click', rbUseSelectAnyClickHandler);
        rbUseSelectAdvertised.click();

        // When the rbUseSelectFixedId radio button is clicked, we need to unhide 

        btnRefresh1.addEventListener('click', refreshKnownDatatypes);
        btnRefresh2.addEventListener('click', refreshKnownDatatypes);
        btnRefresh3.addEventListener('click', refreshKnownDatatypes);
        async function refreshKnownDatatypes() {
            // Flash all buttons btnRefresh1, btnRefresh2, btnRefresh3 with text "Refreshing..."
            const btns = [btnRefresh1, btnRefresh2, btnRefresh3];
            btns.forEach(btn => {
                btn.innerHTML = 'Refreshing...';
                btn.disabled = true;
                // If the buttons are still disabled after 5 seconds, we assume that the refresh failed.
                setTimeout(() => {
                    if (btn.disabled) {
                        btn.innerHTML = 'Refresh failed';
                        setTimeout(() => {
                            btn.innerHTML = 'Refresh';
                            btn.disabled = false;
                        }, 1200);
                    }
                }, 3000);
            });
            const knownDatatypes = getKnownDatatypes(yukon_state);
            const response = await yukon_state.zubax_apij.get_known_datatypes_from_dsdl();
            iSelectDatatype.innerHTML = '';
            iSelectAny.innerHTML = '';
            iSelectFixedIdMessageType.innerHTML = '';
            for (const datatype of knownDatatypes) {
                // Add a new option to the select
                const option = document.createElement('option');
                option.value = datatype;
                option.innerHTML = datatype;
                iSelectDatatype.appendChild(option);
            }
            for (const id in response["fixed_id_messages"]) {
                const datatype_short = response["fixed_id_messages"][id]["short_name"];
                const datatype_full = response["fixed_id_messages"][id]["full_name"];
                // Add a new option to the select
                const option = document.createElement('option');
                option.innerHTML = datatype_short + "(" + id + ")";
                option.value = datatype_full;
                iSelectFixedIdMessageType.appendChild(option);
            }
            for (const datatype of response["variable_id_messages"]) {
                // Add a new option to the select
                const option = document.createElement('option');
                option.value = datatype;
                option.innerHTML = datatype;
                iSelectAny.appendChild(option);
            }
            btns.forEach(btn => {
                btn.innerHTML = 'Refreshed';
                btn.disabled = true;
            });
            setTimeout(() => {
                btns.forEach(btn => {
                    btn.innerHTML = 'Refresh';
                    btn.disabled = false;
                });
            }, 1200);
        }
        setTimeout(refreshKnownDatatypes, 3000);
        btnSubscribeToSubject.addEventListener('click', async () => {
            const selectedDatatype = getCurrentDesiredDatatype();
            if (!selectedDatatype) {
                // Flash the btnSubscribeToSubject red without using bootstrap
                btnSubscribeToSubject.style.backgroundColor = "red";
                setTimeout(() => {
                    btnSubscribeToSubject.style.backgroundColor = "";
                }, 1000);
                return;
            }
            let desiredSubjectIdValue = iSubjectId.value;
            if (desiredSubjectIdValue == "") {
                desiredSubjectIdValue = null;
            }
            const subscription = await zubax_apij.subscribe(desiredSubjectIdValue, selectedDatatype);
            if (!subscription || !subscription.success) {
                // Flash the btnSubscribeToSubject red without using bootstrap
                btnSubscribeToSubject.style.backgroundColor = "red";
                setTimeout(() => {
                    btnSubscribeToSubject.style.backgroundColor = "";
                }, 1000);
                return;
            }
            yukon_state.subscriptions[subscription.subject_id + ":" + subscription.datatype] = [];
            const current_messages = yukon_state.subscriptions[subscription.subject_id + ":" + subscription.datatype];
            // Add a div to the parent of btnSubscribeToSubject
            const div = document.createElement('div');
            div.classList.add('card');
            div.classList.add('m-1');
            div.id = "divSubscription" + subscription.subject_id + ":" + subscription.datatype;
            divMessagesHere.appendChild(div);
            // Add a h5/
            const h5 = document.createElement('h5');
            h5.classList.add('card-header');
            if (subscription.subject_id == null) {
                h5.innerHTML = "A subscription to " + subscription.datatype;
            } else {
                h5.innerHTML = "A subscription to " + subscription.subject_id;
            }
            div.appendChild(h5);
            // Add another div in div, to display the latest message
            /*
                <div class="card">
                    <h5 class="card-header">Featured</h5>
                    <div class="card-body">
                        <h5 class="card-title">Special title treatment</h5>
                        <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
                        <a href="#" class="btn btn-primary">Go somewhere</a>
                    </div>
                </div>
            */
            const divLatestMessage = document.createElement('div');
            divLatestMessage.classList.add('card-body');
            // Add an h5 with subject_id and datatype
            const h5LatestMessage = document.createElement('h5');
            h5LatestMessage.classList.add('card-title');
            if (subscription.subject_id == null) {
                h5LatestMessage.innerHTML = subscription.datatype;
            } else {
                h5LatestMessage.innerHTML = subscription.subject_id + ":" + subscription.datatype;
            }
            divLatestMessage.appendChild(h5LatestMessage);
            // Add a p with the latest message
            const pLatestMessage = document.createElement('p');
            pLatestMessage.classList.add('card-text');
            pLatestMessage.innerHTML = "No messages received yet";
            pLatestMessage.id = "divLatestMessage" + subscription.subject_id + ":" + subscription.datatype;
            divLatestMessage.appendChild(pLatestMessage);
            div.appendChild(divLatestMessage);
            async function fetch() {
                const full_specifiers = [desiredSubjectIdValue + ":" + selectedDatatype + ":" + current_messages.length];
                const result = await yukon_state.zubax_apij.fetch_messages_for_subscription_specifiers(JSON.stringify(full_specifiers));
                const messages = result[Object.keys(result)[0]]
                for (const message of messages) {
                    current_messages.push(message);
                }
                pLatestMessage.innerHTML = JSON.stringify(current_messages[current_messages.length - 1]);
            }
            setInterval(fetch, 300);
            // Add a button for removing the subscription
            const btnRemoveSubscription = document.createElement('button');
            btnRemoveSubscription.classList.add('btn');
            btnRemoveSubscription.classList.add('btn-danger');
            btnRemoveSubscription.innerHTML = "Remove subscription";
            btnRemoveSubscription.addEventListener('click', async () => {
                const result = await yukon_state.zubax_apij.unsubscribe(subscription.subject_id, selectedDatatype);
                if (result.success) {
                    div.remove();
                } else {
                    // Flash the btnRemoveSubscription disabled
                    btnRemoveSubscription.disabled = true;
                    setTimeout(() => {
                        btnRemoveSubscription.disabled = false;
                    });
                }
            });
            div.appendChild(btnRemoveSubscription);
        });
    }
    async function setUpRegistersComponent(immediateCreateTable) {
        if (immediateCreateTable) {
            await update_avatars_dto(yukon_state);
            update_tables(true);
        }
        setInterval(async () => {
            await update_avatars_dto(yukon_state);
            update_tables();
        }, 893);
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

    yukon_state.addLocalMessage = function (message, severity) {
        zubax_api.add_local_message(message, severity);
    }
    const addLocalMessage = yukon_state.addLocalMessage;
    async function doStuffWhenReady() {
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
                yukon_state.myLayout = new GoldenLayout(layout_config, document.querySelector("#layout"));
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
                        setUpStatusComponent.bind(outsideContext)(yukon_state);
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
                        setUpMessagesComponent.bind(outsideContext)(container, yukon_state);
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
                        setUpTransportsListComponent.bind(outsideContext)(yukon_state);
                    });
                });
                myLayout.registerComponent("commandsComponent", function (container, componentState) {
                    registerComponentAction("../commands.panel.html", "transportsListComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpCommandsComponent.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent("registerUpdateLogComponent", function (container, componentState) {
                    registerComponentAction("../register_update_log.html", "registerUpdateLogComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpRegisterUpdateLogComponent.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent("subsComponent", function (container, componentState) {
                    registerComponentAction("../subscriptions.panel.html", "subsComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        containerElementToContainerObjectMap.set(containerElement, container);
                        setUpSubscriptionsComponent.bind(outsideContext)(container);
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
            setTimeout(function () {
                yukon_state.is_currently_restoring_default_layout = false;
            }, 3000);
            initalizeLayout();
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
                console.log("Updated layout size")
            }, 60);
        });
        const btnUpdateLayoutSize = document.getElementById('btnUpdateLayoutSize');
        btnUpdateLayoutSize.addEventListener('click', function () {
            yukon_state.myLayout.updateSize();
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
                    const selectedCells = document.querySelectorAll(".selected-cell .input")
                    for (let i = 0; i < selectedCells.length; i++) {
                        const selectedCell = selectedCells[i];
                        const previousText = selectedCell.innerHTML;
                        selectedCell.innerHTML = "Generating yaml!";
                        setTimeout(function () {
                            if (selectedCell.innerHTML == "Copied!" || selectedCell.innerHTML == "Generating yaml!" || selectedCell.innerHTML == "Copy failed!") {
                                selectedCell.innerHTML = previousText;
                            }
                        }, 1000);
                    }
                    const yaml_text = await return_all_selected_registers_as_yaml(pairs, yukon_state);

                    const didCopySucceed = await copyTextToClipboard(yaml_text, e);
                    if (!didCopySucceed) {
                        for (let i = 0; i < selectedCells.length; i++) {
                            const selectedCell = selectedCells[i];
                            selectedCell.innerHTML = "Copy failed!";
                        }
                        addLocalMessage("Please make sure to click on the Yukon window somewhere to focus the window when a copy fails.", 40)
                    }
                    for (let i = 0; i < selectedCells.length; i++) {
                        const selectedCell = selectedCells[i];
                        selectedCell.innerHTML = "Copied!";
                    }

                    // Change the text of each selected cell to Copied!

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
                        copyTextOfElement(inputElement, e);
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
        addLocalMessage("Error: " + e, 40);
        console.error(e);
    }
})();
