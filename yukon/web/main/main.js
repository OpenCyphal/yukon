import { make_context_menus } from '../modules/context-menu.module.js';
import { create_directed_graph, update_directed_graph } from '../modules/panels/monitor.module.js';
import {
    isRunningInElectron,
    areThereAnyActiveModals,
    getHoveredContainerElementAndContainerObject,
    getHoveredClass
} from "../modules/utilities.module.js";
import {
    loadConfigurationFromOpenDialog,
    return_all_selected_registers_as_yaml
} from '../modules/yaml.configurations.module.js';
import { setUpRegistersComponent } from '../modules/panels/registers.module.js';
import {
    get_all_selected_pairs,
    unselectAll,
    selectAll,
    oneSelectedConstraint,
    moreThanOneSelectedConstraint
} from '../modules/panels/registers.selection.module.js';
import { rereadPairs } from "../modules/panels/registers.data.module.js"
import { initTransports } from "../modules/panels/transports.module.js"
import { copyTextToClipboard } from "../modules/copy.module.js"
import { setUpStatusComponent } from "../modules/panels/status.module.js"
import { setUpTransportsListComponent } from "../modules/panels/transports-list.module.js"
import { setUpCommandsComponent } from "../modules/panels/commands.module.js"
import { update_avatars_dto } from "../modules/data.module.js"
import { setUpMessagesComponent } from "../modules/panels/messages.module.js"
import { setUpRegisterUpdateLogComponent } from "../modules/panels/register_update_log.module.js"
import { setUpSubscriptionsComponent } from "../modules/panels/subscriptions.module.js"
import { layout_config } from "../modules/panels/_layout_config.module.js"
import { setUpSettingsComponent } from "../modules/panels/settings.module.js"
import { setUpMonitor2Component } from "../modules/panels/monitor2/monitor2.module.js"
import { setUpDronecanComponent } from '../modules/panels/dronecan.module.js';

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
yukon_state.port = urlParams.get('port');

var old_console = window.console;
// New console should be a proxy to the old one, but with additional functionality
window.console = new Proxy(old_console, {
    get: function (target, propKey, receiver) {
        var orig_method = target[propKey];
        return function (...args) {
            var result = orig_method.apply(this, args);
            if (propKey === "error") {
                yukon_state.addLocalMessage(args[0], 40);
                return result;
            } else if (propKey === "warn") {
                yukon_state.addLocalMessage(args[0], 30);
                return result;
            } else if (propKey === "info") {
                yukon_state.addLocalMessage(args[0], 20);
                return result;
            } else if (propKey === "log") {
                yukon_state.addLocalMessage(args[0], undefined);
                return result;
            }
        };
    }
});

(async function () {
    try {
        // Modified bootstrap color mode initialization code
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-bs-theme', 'light');
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-bs-theme', 'dark');
            } else {
                document.documentElement.setAttribute('data-bs-theme', 'light');
            }
        })
    } catch (e) {
        console.error(e);
    }
    yukon_state.zubax_api = zubax_api;
    yukon_state.zubax_apij = zubax_apij;
    yukon_state.autosize = autosize;
    yukon_state.navigator = window.navigator;
    yukon_state.jsyaml = jsyaml;
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

        yukon_state.mousePos = {
            x: event.pageX,
            y: event.pageY
        };
    }
    yukon_state.all_settings = await yukon_state.zubax_apij.get_settings();
    let elementPreviousParents = {}; // Component name and the corresponding previous parent element
    if (!isRunningInElectron(yukon_state)) {
        zubax_api.announce_running_in_browser();
        document.title = "Yukon (browser)";
    } else {
        zubax_api.announce_running_in_electron();
    }

    function setUpMonitorComponent() {
        yukon_state.my_graph = create_directed_graph(yukon_state);

        async function display_avatars() {
            update_directed_graph(yukon_state);
        }

        setInterval(display_avatars, 3000);
        update_directed_graph(yukon_state);
    }

    yukon_state.addLocalMessage = function (message, severity) {
        if(message === undefined) {
            console.error("Message is undefined");
            return;
        }
        if (severity === undefined) {
            console.error("Severity is undefined");
            return;
        }
        zubax_api.add_local_message(message, severity);
    }
    yukon_state.addLocalMessage("Press CTRL+SPACE to maximize the panel under your mouse", 30);
    window.addEventListener("error", function (error, url, line) {
        console.log("There was an actual error!")
        yukon_state.addLocalMessage("Error: " + error.message + " at " + error.filename + ":" + error.lineno, 40);
        return true;
    });
    const addLocalMessage = yukon_state.addLocalMessage;

    async function doStuffWhenReady() {
        function dynamicallyLoadHTML(path, container, callback, callback_delay) {
            const xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (this.readyState === 4) {
                    if (this.status === 200) {
                        container.getElement().html(this.responseText);
                        if (callback_delay) {
                            setTimeout(callback, callback_delay);
                        } else {
                            callback();
                        }
                    } else if (this.status === 404) {
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
            console.log("Adding component " + componentName + " to layout");
            const addedComponent = {
                type: 'component',
                componentName: componentName,
                isClosable: true,
                title: componentText,
            };
            if (elementPreviousParents[componentName]) {
                let childElementContainer = elementPreviousParents[componentName].childElementContainer;
                let parentElement1 = elementPreviousParents[componentName].parent;
                let isParentInElementTree = childElementContainer && childElementContainer[0] && childElementContainer[0].parentElement && childElementContainer[0].parentElement.parentElement;
                if (parentElement1 && isParentInElementTree) {
                    elementPreviousParents[componentName].addChild(addedComponent);
                    return
                }
            }

            try {
                yukon_state.myLayout.root.contentItems[0].addChild(addedComponent);
            } catch (e) {
                console.log(e);
                yukon_state.myLayout.root.addChild(addedComponent);
            }
        }

        if (window.electronAPI) {
            window.electronAPI.onOpenSettings(function () {
                yukon_state.settingsComponent.parent.parent.setActiveContentItem(yukon_state.settingsComponent.parent);
                yukon_state.settingsComponent.parent.parent.toggleMaximise();
            });
        } else {
            // Popout windows unfortunately don't have access to the electron API
        }

        const outsideContext = this;

        function addRestoreButton(buttonText, buttonComponentName) {
            if (window.electronAPI) {
                window.electronAPI.addRecoverablePanel(buttonComponentName, buttonText);
            }
            const toolbar = document.querySelector("#toolbar");
            const btnRestore = document.createElement("button");
            btnRestore.classList.add("restore-btn");
            btnRestore.innerHTML = buttonText;
            if (window.electronAPI) {
                let ran = false;
                window.electronAPI.onRecoverPanel(function (_, panelName) {
                    if (!ran && panelName === buttonComponentName) {
                        ran = true;
                        addComponentToLayout(buttonComponentName, buttonText);
                        try {
                            btnRestore.parentElement.removeChild(btnRestore);
                        } catch (e) {
                            console.log(e);
                        }
                        window.electronAPI.removeRecoverButton(buttonText);
                    }
                });
            } else {
                btnRestore.addEventListener('click', function () {
                    addComponentToLayout(buttonComponentName, buttonText);
                    try {
                        btnRestore.parentElement.removeChild(btnRestore);
                    } catch (e) {
                        console.log(e);
                    }
                });
            }
            toolbar.appendChild(btnRestore);
        }

        function initalizeLayout() {
            let hadPreviousLayout = false;
            if (typeof yukon_state.myLayout !== 'undefined') {
                try {
                    console.log("There was a previous layout");
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
                    registerComponentAction("../registers.panel.html", "registersComponent", container, async () => {
                        const containerElement = container.getElement()[0];
                        container.on("show", function () {
                            yukon_state.registersUpdateLogComponent.parent.parent.setActiveContentItem(yukon_state.registersUpdateLogComponent.parent);
                        });
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        await setUpRegistersComponent.bind(outsideContext)(container, true, yukon_state);
                    });
                });
                myLayout.registerComponent('statusComponent', function (container, componentState) {
                    registerComponentAction("../status.panel.html", "statusComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        setUpStatusComponent.bind(outsideContext)(yukon_state);
                    });
                });
                myLayout.registerComponent('monitorComponent', function (container, componentState) {
                    registerComponentAction("../monitor.panel.html", "monitorComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        setUpMonitorComponent.bind(outsideContext)();
                    });
                });
                myLayout.registerComponent('messagesComponent', function (container, componentState) {
                    registerComponentAction("../messages.panel.html", "messagesComponent", container, async () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        await setUpMessagesComponent.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent('transportsComponent', function (container, componentState) {
                    registerComponentAction("../transport.panel.html", "transportsComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        setUpTransportsComponent.bind(outsideContext)(container);
                    });
                });
                myLayout.registerComponent("transportsListComponent", function (container, componentState) {
                    registerComponentAction("../transports_list.panel.html", "transportsListComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        setUpTransportsListComponent.bind(outsideContext)(yukon_state);
                    });
                });
                myLayout.registerComponent("commandsComponent", function (container, componentState) {
                    registerComponentAction("../commands.panel.html", "commandsComponent", container, () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.commandsComponent = container;
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        setUpCommandsComponent.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent("registerUpdateLogComponent", function (container, componentState) {
                    registerComponentAction("../register_update_log.html", "registerUpdateLogComponent", container, async () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.registersUpdateLogComponent = container;
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        await setUpRegisterUpdateLogComponent.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent("subsComponent", function (container, componentState) {
                    registerComponentAction("../subscriptions.panel.html", "subsComponent", container, async () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        await setUpSubscriptionsComponent.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent("settingsComponent", function (container, componentState) {
                    registerComponentAction("../settings.panel.html", "settingsComponent", container, async () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.settingsComponent = container;
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        await setUpSettingsComponent.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent("monitor2Component", function (container, componentState) {
                    registerComponentAction("../monitor2.panel.html", "monitor2Component", container, async () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        await setUpMonitor2Component.bind(outsideContext)(container, yukon_state);
                    });
                });
                myLayout.registerComponent("dronecanComponent", function (container, componentState) {
                    registerComponentAction("../dronecan.panel.html", "dronecanComponent", container, async () => {
                        const containerElement = container.getElement()[0];
                        yukon_state.containerElementToContainerObjectMap.set(containerElement, container);
                        await setUpDronecanComponent.bind(outsideContext)(container, yukon_state);
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
                    //HTML for the colorDropdown is stored in a template tag
                    const btnPanelShowHideToggle = document.createElement("li");
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
                            if (container.getAttribute("data-isExpanded") === "true") {
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
                    // Does stack have the messages panel?
                    let hasMessagesPanel = false;
                    if (stack.config && stack.config.content) {
                        for (let component of stack.config.content) {
                            if (component.componentName === "messagesComponent") {
                                hasMessagesPanel = true;
                                break;
                            }
                        }
                    }
                    let spanAutoScroll = null;
                    let spanSearch = null;
                    if (hasMessagesPanel) {
                        spanAutoScroll = document.createElement("span");
                        // Add a checkbox and a label  for it in liAutoScroll
                        const cbAutoscroll = document.createElement("input");
                        cbAutoscroll.type = "checkbox";
                        cbAutoscroll.checked = true;
                        cbAutoscroll.id = "cbAutoscroll";
                        // Float spanAutoScroll to the left
                        spanAutoScroll.style.cssFloat = "left";
                        spanAutoScroll.style.display = "flex";
                        spanAutoScroll.style.justifyContent = "center";
                        const labelAutoscroll = document.createElement("label");
                        labelAutoscroll.htmlFor = "cbAutoscroll";
                        labelAutoscroll.innerText = "Autoscroll";
                        labelAutoscroll.style.marginLeft = "0.15em";
                        spanAutoScroll.appendChild(cbAutoscroll);
                        spanAutoScroll.appendChild(labelAutoscroll);
                        stack.header.controlsContainer.prepend(spanAutoScroll);
                        spanSearch = document.createElement("span");
                        // Float spanSearch to the left
                        spanSearch.style.cssFloat = "left";
                        spanSearch.style.display = "flex";
                        spanSearch.style.justifyContent = "center";
                        const inputSearch = document.createElement("input");
                        inputSearch.type = "text";
                        inputSearch.title = "Only messages containing this text will be shown."
                        inputSearch.id = "iTextFilter";
                        inputSearch.placeholder = "Filter messages";
                        inputSearch.style.marginLeft = "0.15em";
                        inputSearch.style.height = "100%";
                        spanSearch.style.height = "17px";
                        spanSearch.style.marginRight = "7px";
                        spanSearch.style.fontSize = "12px";
                        spanSearch.style.display = "inline-block";
                        spanSearch.appendChild(inputSearch);
                        stack.header.controlsContainer.prepend(spanSearch);
                    }

                    stack.on('activeContentItemChanged', function (contentItem) {
                        const activeElementName = stack.getActiveContentItem().config.componentName;
                        const doesRequireAutoScroll = activeElementName === "messagesComponent";
                        const requiresSettingsButton = stack.getActiveContentItem().config.hasOwnProperty("doesRequireSettingsButton") && stack.getActiveContentItem().config.doesRequireSettingsButton === true;
                        if (!requiresSettingsButton) {
                            btnPanelShowHideToggle.style.display = "none";
                        } else {
                            btnPanelShowHideToggle.style.display = "block";
                        }
                        if (spanAutoScroll) {
                            if (doesRequireAutoScroll) {
                                spanAutoScroll.style.display = "flex";
                            } else {
                                spanAutoScroll.style.display = "none";
                            }
                        }
                        if (spanSearch) {
                            if (activeElementName === "messagesComponent") {
                                spanSearch.style.display = "flex";
                            } else {
                                spanSearch.style.display = "none";
                            }

                        }

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
        setInterval(async () => await update_avatars_dto(yukon_state), 500)
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
        if (isRunningInElectron(yukon_state)) {
            btnShowHideToolbar.style.display = "none";
        }
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
            setTimeout(function () {
                yukon_state.myLayout.updateSize();
            }, 50);
        });
        document.querySelector("#layout").addEventListener("resize", () => {
            setTimeout(function () {
                yukon_state.myLayout.updateSize();
            }, 50);
        });
        if (isRunningInElectron(yukon_state) && window.electronAPI && window.electronAPI.onRestoreDefaultLayout) {
            window.electronAPI.onRestoreDefaultLayout(function () {
                console.log("Restore default layout requested");
                yukon_state.is_currently_restoring_default_layout = true;
                setTimeout(function () {
                    yukon_state.is_currently_restoring_default_layout = false;
                }, 3000);
                initalizeLayout();
                e.preventDefault();
                e.stopPropagation();
            });
        }

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
                    elementPreviousParents[componentName] = container.parent.parent;
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

        yukon_state.selectingTableCellsIsDisabledStyle = document.createElement('style');
        yukon_state.selectingTableCellsIsDisabledStyle.innerHTML = `
        .table-cell {
            user-select:none;
        }
        `;
        make_context_menus(yukon_state);
        // When escape is double pressed within 400ms, run unselectAll
        let escape_timer = null;
        window.onkeyup = function (e) {
            yukon_state.pressedKeys[e.keyCode] = false;
        }
        // Add event listeners for focus and blur event handlers to window
        window.addEventListener('focus', function () {
            yukon_state.pressedKeys[18] = false;
        });
        window.addEventListener('blur', function () {
            yukon_state.pressedKeys[18] = false;
        });



        window.onkeydown = async function (e) {
            // If alt tab was pressed return
            yukon_state.pressedKeys[e.keyCode] = true;
            // If ctrl a was pressed, select all
            if (yukon_state.pressedKeys[17] && yukon_state.pressedKeys[65]) {
                if (areThereAnyActiveModals(yukon_state)) {
                    // The modal should handle its own copy and paste events (natively)
                    // Not going to copy any of the selected registers here.
                    return;
                }
                const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
                const hoveredContainerObject = returnArray[1];
                if (!hoveredContainerObject || hoveredContainerObject.title !== "registersComponent") {
                    return;
                }
                selectAll(yukon_state);
                e.preventDefault();
            }
            // If ctrl c was pressed
            if (yukon_state.pressedKeys[17] && yukon_state.pressedKeys[67]) {
                // Make sure that mouse is over the registersComponent
                const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
                const hoveredContainerObject = returnArray[1];
                if (!hoveredContainerObject || hoveredContainerObject.title !== "registersComponent") {
                    return;
                }
                if (areThereAnyActiveModals(yukon_state)) {
                    // The modal should handle its own copy and paste events (natively)
                    return;
                }
                // If there are any cells selected
                // If there aren't any cells selected then get the element that the mouse is hovering over and copy its value
                if (oneSelectedConstraint() || moreThanOneSelectedConstraint()) {
                    let pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": null,
                        "get_everything": false,
                        "only_of_register_name": null
                    }, yukon_state);
                    const selectedCells = document.querySelectorAll(".selected-cell .input")
                    for (let i = 0; i < selectedCells.length; i++) {
                        const selectedCell = selectedCells[i];
                        const previousText = selectedCell.innerHTML;
                        selectedCell.innerHTML = "Generating yaml!";
                        setTimeout(function () {
                            if (selectedCell.innerHTML === "Copied!" || selectedCell.innerHTML === "Generating yaml!" || selectedCell.innerHTML === "Copy failed!") {
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
                    let element = document.elementFromPoint(yukon_state.mousePos.x, yukon_state.mousePos.y);
                    const copyTextOfElement = function (element, event) {
                        copyTextToClipboard(element.innerText, event);
                        const previousText = element.innerHTML;
                        element.innerHTML = "Copied!";
                        setTimeout(function () {
                            if (element.innerHTML === "Copied!") {
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
                const potentialSubscriptionFrame = getHoveredClass("subscription");
                const potentialPublisherFrame = getHoveredClass("publisher-frame");
                if (potentialSubscriptionFrame) {
                    potentialSubscriptionFrame.classList.toggle("maximized")
                } else if (potentialPublisherFrame) {
                    potentialPublisherFrame.classList.toggle("maximized")
                } else {
                    const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
                    const containerObject = returnArray[1];
                    containerObject.parent.parent.toggleMaximise();
                }
                e.preventDefault();
            }
            // If F5 is pressed, reread registers
            if (e.code === "F5") {
                e.preventDefault();
                const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
                const hoveredContainerObject = returnArray[1];
                if (!hoveredContainerObject || hoveredContainerObject.title !== "registersComponent") {
                    return;
                }
                const data = get_all_selected_pairs({
                    "only_of_avatar_of_node_id": null,
                    "get_everything": true,
                    "only_of_register_name": null
                }, yukon_state);
                rereadPairs(data, yukon_state);
            }
        }
        document.addEventListener('keydown', function (e) {
            if (e.code === "Escape") {
                const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
                if (!returnArray) {
                    return;
                }
                const hoveredContainerObject = returnArray[1];
                if (!hoveredContainerObject || hoveredContainerObject.title !== "registersComponent") {
                    return;
                }
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
