import { areThereAnyNewOrMissingHashes, updateLastHashes } from "../../hash_checks.module.js";
import { getRelatedLinks } from "../../meanings.module.js";
import { waitForElm, getKnownDatatypes } from "../../utilities.module.js";
import {
    getHoveredContainerElementAndContainerObject,
    secondsToColonSeparatedString,
    getDatatypesForPort
} from "../../utilities.module.js";
import { fillSettings } from "./fill_settings.module.js";
import { highlightElement, highlightElements, removeHighlightsFromObjects, removeHighlightFromElement, unhighlightAll, setPortStateAsHiglighted, setPortStateAsUnhiglighted, isPortStateHighlighted } from "./highlights.module.js";
import { drawSubscriptions } from "./subscriptions.module.js";

const settings = {};

let linesByPortAndPortType = [];

async function drawPublishers() {

}

const portOrder = ["pub", "sub", "srv", "cli"]

function comparePorts(a, b) {
    // Compare ports by type and port number (port) for sorting
    const aPortOrder = portOrder.indexOf(a.type);
    const bPortOrder = portOrder.indexOf(b.type);
    if (aPortOrder < bPortOrder) {
        return -1;
    }
    if (aPortOrder > bPortOrder) {
        return 1;
    }
    if (a.port < b.port) {
        return 1;
    }
    if (a.port > b.port) {
        return -1;
    }
    return 0;
}

export async function setUpMonitor2Component(container, yukon_state) {
    const containerElement = container.getElement()[0];
    yukon_state.monitor2ContainerElement = containerElement;
    const monitor2Div = await waitForElm("#monitor2", 7000, this);
    if (monitor2Div === null) {
        console.error("monitor2Div is null");
        return;
    } else {
        console.log("monitor2Div is not null");
    }
    fillSettings(settings, yukon_state);
    const subscriptionsOuterArea = containerElement.querySelector("#subscriptions-outer-area");
    const subscriptionsInnerArea = document.createElement("div");
    subscriptionsInnerArea.id = "subscriptions-inner-area";
    subscriptionsInnerArea.style.position = "absolute";
    subscriptionsOuterArea.appendChild(subscriptionsInnerArea);
    setInterval(async () => {
        if (settings.SubscriptionsOffset) {
            subscriptionsInnerArea.style.left = settings.SubscriptionsOffset + "px";
            subscriptionsInnerArea.style.top = settings.SubscriptionsVerticalOffset + "px";
            yukon_state.subscription_specifiers = await yukon_state.zubax_apij.get_current_available_subscription_specifiers();
            yukon_state.sync_subscription_specifiers = await yukon_state.zubax_apij.get_current_available_synchronized_subscription_specifiers();
            if (typeof yukon_state.subscription_specifiers_previous_hash === "undefined" || yukon_state.subscription_specifiers_previous_hash !== yukon_state.subscription_specifiers.hash) {
                await drawSubscriptions(subscriptionsInnerArea, settings, yukon_state);
            }
            yukon_state.subscription_specifiers_previous_hash = yukon_state.subscription_specifiers_hash;
            // Do the same for the hash of the synchronized subscriptions
            if (typeof yukon_state.sync_subscription_specifiers_previous_hash === "undefined" || yukon_state.sync_subscription_specifiers_previous_hash !== yukon_state.sync_subscription_specifiers.hash) {
                await drawSubscriptions(subscriptionsInnerArea, settings, yukon_state);
            }
            yukon_state.sync_subscription_specifiers_previous_hash = yukon_state.sync_subscription_specifiers_hash;
        } else {
            console.warn("Subscriptions offset is not set");
        }

    }, 1500);
    setInterval(async () => {
        await update_monitor2(containerElement, monitor2Div, yukon_state);
    }, 1000);
    let escape_timer = null;
    document.addEventListener('keydown', function (e) {
        if (e.code === "Escape") {
            const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
            const hoveredContainerObject = returnArray[1];
            if (!hoveredContainerObject || hoveredContainerObject.title !== "monitor2Component") {
                return;
            }
            if (escape_timer) {
                clearTimeout(escape_timer);
                escape_timer = null;
                unhighlightAll(linesByPortAndPortType, settings, yukon_state);
                yukon_state.monitor2PortHighlights = [];
                yukon_state.monitor2selections = [];
            } else {
                escape_timer = setTimeout(function () {
                    escape_timer = null;
                }, 400);
            }
        }
    });
    let posObject = { top: 0, left: 0, x: 0, y: 0 };
    const mouseDownHandler = function (e) {
        if (e.which !== 2) {
            return;
        }
        yukon_state.grabbing_in_monitor_view = true;
        e.preventDefault();
        containerElement.style.userSelect = 'none';
        containerElement.style.cursor = 'grabbing';
        posObject = {
            // The current scroll
            left: containerElement.scrollLeft,
            top: containerElement.scrollTop,
            // Get the current mouse position
            x: e.clientX,
            y: e.clientY,
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };
    const mouseMoveHandler = function (e) {
        // How far the mouse has been moved
        const dx = e.clientX - posObject.x;
        const dy = e.clientY - posObject.y;

        // Scroll the element
        containerElement.scrollTop = posObject.top - dy;
        containerElement.scrollLeft = posObject.left - dx;
    };
    const mouseUpHandler = function (e) {
        if (e.which !== 2) {
            return;
        }
        e.preventDefault();
        yukon_state.grabbing_in_monitor_view = false;
        containerElement.style.cursor = 'default';
        containerElement.style.removeProperty('user-select');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };
    document.addEventListener('mousedown', mouseDownHandler);
}
function isContainerPopulated(containerElement) {
    return containerElement.querySelectorAll(".node").length > 0;
}

function findRelatedObjects(port) {
    return linesByPortAndPortType.filter((line) => {
        return line.port === port;
    });
}

function changeStateOfElement(portNr, value_of_toggledOn, dontTurnOffRelatedObjects, yukon_state) {
    if (value_of_toggledOn) {
        // horizontal_line.style.setProperty("background-color", "red");
        // arrowhead.style.setProperty("border-top-color", "red");
        const relatedObjects = findRelatedObjects(portNr);
        selectPort(portNr, yukon_state);
        if (!isPortStateHighlighted(portNr, yukon_state)) {
            setPortStateAsHiglighted(portNr, yukon_state);
            highlightElements(relatedObjects, settings, yukon_state);
        } else {
            console.log("Port " + portNr + " is already highlighted");
        }
        relatedObjects.forEach(object => {
            object["toggledOn"].value = true;
        })
    } else {
        // horizontal_line.style.removeProperty("background-color");
        // arrowhead.style.setProperty("border-top-color", "pink");
        const relatedObjects = findRelatedObjects(portNr);
        unselectPort(portNr, yukon_state);
        setPortStateAsUnhiglighted(portNr, yukon_state);
        removeHighlightsFromObjects(relatedObjects, settings, yukon_state);
        if (!dontTurnOffRelatedObjects) {
            relatedObjects.forEach(object => {
                object["toggledOn"].value = false;
            })
        }
    }
}

function compareAvatar(a, b) {
    if (a.node_id < b.node_id) {
        return -1;
    }
    if (a.node_id > b.node_id) {
        return 1;
    }
    return 0;
}
function positionAndPreparePorts(ports, x_counter, settings, yukon_state) {
    for (const port of ports) {
        if (port.type === "pub") {
            port.x_offset = x_counter.value;
            x_counter.value += settings["DistanceBetweenLines"];
        } else if (port.type === "srv") {
            port.x_offset = x_counter.value;
            x_counter.value += settings["DistanceBetweenLines"];
        } else if (port.type === "sub" && !ports.find(p => p.type === "pub" && p.port === port.port)) {
            port.x_offset = x_counter.value;
            x_counter.value += settings["DistanceBetweenLines"];
        }
    }
    for (const port of ports) {
        if (port.type === "sub") {
            let pub_port = ports.find(p => p.type === "pub" && p.port === port.port);
            if (pub_port !== undefined) {
                port.x_offset = pub_port.x_offset;
                port.auxiliary = true;
            }
        } else if (port.type === "cln") {
            let srv_port = ports.find(p => p.type === "srv" && p.port === port.port);
            if (srv_port !== undefined) {
                port.x_offset = srv_port.x_offset;
                port.auxiliary = true;
            }
        }
    }
}
function isPortSelected(portNr, yukon_state) {
    if (typeof yukon_state.monitor2selections !== undefined && Array.isArray(yukon_state.monitor2selections)) {
        return yukon_state.monitor2selections.includes(portNr);
    } else {
        return false;
    }
}
export function getPortType(portNr, yukon_state) {
    if (typeof yukon_state.monitor2portTypes !== undefined) {
        return yukon_state.monitor2portTypes[portNr];
    } else {
        return undefined;
    }
}
function selectPort(portNr, yukon_state) {
    // It returns true if the port was not selected before
    if (typeof yukon_state.monitor2selections !== undefined && Array.isArray(yukon_state.monitor2selections)) {
        if (!yukon_state.monitor2selections.includes(portNr)) {
            yukon_state.monitor2selections.push(portNr);
            return true;
        } else {
            return false;
        }
    } else {
        yukon_state.monitor2selections = [portNr];
        return true;
    }
}
function unselectPort(portNr) {
    if (typeof yukon_state.monitor2selections !== undefined && Array.isArray(yukon_state.monitor2selections)) {
        yukon_state.monitor2selections = yukon_state.monitor2selections.filter((p) => p !== portNr);
    }
}
async function update_monitor2(containerElement, monitor2Div, yukon_state) {
    if (!areThereAnyNewOrMissingHashes("monitor2_hash", yukon_state)) {
        updateLastHashes("monitor2_hash", yukon_state);
        // If there are any elements in my_graph.elements() then we can return, otherwise we need to make a graph (below)
        if (isContainerPopulated(monitor2Div)) {
            return;
        }
    }
    updateLastHashes("monitor2_hash", yukon_state);
    // Clear the container
    monitor2Div.innerHTML = "";
    for (const color of settings.HighlightColors) {
        color.taken = false;
    }
    // Add all nodes
    let y_counter = { value: settings["PageMarginTop"] };
    yukon_state.monitor2 = {};
    yukon_state.monitor2.ports = [];
    const ports = yukon_state.monitor2.ports;
    for (const avatar of yukon_state.current_avatars) {
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                if (port === "") {
                    continue;
                }
                setPortStateAsUnhiglighted(port, yukon_state);
                let alreadyExistingPorts = ports.filter(p => p.port === port && p.type === port_type);
                if (alreadyExistingPorts.length === 0) {
                    ports.push({ "type": port_type, "port": port, "x_offset": 0 });
                    // Fill yukon_state.monitor2portTypes
                    if (!yukon_state.monitor2portTypes) {
                        yukon_state.monitor2portTypes = {};
                    }
                    switch (port_type) {
                        case "pub":
                            yukon_state.monitor2portTypes[port] = "pub";
                            break;
                        case "sub":
                            yukon_state.monitor2portTypes[port] = "pub";
                            break;
                        case "srv":
                            yukon_state.monitor2portTypes[port] = "srv";
                            break;
                        case "cln":
                            yukon_state.monitor2portTypes[port] = "srv";
                            break;
                    }
                }
            }
        }
    }

    ports.sort(comparePorts);
    let x_counter = { value: settings["PubLineXOffset"] };
    positionAndPreparePorts(ports, x_counter, settings, yukon_state);

    const datatypes_response = await yukon_state.zubax_apij.get_known_datatypes_from_dsdl();
    const avatars_copy = Array.from(yukon_state.current_avatars)
    avatars_copy.sort(compareAvatar);
    let nodesToBePositioned = [];
    for (const avatar of avatars_copy) {
        const node_id = avatar.node_id;
        const get_up_to_date_avatar = () => { return yukon_state.current_avatars.find(a => a.node_id === node_id); };
        // Add the sizes of ports.cln, ports.srv, ports.pub, ports.sub
        const fieldsObject = {
            "Name": avatar.name, "Health": avatar.last_heartbeat.health_text,
            "Software Version": avatar.versions.software_version,
            "Hardware Version": avatar.versions.hardware_version,
            "Uptime": secondsToColonSeparatedString(avatar.last_heartbeat.uptime),
            "Node ID": avatar.node_id
        };
        const node = createElementForNode(avatar, "", monitor2Div, fieldsObject, get_up_to_date_avatar, yukon_state);
        nodesToBePositioned.push([node, avatar]);
    }
    for (const [node, avatar] of nodesToBePositioned) {
        const total_ports = avatar.ports.cln.length + avatar.ports.srv.length + avatar.ports.pub.length + avatar.ports.sub.length;
        console.assert(total_ports >= 0);
        const avatar_height = Math.max(total_ports * settings["DistancePerHorizontalConnection"] + settings["AvatarConnectionPadding"], node.scrollHeight);
        node.style.height = avatar_height + "px";
        node.style.top = y_counter.value + "px";
        let avatar_y_counter = { value: settings["AvatarConnectionPadding"] };
        for (const port_type of portOrder) {
            if (!avatar.ports[port_type]) { continue; }
            for (const port of avatar.ports[port_type]) {
                const matchingPort = ports.find(p => p.port === port && p.type === port_type);
                if (matchingPort === undefined || (matchingPort && matchingPort.x_offset === 0)) {
                    continue;
                }
                // Getting info about more links than necessary for later highlighting purposes
                const relatedLinks = getRelatedLinks(port, yukon_state);
                const currentLinkObject = relatedLinks.find(link => link.port === port && link.type === matchingPort.type);
                let toggledOn = { value: false };
                let currentLinkDsdlDatatype = null;
                let fixed_datatype_short = null;
                let fixed_datatype_full = null;
                if (datatypes_response["fixed_id_messages"][port] !== undefined) {
                    fixed_datatype_short = datatypes_response["fixed_id_messages"][port]["short_name"];
                    fixed_datatype_full = datatypes_response["fixed_id_messages"][port]["full_name"];
                }
                if (currentLinkObject !== undefined) {
                    currentLinkDsdlDatatype = currentLinkObject.datatype || "";
                    if (currentLinkObject.name && !settings.ShowLinkNameOnSeparateLine) {
                        currentLinkDsdlDatatype = currentLinkObject.name + ":" + currentLinkDsdlDatatype;
                    }
                } else {
                    currentLinkDsdlDatatype = fixed_datatype_full || "There is no info about this link";
                }

                addHorizontalElements(monitor2Div, matchingPort, currentLinkDsdlDatatype, toggledOn, y_counter, avatar_y_counter, currentLinkObject, settings, yukon_state);
                avatar_y_counter.value += settings["DistancePerHorizontalConnection"];
            }
        }
        y_counter.value += avatar_height + settings["DistanceBetweenNodes"];
    }
    addVerticalLines(monitor2Div, ports, y_counter, containerElement, settings, yukon_state);
}
function createElementForNode(avatar, text, container, fieldsObject, get_up_to_date_avatar, yukon_state) {
    // Verify that the avatar is not undefined
    console.assert(avatar !== undefined);
    let node = document.createElement("div");
    node.classList.add("node");
    node.style.left = settings.NodeXOffset + "px";
    // Delay the setting of height until its contents are loaded
    node.style.setProperty("border-sizing", "border-box");
    node.style.width = settings.NodeWidth + "px";
    // node.style.backgroundColor = avatar.color;
    node.innerText = text;
    container.appendChild(node);
    // Make a div for each: health, software_version, hardware_version, uptime
    for (const field of Object.keys(fieldsObject)) {
        const fieldDiv = document.createElement("div");
        fieldDiv.classList.add("field");
        fieldDiv.innerHTML = field;
        fieldDiv.style.fontWeight = "bold";
        node.appendChild(fieldDiv);
        const valueDiv = document.createElement("div");
        valueDiv.classList.add("value");
        valueDiv.innerHTML = fieldsObject[field];
        if (field === "Uptime") {
            let intervalId = null;
            intervalId = setInterval(() => {
                valueDiv.innerHTML = secondsToColonSeparatedString(get_up_to_date_avatar().last_heartbeat.uptime);
                if (!valueDiv.parentElement) {
                    clearInterval(intervalId);
                }
            }, 1000);
        }
        node.appendChild(valueDiv);
    }
    // Add an empty label in a variable called feedbackMessage
    const feedbackMessage = document.createElement("div");
    feedbackMessage.classList.add("feedback_message");
    feedbackMessage.style.display = "none";
    node.appendChild(feedbackMessage);
    const neededButtons = [{ "name": "Restart", "command": "65535" }, { "name": "Save persistent states", "command": "65530" }, { "name": "Emergency stop", "command": "65531" }];
    for (const button of neededButtons) {
        const btnButton = document.createElement("button");
        btnButton.classList.add("btn_button");
        btnButton.innerHTML = button.name;
        btnButton.onclick = async () => {
            const result = await yukon_state.zubax_apij.send_command(avatar.node_id, button.command, "");
            if (!result.success) {
                feedbackMessage.classList.remove("success");
                feedbackMessage.style.display = "block";
                if (result.message) {
                    feedbackMessage.innerHTML = result.message;
                } else {
                    feedbackMessage.innerHTML = "";
                }
            } else {
                feedbackMessage.classList.add("success");
                feedbackMessage.style.display = "block";
                if (result.message) {
                    feedbackMessage.innerHTML = result.message;
                } else {
                    feedbackMessage.innerHTML = "";
                }
            }
        };
        node.appendChild(btnButton);
    }
    return node;
}
function addHorizontalElements(monitor2Div, matchingPort, currentLinkDsdlDatatype, toggledOn, y_counter, avatar_y_counter, currentLinkObject, settings, yukon_state) {
    let horizontal_line = null;
    let arrowhead = null;
    horizontal_line = document.createElement("div");
    horizontal_line.classList.add("horizontal_line");
    horizontal_line.style.top = y_counter.value + avatar_y_counter.value + "px";
    horizontal_line.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + "px";
    horizontal_line.style.width = matchingPort.x_offset - settings["NodeXOffset"] - settings["NodeWidth"] + "px";
    horizontal_line.style.height = settings.HorizontalLineWidth + "px";
    monitor2Div.appendChild(horizontal_line);
    // Create an invisible collider div for horizontal_line, it should have a height of 10px
    const horizontal_line_collider = document.createElement("div");
    horizontal_line_collider.classList.add("horizontal_line_collider");
    horizontal_line_collider.setAttribute("data-port", matchingPort.port);
    horizontal_line_collider.setAttribute("data-port-type", matchingPort.type);
    horizontal_line_collider.style.top = y_counter.value + avatar_y_counter.value - settings["HorizontalColliderOffsetY"] + "px";
    horizontal_line_collider.style.left = horizontal_line.style.left;
    horizontal_line_collider.style.width = horizontal_line.style.width;
    horizontal_line_collider.style.height = settings["HorizontalColliderHeight"] + "px";
    horizontal_line_collider.style.zIndex = "1";
    horizontal_line_collider.style.position = "absolute";
    horizontal_line_collider.style.backgroundColor = "transparent";
    horizontal_line_collider.style.cursor = "pointer";
    monitor2Div.appendChild(horizontal_line_collider);
    let link_name_label = null;
    if (settings.ShowLinkNameOnSeparateLine && typeof currentLinkObject === "object" && currentLinkObject.name) {
        link_name_label = document.createElement("label");
        link_name_label.classList.add("link_name_label");
        link_name_label.style.top = y_counter.value + avatar_y_counter.value - settings.LinkNameOffset + "px";
        link_name_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
        link_name_label.style.width = "fit-content";
        link_name_label.style.zIndex = "0";
        link_name_label.style.position = "absolute";
        link_name_label.style.backgroundColor = "transparent";
        link_name_label.style.cursor = "pointer";
        link_name_label.innerHTML = currentLinkObject.name || "";
        monitor2Div.appendChild(link_name_label);
    }
    // Place a label above the horizontal line at the left side
    const horizontal_line_label = document.createElement("label");
    horizontal_line_label.classList.add("horizontal_line_label");
    horizontal_line_label.style.top = y_counter.value + avatar_y_counter.value - settings["HorizontalLabelOffsetY"] + "px";
    horizontal_line_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
    horizontal_line_label.style.width = "fit-content"; // settings.LinkInfoWidth  - settings.LabelLeftMargin + "px";
    horizontal_line_label.style.height = "fit-content";
    horizontal_line_label.style.position = "absolute";
    if (currentLinkDsdlDatatype.endsWith(".Response")) {
        currentLinkDsdlDatatype = currentLinkDsdlDatatype.replace(".Response", "");
    }
    horizontal_line_label.innerHTML = currentLinkDsdlDatatype;
    horizontal_line_label.style.zIndex = "0";
    horizontal_line_label.style.backgroundColor = settings["LinkLabelColor"];
    horizontal_line_label.style.color = settings["LinkLabelTextColor"];
    horizontal_line_label.addEventListener("mouseover", () => {
        horizontal_line_label.style.backgroundColor = settings["LinkLabelHighlightColor"];
        horizontal_line_label.style.color = settings["LinkLabelHighlightTextColor"];
    });
    horizontal_line_label.addEventListener("mouseout", () => {
        if (!toggledOn.value) {
            horizontal_line_label.style.backgroundColor = settings["LinkLabelColor"];
            horizontal_line_label.style.color = settings["LinkLabelTextColor"];
        }
    });
    if (settings.ShowLinkNameOnSeparateLine && settings.ShowNameAboveDatatype && link_name_label) {
        // Swap the top of horizontal_line_label and link_name_label
        const temp_value = horizontal_line_label.style.top;
        horizontal_line_label.style.top = link_name_label.style.top;
        link_name_label.style.top = temp_value;
    }
    // Create a label for the port number on the left side of the horizontal line
    const port_number_label = document.createElement("label");
    port_number_label.classList.add("port_number_label");
    port_number_label.style.top = y_counter.value + avatar_y_counter.value - settings.HorizontalPortLabelOffsetY + "px";
    // align it 50px to the left from the left side of the horizontal line
    port_number_label.style.setProperty("left", settings["NodeXOffset"] + settings["NodeWidth"] - 50 + "px");
    port_number_label.style.width = "45px";
    port_number_label.style.height = settings.DistancePerHorizontalConnection + "px";
    port_number_label.style.position = "absolute";
    port_number_label.innerHTML = matchingPort.port;
    port_number_label.style.zIndex = "4";
    if (matchingPort.type === "srv") {
        port_number_label.style.backgroundColor = settings["ServicePortLabelBgColor"];
        port_number_label.style.setProperty("color", settings["ServicePortLabelColor"], "important");
    } else {
        port_number_label.style.backgroundColor = settings["LinkLabelHighlightColor"];
        port_number_label.style.color = settings["LinkLabelHighlightTextColor"];
    }
    // Align text right
    port_number_label.style.textAlign = "right";
    monitor2Div.appendChild(port_number_label);

    monitor2Div.appendChild(horizontal_line_label);


    arrowhead = document.createElement("div");
    arrowhead.classList.add("arrowhead");
    arrowhead.style.position = "absolute";
    arrowhead.style.top = y_counter.value + avatar_y_counter.value - 4 + settings.HorizontalLineWidth / 2 + "px";
    arrowhead.style.left = matchingPort.x_offset - 12 + "px";
    arrowhead.style.width = "0px";
    arrowhead.style.height = "0px";
    arrowhead.style.borderLeft = "9px solid transparent";
    arrowhead.style.borderRight = "9px solid transparent";
    arrowhead.style.borderTop = "9px solid pink";
    monitor2Div.appendChild(arrowhead);
    linesByPortAndPortType.push({ "element": horizontal_line, "port": matchingPort.port, "type": matchingPort.type, "toggledOn": toggledOn });
    linesByPortAndPortType.push({ "element": arrowhead, "port": matchingPort.port, "type": matchingPort.type, "toggledOn": toggledOn });
    linesByPortAndPortType.push({ "element": horizontal_line_label, "port": matchingPort.port, "type": matchingPort.type, "toggledOn": toggledOn });
    // horizontal_line_collider.addEventListener("mouseover", () => {
    //     if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
    //         highlightElement(horizontal_line, "red", settings, yukon_state);
    //         highlightElement(arrowhead, "red", settings, yukon_state);
    //         highlightElement(horizontal_line_label, "none", settings, yukon_state);
    //     }
    // });
    // horizontal_line_collider.addEventListener("mouseout", () => {
    //     if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
    //         removeHighlightFromElement(horizontal_line, settings, yukon_state);
    //         removeHighlightFromElement(arrowhead, settings, yukon_state);
    //         removeHighlightFromElement(horizontal_line_label, settings, yukon_state);
    //     }
    // });

    horizontal_line_collider.addEventListener("click", () => {
        toggledOn.value = !toggledOn.value;
        changeStateOfElement(matchingPort.port, toggledOn.value, false, yukon_state)
    });

    const normalContext = this;
    setTimeout(() => {
        // This is done with a timeout to make sure that all related objects are created,
        // in this case the vertical lines are created later and here we wait for them to be created
        // so that they can also be highlighted.
        // TODO: To reduce the delay, set up a list of callbacks for this when all is rendered otherwise
        changeStateOfElement.bind(normalContext)(matchingPort.port, isPortSelected(matchingPort.port, yukon_state), true, yukon_state);
    }, 1000);

    const right_end_of_edge = matchingPort.x_offset;
    const left_end_of_edge = settings["NodeXOffset"] + settings["NodeWidth"] - 3 + "px"
    if (matchingPort.type === "pub" || matchingPort.type === "cln") {
        // Arrowhead for the line
        arrowhead.style.transform = "rotate(270deg)";
        arrowhead.style.left = right_end_of_edge - 10 + "px";
    } else if (matchingPort.type === "sub" || matchingPort.type === "srv") {
        arrowhead.style.transform = "rotate(90deg)";
        arrowhead.style.left = left_end_of_edge;
        // Make a circle and position it at right_end_of_edge
        const circle = document.createElement("div");
        circle.classList.add("circle");
        circle.style.position = "absolute";
        circle.style.top = y_counter.value + avatar_y_counter.value - 7 + "px";
        circle.style.left = right_end_of_edge - 7 + "px";
        circle.style.width = "15px";
        circle.style.height = "15px";
        circle.style.borderRadius = "50%";
        circle.style.zIndex = "4";
        monitor2Div.appendChild(circle);
        linesByPortAndPortType.push({ "element": circle, "port": matchingPort.port, "type": matchingPort.type, "toggledOn": toggledOn });
    }
}
function addVerticalLines(monitor2Div, ports, y_counter, containerElement, settings, yukon_state) {
    const publishers_and_services = ports.filter(p => p.x_offset !== 0 && !p.auxiliary);
    for (const port of publishers_and_services) {
        // Create a line like <div class="line" style="width: 4px; position: absolute; top:20px; left: 140px">-42</div>-->
        let line = document.createElement("div");
        line.classList.add("line");
        line.style.width = settings.VerticalLineWidth + "px";
        line.style.position = "absolute";
        line.style.height = y_counter.value + "px";
        line.style.top = settings["VerticalLineMarginTop"] + "px";
        line.style.left = port.x_offset + "px";
        // Make a label for the line, positioned 2 pixels to the right of the line, positioned sticky
        let port_label = document.createElement("label");
        port_label.classList.add("port_label");
        port_label.style.position = "absolute";

        function update_port_label_position() {
            if (port_label) {
                port_label.style.top = containerElement.scrollTop + settings["VerticalLineMarginTop"] + "px";
                window.requestAnimationFrame(update_port_label_position);
            }
        }
        window.requestAnimationFrame(update_port_label_position);
        port_label.style.top = settings["VerticalLineMarginTop"] + "px";
        port_label.style.left = port.x_offset + 5 + "px";
        port_label.innerText = port.port;
        port_label.title = "Click to see all datatypes in use on the port.";
        // When port_label is hovered over, create a popup div aligned to the bottom of the label, it should contain paragraphs for each datatype string returned by "await getDatatypesForPort(subscription.subject_id, yukon_state)";
        let potentialPopup = null;
        port_label.addEventListener("click", async () => {
            if (potentialPopup) {
                potentialPopup.remove();
                potentialPopup = null;
            } else {
                const datatypes = await getDatatypesForPort(port.port, yukon_state);
                potentialPopup = document.createElement("div");
                potentialPopup.classList.add("popup");
                potentialPopup.style.position = "absolute";
                potentialPopup.style.top = port_label.getBoundingClientRect().height + "px";
                potentialPopup.style.left = "0px";
                potentialPopup.style.backgroundColor = "white";
                potentialPopup.style.border = "1px solid black";
                potentialPopup.style.borderRadius = "5px";
                potentialPopup.style.padding = "5px";
                potentialPopup.style.zIndex = "5";
                potentialPopup.style.width = "fit-content(400px)";
                potentialPopup.style.maxHeight = "300px";
                potentialPopup.style.overflow = "auto";
                potentialPopup.style.display = "flex";
                potentialPopup.style.flexDirection = "column";
                potentialPopup.style.alignItems = "flex-start";
                potentialPopup.style.justifyContent = "flex-start";
                potentialPopup.style.fontSize = "12px";
                potentialPopup.style.fontFamily = "monospace";
                potentialPopup.style.fontWeight = "bold";
                potentialPopup.style.color = "black";
                potentialPopup.style.boxShadow = "0 0 10px 0 rgba(0,0,0,0.5)";
                potentialPopup.style.whiteSpace = "pre-wrap";
                for (const datatype of datatypes) {
                    const p = document.createElement("p");
                    p.innerText = datatype;
                    potentialPopup.appendChild(p);
                }
                port_label.appendChild(potentialPopup);
                if (yukon_state && yukon_state.monitor2) {

                }
            }

        });
        monitor2Div.appendChild(port_label);
        let toggledOn = { value: false };
        linesByPortAndPortType.push({ "element": line, "port": port.port, "type": "vertical", "toggledOn": toggledOn });
        // Create a collider for the line
        const line_collider = document.createElement("div");
        line_collider.setAttribute("data-port", port.port);
        line_collider.setAttribute("data-port-type", port.type);
        line_collider.classList.add("line_collider");
        line_collider.style.width = settings["VerticalColliderWidth"] + "px";
        line_collider.style.position = "absolute";
        line_collider.style.height = line.style.height;
        line_collider.style.top = line.style.top;
        line_collider.style.left = port.x_offset - ((settings["VerticalColliderWidth"] - 1) / 2) + "px";
        line_collider.style.zIndex = "2";
        line_collider.style.backgroundColor = "transparent";
        line_collider.style.cursor = "pointer";
        // line_collider.addEventListener("mouseover", () => {
        //     if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
        //         line.style.setProperty("background-color", "red");
        //     }
        // });
        // line_collider.addEventListener("mouseout", () => {
        //     if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
        //         line.style.removeProperty("background-color");
        //     }
        // });
        line_collider.addEventListener("click", () => {
            toggledOn.value = !toggledOn.value;
            changeStateOfElement(port.port, toggledOn.value, false, yukon_state);
        });
        monitor2Div.appendChild(line_collider);
        monitor2Div.appendChild(line);
    }
    if (publishers_and_services.length > 0) {
        settings.SubscriptionsOffset = publishers_and_services[publishers_and_services.length - 1].x_offset + settings.DistanceBetweenLines + 10;
    }
}