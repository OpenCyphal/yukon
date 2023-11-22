import { areThereAnyNewOrMissingHashes, updateLastHashes } from "../../hash_checks.module.js";
import { getRelatedLinks, decodeTelegaVSSC } from "../../meanings.module.js";
import { waitForElm, getKnownDatatypes, doCommandFeedbackResult } from "../../utilities.module.js";
import {
    getHoveredContainerElementAndContainerObject,
    secondsToColonSeparatedString,
    getDatatypesForPort,
    getUnassignedPortsForNode
} from "../../utilities.module.js";
import { fillSettings } from "./fill_settings.module.js";
import { highlightElement, highlightElements, removeHighlightsFromObjects, removeHighlightFromElement, unhighlightAll, setPortStateAsHiglighted, setPortStateAsUnhiglighted, isPortStateHighlighted } from "./highlights.module.js";
import { drawSubscriptions } from "./subscriptions.module.js";
import { updatePublishers } from "./publishers.module.js";

const settings = {};

let linesByPortAndPortType = [];

const portOrder = { "pub": 0, "sub": 1, "srv": 2, "cli": 3 }
const portOrder2 = ["pub", "sub", "srv", "cli"]

function comparePorts(a, b) {
    // Compare ports by type and port number (port) for sorting
    if (a === "all") {
        return -1;
    } else if (b === "all") {
        return 1;
    } else if (a === "all" && b === "all") {
        console.error("This is bad, both a and b are 'all'");
        return 0;
    }
    const aPortOrder = portOrder[a.type];
    const bPortOrder = portOrder[b.type];
    if (aPortOrder < bPortOrder) {
        return -1;
    }
    if (aPortOrder > bPortOrder) {
        return 1;
    }
    if (parseInt(a.port) < parseInt(b.port)) {
        return 1;
    }
    if (parseInt(a.port) > parseInt(b.port)) {
        return -1;
    }
    return 0;
}

export async function setUpMonitor2Component(container, yukon_state) {
    const containerElement = container.getElement()[0];
    yukon_state.monitor2ContainerElement = containerElement;
    const monitor2Div = await waitForElm("#monitor2", 7000, this);
    monitor2Div.parentElement.classList.add("monitor2-parent");
    if (monitor2Div === null) {
        console.error("monitor2Div is null");
        return;
    } else {
    }
    fillSettings(settings, yukon_state);
    const subscriptionsOuterArea = containerElement.querySelector("#subscriptions-outer-area");
    const publishersOuterArea = containerElement.querySelector("#publishers-outer-area");
    const subscriptionsInnerArea = document.createElement("div");
    setInterval(async () => {
        await updatePublishers(subscriptionsInnerArea, yukon_state);
    }, 1500);
    subscriptionsInnerArea.id = "subscriptions-inner-area";
    subscriptionsInnerArea.style.position = "absolute";
    subscriptionsOuterArea.appendChild(subscriptionsInnerArea);
    setInterval(async () => {
        if (settings.SubscriptionsOffset) {
            subscriptionsInnerArea.style.left = settings.SubscriptionsOffset + "px";
            subscriptionsInnerArea.style.top = settings.SubscriptionsVerticalOffset + "px";
            // yukon_state.publishers = await yukon_state.zubax_apij.get_publishers();
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
            // console.warn("Subscriptions offset is not set");
        }

    }, 1500);
    setInterval(async () => {
        await update_monitor2(containerElement, monitor2Div, yukon_state);
    }, 1000);
    let escape_timer = null;
    document.addEventListener('keydown', function (e) {
        if (e.code === "Escape") {
            const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
            if (!returnArray) { return; }
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
function addMissingPorts(avatar, yukon_state) {
    // This function sees if there are any assigned subject ids in register values that need to be added to the ports
    // This is needed because sometimes a node will not publish its status on its ports to the port list subject
    // Iterate through all registers in the avatar
    for (const [name, value] of Object.entries(avatar.registers_values)) {

        const regex = /uavcan\.(pub|sub|cln|srv)\.(.+?)\.id/;
        // Use regex to extract the first and second ground, first group is link_type and second group is link_name from register_name
        const results = name.match(regex);
        if (!results) continue;
        const link_type = results[1];
        const link_name = results[2];
        if ((link_type === "pub" || link_type === "sub") && parseInt(value) > 8191) {
            continue;
        } else if ((link_type === "srv" || link_type === "cln") && parseInt(value) > 511) {
            continue;
        }
        if (avatar.ports[link_type] && avatar.ports[link_type].indexOf(parseInt(value)) === -1) {
            avatar.ports[link_type].push(parseInt(value));
        }
    }
}
function validateNewPortId(type, id) {
    if (parseInt(id) === 65535) { return true; }
    if (type === "pub" || type === "srv") {
        for (const port of yukon_state.monitor2.ports) {
            if (port.type === type && parseInt(port.port) === parseInt(id)) {
                return false
            }
        }
    }
    return true;
}
async function update_monitor2(containerElement, monitor2Div, yukon_state, forced_update) {
    if (!forced_update && !areThereAnyNewOrMissingHashes("monitor2_hash", yukon_state)) {
        updateLastHashes("monitor2_hash", yukon_state);
        // If there are any elements in my_graph.elements() then we can return, otherwise we need to make a graph (below)
        if (isContainerPopulated(monitor2Div)) {
            return;
        }
    }
    if (yukon_state.is_monitor2_update_in_progress) {
        setTimeout(() => {
            update_monitor2(containerElement, monitor2Div, yukon_state, true);
        }, 100);
        return;
    } else {
        yukon_state.is_monitor2_update_in_progress = true;
    }
    updateLastHashes("monitor2_hash", yukon_state);
    yukon_state.monitor2LastScrollTop = monitor2Div.parentElement.scrollTop;
    let listOfNewChildren = {
        nodes: [],
        appendChild(child) {
            this.nodes.push(child);
        },
    };
    for (const color of settings.HighlightColors) {
        color.taken = false;
    }
    // Add all nodes
    let y_counter = { value: settings["PageMarginTop"] };
    yukon_state.monitor2 = {};
    yukon_state.monitor2.ports = [];
    let ports = yukon_state.monitor2.ports;

    for (const avatar of yukon_state.current_avatars) {
        addMissingPorts(avatar, yukon_state);
        for (const port_type of Object.keys(avatar.ports)) {
            // TODO: If the maximum amount of 8192 changes, then this needs to be changed too.
            if (avatar.ports[port_type].length === 8192) {
                // Just going to create a port entry titled all
                ports.push({ "type": port_type, "port": "all", "x_offset": 0 });
                continue;
            }
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
    // This is the text status part
    for (const avatar of avatars_copy) {
        const node_id = avatar.node_id;
        const get_up_to_date_avatar = () => { return yukon_state.current_avatars.find(a => a.node_id === node_id); };
        // Add the sizes of ports.cln, ports.srv, ports.pub, ports.sub
        const fieldsObject = {
            "Name": avatar.name,
            "Software Version": avatar.versions.software_version,
            "Hardware Version": avatar.versions.hardware_version,
            // "――――――――――――――――――――": "",
            "Node ID": avatar.node_id,
            "Uptime": secondsToColonSeparatedString(avatar.last_heartbeat.uptime),
            "Health": avatar.last_heartbeat.health_text,
            "VSSC": avatar.last_heartbeat.vendor_specific_status_code
        };
        if (avatar.last_heartbeat) {
            try {
                fieldsObject["Mode"] = avatar.last_heartbeat.mode;
                switch (avatar.last_heartbeat.mode) {
                    case 0:
                        fieldsObject["Mode"] = "OPERATIONAL";
                        break;
                    case 1:
                        fieldsObject["Mode"] = "INITIALIZATION";
                        break;
                    case 2:
                        fieldsObject["Mode"] = "MAINTENANCE";
                        break;
                    case 3:
                        fieldsObject["Mode"] = "SOFTWARE UPDATE";
                        break;
                }
            } catch (e) {
                logger.error("Error while trying to get mode from last_heartbeat", e);
            }
        }
        if (avatar.disappeared) {
            fieldsObject["Disappeared since"] = avatar.disappeared_since;
        }
        const node = createElementForNode(avatar, "", listOfNewChildren, fieldsObject, get_up_to_date_avatar, yukon_state);
        nodesToBePositioned.push([node, avatar]);
    }
    for (const [node, avatar] of nodesToBePositioned) {
        let total_empty_ports = getUnassignedPortsForNode(avatar.node_id, yukon_state).length;
        if (total_empty_ports > 0) {
            total_empty_ports += 1; // Adds one length of settings["DistancePerHorizontalConnection"] for that is used there as spacing
        }
        const total_ports = avatar.ports.cln.length + avatar.ports.srv.length + avatar.ports.pub.length + avatar.ports.sub.length + total_empty_ports;
        console.assert(total_ports >= 0);
        let avatar_height = total_ports * settings["DistancePerHorizontalConnection"] + settings["AvatarConnectionPadding"];
        node.style.height = avatar_height + "px";
        node.style.top = y_counter.value + "px";
        let avatar_y_counter = { value: settings["AvatarConnectionPadding"] };
        let avatar_ports_all_in_one = [];
        for (const portType of portOrder2) {
            if (avatar.ports[portType]) {
                const portsForType = avatar.ports[portType];
                if (portsForType.length === 8192) {
                    // Just going to create a port entry titled all
                    avatar_ports_all_in_one.push({ "port": "all", "type": portType });
                    continue;
                }
                for (const port of portsForType) {
                    avatar_ports_all_in_one.push({ "port": port, "type": portType });
                }
            }
        }


        avatar_ports_all_in_one.sort(comparePorts)
        for (const port of avatar_ports_all_in_one) {
            const matchingPort = ports.find(p => p.port === port.port && p.type === port.type);
            if (matchingPort === undefined || (matchingPort && matchingPort.x_offset === 0)) {
                continue;
            }
            // Getting info about more links than necessary for later highlighting purposes
            const relatedLinks = getRelatedLinks(port.port, port.type, yukon_state);
            const currentLinkObjects = relatedLinks.filter(link => link.port === port.port && link.type === matchingPort.type && link.node_id === avatar.node_id);
            function doStuff(currentLinkObject) {
                let toggledOn = { value: false };
                let currentLinkDsdlDatatype = null;
                let fixed_datatype_short = null;
                let fixed_datatype_full = null;
                if (datatypes_response["fixed_id_messages"] && datatypes_response["fixed_id_messages"][port.port] !== undefined) {
                    const type_of_interest = datatypes_response["fixed_id_messages"][port.port];
                    const is_a_service_and_for_a_service = type_of_interest.is_service && (port.type === "cln" || port.type === "srv");
                    const is_a_message_and_for_a_message = !type_of_interest.is_service && (port.type === "pub" || port.type === "sub");
                    if (is_a_service_and_for_a_service || is_a_message_and_for_a_message) {
                        fixed_datatype_short = datatypes_response["fixed_id_messages"][port.port]["short_name"];
                        fixed_datatype_full = datatypes_response["fixed_id_messages"][port.port]["name"];
                    }
                }
                if (currentLinkObject && !fixed_datatype_full) {
                    currentLinkDsdlDatatype = currentLinkObject.datatype || "";
                    if (currentLinkObject.name && !settings.ShowLinkNameOnSeparateLine) {
                        currentLinkDsdlDatatype = currentLinkObject.name + ":" + currentLinkDsdlDatatype;
                    }
                } else {
                    currentLinkDsdlDatatype = fixed_datatype_full;
                }
                if(currentLinkDsdlDatatype) {
                    currentLinkDsdlDatatype = fixed_datatype_full;
                } else {
                    // Handling a special case where the developer of a Cyphal node hasn't got registers set up for data type names
                    // https://github.com/OpenCyphal/public_regulated_data_types/blob/935973babe11755d8070e67452b3508b4b6833e2/uavcan/register/384.Access.1.0.dsdl#L154-L162
                    // https://forum.opencyphal.org/t/developing-pico-node-using-yukon/1978
                    // addHorizontalElements is going to give this a message and also make it clickable and hinted so that the link can be had from the label.
                    currentLinkDsdlDatatype = null;
                }
                let isLast = false;
                // If this is the last iteration of the loop, set a variable to true
                if (port === avatar_ports_all_in_one[avatar_ports_all_in_one.length - 1]) {
                    isLast = true;
                }
                addHorizontalElements(listOfNewChildren, matchingPort, currentLinkDsdlDatatype, toggledOn, y_counter, avatar_y_counter, currentLinkObject, isLast, settings, yukon_state);

                avatar_y_counter.value += settings["DistancePerHorizontalConnection"];
            }
            if (currentLinkObjects.length === 0) {
                doStuff(null);
            }
            for (const currentLinkObject of currentLinkObjects) {
                doStuff(currentLinkObject);
            }
        }
        if (avatar_y_counter.value < settings.AvatarMinHeight) {
            avatar_y_counter.value = settings.AvatarMinHeight;
        }
        avatar_y_counter.value += settings.EmptyPortsDistanceAboveUnassignedPorts;
        addEmptyPorts(node, avatar_y_counter, avatar.node_id, yukon_state);
        y_counter.value += avatar_y_counter.value + settings["DistanceBetweenNodes"];

        node.style.height = avatar_y_counter.value + "px";
    }
    addVerticalLines(listOfNewChildren, ports, y_counter, containerElement, settings, yukon_state);
    monitor2Div.innerHTML = "";
    for (const child of listOfNewChildren.nodes) {
        monitor2Div.appendChild(child);
    }
    monitor2Div.parentElement.scrollTop = yukon_state.monitor2LastScrollTop;
    yukon_state.is_monitor2_update_in_progress = false;
}
function isPortOkForAssignment(port_nr, yukon_state) {
    return port_nr < 65535 && port_nr > 0;
}
const portTypeToLongTypeExplanation = {
    "pub": "This is a publisher",
    "sub": "This is a subscriber",
    "srv": "This is a service"
}
function addEmptyPorts(node, avatar_y_counter, node_id, yukon_state) {
    const emptyPortInfo = getUnassignedPortsForNode(node_id, yukon_state); //  [{"link_name": "power", link_type: "sub", "name": "uavcan.sub.power.id"}, {"link_name": "dynamics" ...}]
    // Add a label saying "Unassigned ports" if there are any
    if (emptyPortInfo.length > 0) {
        const label = document.createElement("div");
        label.style.position = "absolute";
        label.style.top = avatar_y_counter.value - 15 + "px";
        label.style.setProperty("left", settings["NodeXOffset"] + settings["NodeWidth"] + "px");
        label.style.width = "170px";
        label.innerText = "Unassigned ports";
        node.appendChild(label);
    }

    // Create a new div for each empty port, align it and style it just like port_number_label below in code
    for (const portInfo of emptyPortInfo) {
        const designatedHeight = settings["DistancePerHorizontalConnection"] - 0;
        const emptyPortDiv = document.createElement("div");
        emptyPortDiv.classList.add("port_number_label");
        emptyPortDiv.classList.add("empty_port");
        emptyPortDiv.style.height = designatedHeight + "px";
        emptyPortDiv.style.position = "absolute";
        emptyPortDiv.style.top = avatar_y_counter.value + "px";
        emptyPortDiv.style.zIndex = 4;
        emptyPortDiv.innerText = portInfo.link_name;
        emptyPortDiv.title = portTypeToLongTypeExplanation[portInfo.link_type] || "";

        if (portInfo.link_type === "srv") {
            emptyPortDiv.style.backgroundColor = settings["ServicePortLabelBgColor"];
            emptyPortDiv.style.setProperty("color", settings["ServicePortLabelColor"], "important");
        } else if (portInfo.link_type === "pub") {
            emptyPortDiv.style.backgroundColor = settings["PublisherPortLabelBgColor"];
            emptyPortDiv.style.setProperty("color", settings["PublisherPortLabelColor"], "important");
        } else if (portInfo.link_type === "sub") {
            emptyPortDiv.style.backgroundColor = settings["SubscriberPortLabelBgColor"];
            emptyPortDiv.style.setProperty("color", settings["SubscriberPortLabelColor"], "important");
        }
        // Align text right
        emptyPortDiv.style.setProperty("text-align", "right");
        // align it 50px to the left from the left side of the horizontal line
        emptyPortDiv.style.setProperty("left", settings["NodeXOffset"] + settings["NodeWidth"] + "px");
        // When hovered over emptyPortDiv, replace the innerText with portInfo.datatype
        if (yukon_state.all_settings["Monitor view"]["Display unassigned port name and datatype on two lines"]) {
            emptyPortDiv.innerText = portInfo.link_name + "\n" + portInfo.datatype;
        } else {
            emptyPortDiv.onmouseover = function () {
                emptyPortDiv.innerText = portInfo.datatype;
            };
            // When mouse leaves emptyPortDiv, replace the innerText with portInfo.link_name
            emptyPortDiv.onmouseout = function () {
                emptyPortDiv.innerText = portInfo.link_name;
            };
        }
        emptyPortDiv.style.width = settings.LinkInfoWidth + "px";
        emptyPortDiv.addEventListener("mouseover", function () {
            emptyPortDiv.style.width = settings.LinkInfoWidth * 3 + "px";
        });
        emptyPortDiv.addEventListener("mouseout", function () {
            emptyPortDiv.style.width = settings.LinkInfoWidth + "px";
        });
        node.appendChild(emptyPortDiv);

        // Also create a number input that has left set to settings["NodeXOffset"] + settings["NodeWidth"] - 190 + "px", the text input should have a placeholder of "Enter new port number"
        // The width of the text input should be 170px
        const number_input = document.createElement("input");
        number_input.type = "number";
        number_input.style.position = "absolute";
        number_input.style.top = avatar_y_counter.value + "px";
        number_input.style.right = "0px";
        number_input.style.width = "130px";
        number_input.style.height = designatedHeight + "px";;
        number_input.placeholder = "New subject id";
        number_input.classList.add("port_number_label");
        number_input.title = "Enter a new subject id";
        if (portInfo.link_type === "srv") {
            number_input.style.setProperty("background-color", settings["ServicePortLabelBgColor"], "important");
            number_input.style.setProperty("color", settings["ServicePortLabelColor"], "important");
        } else if (portInfo.link_type === "pub") {
            number_input.style.setProperty("background-color", settings["PublisherPortLabelBgColor"], "important");
            number_input.style.setProperty("color", settings["PublisherPortLabelColor"], "important");
        } else if (portInfo.link_type === "sub") {
            number_input.style.setProperty("background-color", settings["SubscriberPortLabelBgColor"], "important");
            number_input.style.setProperty("color", settings["SubscriberPortLabelColor"], "important");
        }
        number_input.addEventListener("change", async function () {
            if (number_input.value === "") {
                number_input.value = 65535;
            }
            if (!validateNewPortId(portInfo.link_type, number_input.value)) {
                number_input.style.textDecoration = "underline";
                return;
            }
            number_input.style.textDecoration = "none;"
            // Assign value
            const response = await zubax_apij.update_register_value(portInfo.register_name, JSON.parse(`{"_meta_": {"mutable": true, "persistent": true}, "natural16": {"value": [${number_input.value}]}}`), node_id);
            if (response.success) {
                console.log("The port identifier for " + portInfo.name + " was successfully updated to " + number_input.value);
                yukon_state.addLocalMessage("Usually it is the case that you should now restart the node before the device applies its changes", 30)
                let restartButton = document.querySelector("#btn" + node_id + "_Restart");
                if (restartButton) {
                    // Previous background color
                    const previousBackgroundColor = restartButton.style.backgroundColor;
                    // Flash it 3 times
                    for (let i = 0; i < 3; i++) {
                        restartButton = document.querySelector("#btn" + node_id + "_Restart");
                        restartButton.title = "You should restart this node to apply the changes to port identifiers."
                        restartButton.style.setProperty("background-color", "red", "important");
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        restartButton.style.setProperty("background-color", previousBackgroundColor, "important");
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        });
        node.appendChild(number_input);
        avatar_y_counter.value += settings["DistancePerHorizontalConnection"];
    }
    avatar_y_counter.value += 0;
}
function createElementForNode(avatar, text, container, fieldsObject, get_up_to_date_avatar, yukon_state) {
    // Verify that the avatar is not undefined
    console.assert(avatar !== undefined);
    let node = document.createElement("div");
    node.setAttribute("data-node-id", avatar.node_id)
    node.classList.add("node");
    if (avatar.disappeared) {
        node.classList.add("disappeared");
    }
    if (avatar.is_being_queried || !avatar.has_port_list) {
        node.classList.add("is_being_queried");
    }
    node.style.left = settings.NodeXOffset + "px";
    // Delay the setting of height until its contents are loaded
    node.style.setProperty("border-sizing", "border-box");
    node.style.width = settings.NodeWidth + "px";
    // node.style.backgroundColor = avatar.color;
    node.innerText = text;
    if (avatar.is_being_queried) {
        node.innerText += " (looking for registers...)";
    } else if (!avatar.has_port_list) {
        node.innerText += " (no port list)";
    }
    container.appendChild(node);
    for (const field of Object.keys(fieldsObject)) {
        const containerDiv = document.createElement("div");
        containerDiv.classList.add("flex-row");
        const fieldDiv = document.createElement("div");
        containerDiv.appendChild(fieldDiv);
        fieldDiv.classList.add("d-inline-flex", "field");
        if (field === "VSSC" && fieldsObject["Name"] === "com.zubax.telega") {
            fieldsObject[field] = decodeTelegaVSSC(fieldsObject["Health"], fieldsObject["Mode"], parseInt(fieldsObject[field])) + " (" + fieldsObject[field] + ")";
        }
        fieldDiv.innerHTML = field;
        fieldDiv.style.fontWeight = "bold";
        const valueDiv = document.createElement("div");
        containerDiv.appendChild(valueDiv);
        node.appendChild(containerDiv);
        valueDiv.classList.add("d-inline-flex", "value");
        valueDiv.style.setProperty("margin-left", "5px");
        valueDiv.innerHTML = fieldsObject[field];
        // If it's the last field then set a margin-bottom
        if (field == Object.keys(fieldsObject)[Object.keys(fieldsObject).length - 1]) {
            containerDiv.style.marginBottom = "6px";
        }
        valueDiv.style.removeProperty("color");
        valueDiv.style.removeProperty("background-color");
        // This is for Health status
        if (field === "Health") {
            valueDiv.style.paddingLeft = "3px";
            valueDiv.style.paddingRight = "3px";
            if (fieldsObject[field] === "NOMINAL") {
                valueDiv.style.backgroundColor = "green";
            } else if (fieldsObject[field] === "CAUTION") {
                valueDiv.style.backgroundColor = "orange";
            } else if (fieldsObject[field] === "WARNING") {
                valueDiv.style.backgroundColor = "red";
            } else if (fieldsObject[field] === "ADVISORY") {
                valueDiv.style.backgroundColor = "yellow";
                valueDiv.style.color = "black";
            }
        }
        if (field === "Mode") {
            valueDiv.style.paddingLeft = "3px";
            valueDiv.style.paddingRight = "3px";
            if (fieldsObject[field] === "OPERATIONAL") {
                valueDiv.style.backgroundColor = "green";
            } else if (fieldsObject[field] === "INITIALIZATION") {
                valueDiv.style.backgroundColor = "pink";
            } else if (fieldsObject[field] === "MAINTENANCE") {
                valueDiv.style.backgroundColor = "yellow";
                valueDiv.style.color = "black";
            } else if (fieldsObject[field] === "SOFTWARE_UPDATE") {
                valueDiv.style.backgroundColor = "blue";
            }
        }
        if (field === "Uptime") {
            let intervalId = null;
            intervalId = setInterval(() => {
                if (get_up_to_date_avatar) {
                    const the_updated_avatar = get_up_to_date_avatar();
                    if (!the_updated_avatar) {
                        clearInterval(intervalId);
                        return;
                    }
                    valueDiv.innerHTML = secondsToColonSeparatedString(the_updated_avatar.last_heartbeat.uptime);
                    if (!valueDiv || !valueDiv.parentElement) {
                        clearInterval(intervalId);
                    }
                } else {
                    clearInterval(intervalId);
                }
            }, 1000);
        }
    }
    // Add an empty label in a variable called feedbackMessage
    const feedbackMessage = document.createElement("div");
    feedbackMessage.classList.add("feedback_message");
    feedbackMessage.style.display = "none";
    node.appendChild(feedbackMessage);

    // Make an input-group for the buttons
    const inputGroup = document.createElement("div");
    inputGroup.classList.add("input-group");
    inputGroup.style.width = "100%";
    inputGroup.style.setProperty("backgroundColor", "transparent", "important");
    let neededButtons = [{ "name": "Restart", "command": "65535", "title": "Restart device" }, { "name": "Save", "command": "65530", "title": "Save persistent states" }, { "name": "Estop", "command": "65531", "title": "Emergency stop" }];
    for (const button of neededButtons) {
        const btnButton = document.createElement("button");
        btnButton.style.fontSize = "12px";
        btnButton.id = "btn" + avatar.node_id + "_" + button.name;
        btnButton.classList.add("btn_button");
        btnButton.style.flexGrow = "2";
        btnButton.classList.add("btn");
        btnButton.classList.add("btn-primary");
        btnButton.classList.add("btn-sm");
        btnButton.innerHTML = button.name;
        btnButton.title = button.title;
        btnButton.onclick = async () => {
            const result = await yukon_state.zubax_apij.send_command(avatar.node_id, button.command, "");
            doCommandFeedbackResult(result, feedbackMessage);
        };
        inputGroup.appendChild(btnButton);
    }
    node.appendChild(inputGroup);
    const telegaButtons = [{ "name": "Cancel", "command": "0", "title": "Cancel" }, { "name": "SelfTest", "command": "1", "title": "SelfTest" }, { "name": "MotorID", "command": "2", "title": "MotorID" }];
    if (fieldsObject && fieldsObject["Name"] && fieldsObject["Name"].includes("telega")) {
        const telegaLink = document.createElement("a");
        telegaLink.innerHTML = "Telega docs";
        telegaLink.target="_blank";
        telegaLink.href = "https://telega.zubax.com/index.html";
        node.appendChild(telegaLink);
        const telegaInputGroup = document.createElement("div");
        telegaInputGroup.classList.add("input-group");
        telegaInputGroup.style.width = "100%";
        telegaInputGroup.style.setProperty("backgroundColor", "transparent", "important");
        for (const button of telegaButtons) {
            const btnButton = document.createElement("button");
            btnButton.style.fontSize = "12px";
            btnButton.id = "btn" + avatar.node_id + "_" + button.name;
            btnButton.classList.add("btn_button");
            btnButton.style.flexGrow = "2";
            btnButton.classList.add("btn");
            btnButton.classList.add("btn-primary");
            btnButton.classList.add("btn-sm");
            btnButton.innerHTML = button.name;
            btnButton.title = button.title;
            btnButton.onclick = async () => {
                const result = await yukon_state.zubax_apij.send_command(avatar.node_id, button.command, "");
                doCommandFeedbackResult(result, feedbackMessage);
            };
            telegaInputGroup.appendChild(btnButton);
        }
        node.appendChild(telegaInputGroup);
    }

    

    // Add an input-group input-group-text for command id and command text argument, both should have inputs. Then add a send command button
    const customCommandInputGroup = document.createElement("div");
    customCommandInputGroup.classList.add("input-group");
    customCommandInputGroup.style.setProperty("backgroundColor", "transparent", "important");
    const customCommandIdInput = document.createElement("input");
    customCommandIdInput.classList.add("form-control");
    customCommandIdInput.type = "number";
    customCommandIdInput.style.fontSize = "12px";
    customCommandIdInput.style.width = "40%";
    customCommandIdInput.placeholder = "Cmd";
    customCommandInputGroup.appendChild(customCommandIdInput);
    const customCommandTextInput = document.createElement("input");
    customCommandTextInput.classList.add("form-control");
    customCommandTextInput.style.fontSize = "12px";
    customCommandTextInput.style.width = "60%";
    customCommandTextInput.placeholder = "Parameters";
    customCommandInputGroup.appendChild(customCommandTextInput);
    const customCommandSendButton = document.createElement("button");
    customCommandSendButton.classList.add("btn_button");
    customCommandSendButton.classList.add("btn");
    customCommandSendButton.classList.add("btn-primary");
    customCommandSendButton.classList.add("btn-sm");
    customCommandSendButton.style.fontSize = "12px";
    customCommandSendButton.style.width = "100%";
    customCommandSendButton.innerHTML = "Send command";
    customCommandSendButton.onclick = async () => {
        const result = await yukon_state.zubax_apij.send_command(avatar.node_id, customCommandIdInput.value, customCommandTextInput.value);
        doCommandFeedbackResult(result, feedbackMessage);
    };

    customCommandInputGroup.appendChild(customCommandSendButton);
    node.appendChild(customCommandInputGroup);

    const inputGroup2 = document.createElement("div");
    inputGroup2.classList.add("input-group");
    inputGroup2.style.fontSize = "12px";
    inputGroup2.style.setProperty("backgroundColor", "transparent", "important");
    // Add a button for firmware update
    const btnFirmwareUpdate = document.createElement("button");
    btnFirmwareUpdate.style.width = "100%";
    btnFirmwareUpdate.title = "Please also enable firmware update in settings and choose the correct folder there."
    btnFirmwareUpdate.style.fontSize = "12px";
    btnFirmwareUpdate.classList.add("btn_button", "btn", "btn-secondary", "btn-sm");
    btnFirmwareUpdate.innerHTML = "Choose firmware";
    btnFirmwareUpdate.addEventListener("click", async function () {
        let path = "";
        path = await window.electronAPI.openPath({
            properties: ["openFile"],
        });
        if (path) {
            const result = await yukon_state.zubax_apij.send_command(avatar.node_id, 65533, path);
            doCommandFeedbackResult(result, feedbackMessage);
        }
    });
    inputGroup2.appendChild(btnFirmwareUpdate);
    // Add a more button
    const btnMore = document.createElement("button");
    btnMore.classList.add("btn_button", "btn", "btn-secondary", "btn-sm");
    btnMore.innerHTML = "...";
    btnMore.title = "More commands"
    btnMore.style.display = "none";

    btnMore.addEventListener("click", async function () {
        yukon_state.commandsComponent.parent.parent.setActiveContentItem(yukon_state.commandsComponent.parent);
        let commandsElement = yukon_state.commandsComponent.getElement()[0];
        // Tween feedbackMessage.style.backgroundColor from sepia to green
        const starting_color_rgb = window.getComputedStyle(commandsElement, null).getPropertyValue('background-color').replace("rgb(", "").replace(")", "").split(",").map((x) => parseInt(x));
        const increments_to_take = 144;
        const ending_color_rgb = starting_color_rgb.slice();
        let addedTint = -10;
        if (starting_color_rgb[1] < 125) {
            // This is dark mode
            addedTint = 15; // Make it lighter
        } else {
            // This is light mode
            addedTint = -15; // Make it darker
        }
        ending_color_rgb[1] = ending_color_rgb[1] + addedTint;
        let increment_counter = 0;

        let tweenFromCounter = increments_to_take;
        let tweenFromFunction = () => {
            let new_color = [];
            for (let i = 0; i < 3; i++) {
                new_color.push(starting_color_rgb[i] + (ending_color_rgb[i] - starting_color_rgb[i]) * tweenFromCounter / increments_to_take);
            }
            commandsElement.style.backgroundColor = `rgb(${new_color[0]}, ${new_color[1]}, ${new_color[2]})`;
            if (tweenFromCounter > 0) {
                tweenFromCounter--;
                window.requestAnimationFrame(tweenFromFunction);
            } else {
                commandsElement.style.removeProperty("background-color");
            }
        };

        let tweenToFunction = null;
        tweenToFunction = () => {
            let new_color = [];
            for (let i = 0; i < 3; i++) {
                new_color.push(starting_color_rgb[i] + (ending_color_rgb[i] - starting_color_rgb[i]) * increment_counter / increments_to_take);
            }
            commandsElement.style.backgroundColor = `rgb(${new_color[0]}, ${new_color[1]}, ${new_color[2]})`;
            if (increment_counter < increments_to_take) {
                increment_counter++;
                window.requestAnimationFrame(tweenToFunction);
            } else {
                window.requestAnimationFrame(tweenFromFunction);
            }
        };


        window.requestAnimationFrame(tweenToFunction);
        // yukon_state.commandsComponent.parent.parent.toggleMaximise();
    });
    inputGroup2.appendChild(btnMore);
    node.appendChild(inputGroup2);
    node.addEventListener("click", function () {
        let queue = []
        for (const element of yukon_state.myLayout.root.contentItems) {
            queue.push(element);
        }
        while (true) {
            const currentElement = queue.shift();
            if (currentElement) {
                if (currentElement.isStack && currentElement.getActiveContentItem().config.hasOwnProperty("componentName")) {
                    if (currentElement.getActiveContentItem().config.componentName === "commandsComponent") {
                        const commandsComponentOuterElement = currentElement.getActiveContentItem().element[0];
                        const nodeIdInput = commandsComponentOuterElement.querySelector("#iNodeId");
                        nodeIdInput.value = avatar.node_id;
                    }
                } else {
                    for (const contentItem of currentElement.contentItems) {
                        queue.push(contentItem)
                    }
                }
            } else {
                break;
            }
        }
    });

    return node;
}
function addHorizontalElements(monitor2Div, matchingPort, currentLinkDsdlDatatype, toggledOn, y_counter, avatar_y_counter, currentLinkObject, isLast, settings, yukon_state) {
    let horizontal_line = null;
    let arrowhead = null;
    horizontal_line = document.createElement("div");
    horizontal_line.classList.add("horizontal_line");
    horizontal_line.style.top = y_counter.value + avatar_y_counter.value + settings.HorizontalLineYOffset + "px";
    horizontal_line.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + "px";
    horizontal_line.style.width = matchingPort.x_offset - settings["NodeXOffset"] - settings["NodeWidth"] + "px";
    horizontal_line.style.height = settings.HorizontalLineWidth + "px";
    monitor2Div.appendChild(horizontal_line);
    // Create an invisible collider div for horizontal_line, it should have a height of 10px
    const horizontal_line_collider = document.createElement("div");
    horizontal_line_collider.classList.add("horizontal_line_collider");
    horizontal_line_collider.setAttribute("data-port", matchingPort.port);
    horizontal_line_collider.setAttribute("data-port-type", matchingPort.type);
    horizontal_line_collider.style.top = y_counter.value + avatar_y_counter.value + settings.HorizontalLineYOffset - settings["HorizontalColliderOffsetY"] + "px";
    horizontal_line_collider.style.left = horizontal_line.style.left;
    horizontal_line_collider.style.width = horizontal_line.style.width;
    horizontal_line_collider.style.height = settings["HorizontalColliderHeight"] + "px";
    horizontal_line_collider.style.zIndex = "1";
    horizontal_line_collider.style.position = "absolute";
    horizontal_line_collider.style.backgroundColor = "transparent";
    horizontal_line_collider.style.cursor = "pointer";
    monitor2Div.appendChild(horizontal_line_collider);
    let link_name_label = null;

    link_name_label = document.createElement("label");
    link_name_label.classList.add("link_name_label");
    link_name_label.style.top = y_counter.value + avatar_y_counter.value + settings.HorizontalLineYOffset - settings.LinkNameOffset + "px";
    link_name_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
    link_name_label.style.width = "fit-content";
    link_name_label.style.zIndex = "3";
    link_name_label.style.position = "absolute";
    link_name_label.style.backgroundColor = "transparent";
    link_name_label.style.cursor = "pointer";
    if (settings.ShowLinkNameOnSeparateLine && currentLinkObject && typeof currentLinkObject === "object" && currentLinkObject.name) {
        link_name_label.innerHTML = currentLinkObject.name || "";
    }
    monitor2Div.appendChild(link_name_label);
    // Place a label above the horizontal line at the left side
    const horizontal_line_label = document.createElement("label");
    horizontal_line_label.classList.add("horizontal_line_label");
    horizontal_line_label.style.top = y_counter.value + avatar_y_counter.value + settings.HorizontalLineYOffset - settings["HorizontalLabelOffsetY"] + 5 + "px";
    horizontal_line_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
    horizontal_line_label.style.width = "fit-content"; // settings.LinkInfoWidth  - settings.LabelLeftMargin + "px";
    horizontal_line_label.style.height = "fit-content";
    horizontal_line_label.style.position = "absolute";
    if (currentLinkDsdlDatatype.endsWith(".Response") || currentLinkDsdlDatatype.endsWith(".Request")) {
        currentLinkDsdlDatatype = currentLinkDsdlDatatype.replace(".Response", "").replace(".Request", "");
    }
    if(!currentLinkDsdlDatatype) {
        horizontal_line_label.addEventListener("mousedown", () => {
            console.error(```
                            Please make sure that registers exist for data type names for publication/subscription/client/server.
                            https://github.com/OpenCyphal/public_regulated_data_types/blob/935973babe11755d8070e67452b3508b4b6833e2/uavcan/register/384.Access.1.0.dsdl#L154-L162
                            ```);
        });
        horizontal_line_label.title = "Click for more information in console."
        currentLinkDsdlDatatype = "Missing data type name registers.";
    }
    horizontal_line_label.innerHTML = currentLinkDsdlDatatype;
    horizontal_line_label.style.zIndex = "3";
    // horizontal_line_label.style.backgroundColor = settings["LinkLabelColor"];
    // horizontal_line_label.style.color = settings["LinkLabelTextColor"];
    horizontal_line_label.addEventListener("mouseover", () => {
        horizontal_line_label.style.setProperty("background-color", settings["LinkLabelHighlightColor"], "important");
        horizontal_line_label.style.setProperty("color", settings["LinkLabelHighlightTextColor"], "important");
    });
    horizontal_line_label.addEventListener("mouseout", () => {
        if (!toggledOn.value) {
            horizontal_line_label.style.removeProperty("background-color");
            horizontal_line_label.style.removeProperty("color");
        }
    });
    if (settings.ShowLinkNameOnSeparateLine && settings.ShowNameAboveDatatype && link_name_label) {
        // Swap the top of horizontal_line_label and link_name_label
        const temp_value = horizontal_line_label.style.top;
        horizontal_line_label.style.top = link_name_label.style.top;
        link_name_label.style.top = temp_value;
    }
    // Create a label for the port number on the left side of the horizontal line
    let portLabelElement = "label"
    if (currentLinkObject && typeof currentLinkObject === "object") {
        portLabelElement = "input"
    }
    const port_number_label = document.createElement(portLabelElement);
    if (portLabelElement === "textarea") {
        port_number_label.style.resize = "none";
        port_number_label.rows = "1";
    }
    if (typeof currentLinkObject === "object") {
        port_number_label.setAttribute("type", "number");
    }
    if (matchingPort.type === "srv") {
        port_number_label.style.setProperty("background-color", settings["ServicePortLabelBgColor"], "important");
        port_number_label.style.setProperty("color", settings["ServicePortLabelColor"], "important");
    } else if (matchingPort.type === "pub") {
        port_number_label.style.setProperty("background-color", settings["PublisherPortLabelBgColor"], "important");
        port_number_label.style.setProperty("color", settings["PublisherPortLabelColor"], "important");
    } else if (matchingPort.type === "sub") {
        port_number_label.style.setProperty("background-color", settings["SubscriberPortLabelBgColor"], "important");
        port_number_label.style.setProperty("color", settings["SubscriberPortLabelColor"], "important");
    }
    port_number_label.classList.add("port_number_label");
    port_number_label.style.top = y_counter.value + avatar_y_counter.value - settings.HorizontalPortLabelOffsetY + "px";
    // align it 50px to the left from the left side of the horizontal line
    port_number_label.style.setProperty("left", settings["NodeXOffset"] + settings["NodeWidth"] - 45 + "px");
    port_number_label.style.width = "45px";
    port_number_label.style.paddingTop = "2px";
    port_number_label.style.paddingRight = "2px";
    // if (!isLast) {
    port_number_label.style.height = settings.DistancePerHorizontalConnection + "px";
    // }
    //  else {
    //     port_number_label.style.height = "calc(fit-content + 2px)";
    // }
    port_number_label.style.position = "absolute";
    if (currentLinkObject && typeof currentLinkObject === "object") {
        port_number_label.value = currentLinkObject.port;
        // If 2 seconds is gone past the last change, then save the value
        let timeout = null;
        port_number_label.addEventListener("change", (event) => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(async () => {
                if (port_number_label.value === "") {
                    port_number_label.value = 65535;
                }
                if (!validateNewPortId(matchingPort.type, port_number_label.value)) {
                    port_number_label.style.textDecoration = "underline";
                    return;
                }
                const response = await zubax_apij.update_register_value(currentLinkObject.register_name, JSON.parse(`{"_meta_": {"mutable": true, "persistent": true}, "natural16": {"value": [${port_number_label.value}]}}`), currentLinkObject.node_id);
                let restartButton = document.querySelector("#btn" + currentLinkObject.node_id + "_Restart");
                if (restartButton) {
                    // Previous background color
                    const previousBackgroundColor = restartButton.style.backgroundColor;
                    // Flash it 3 times
                    for (let i = 0; i < 3; i++) {
                        restartButton = document.querySelector("#btn" + currentLinkObject.node_id + "_Restart");
                        restartButton.title = "You should restart this node to apply the changes to port identifiers."
                        restartButton.style.setProperty("background-color", "red", "important");
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        restartButton.style.setProperty("background-color", previousBackgroundColor, "important");
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                yukon_state.addLocalMessage("Usually it is the case that you should now restart the node before the device applies its changes.", 30)
            }, 2000);
        });
    } else {
        port_number_label.innerHTML = matchingPort.port;
        link_name_label.innerHTML = matchingPort.port;
    }
    port_number_label.style.zIndex = "4";
    port_number_label.style.textAlign = "right";
    monitor2Div.appendChild(port_number_label);

    monitor2Div.appendChild(horizontal_line_label);


    arrowhead = document.createElement("div");
    arrowhead.classList.add("arrowhead");
    arrowhead.style.position = "absolute";
    arrowhead.style.left = matchingPort.x_offset - 13 + "px";
    arrowhead.style.width = "0px";
    arrowhead.style.height = "0px";
    arrowhead.style.setProperty("border-left-width", "9px");
    arrowhead.style.setProperty("border-right-width", "9px");
    arrowhead.style.setProperty("border-top-width", "9px");
    monitor2Div.appendChild(arrowhead);
    linesByPortAndPortType.push({ "element": horizontal_line, "port": matchingPort.port, "type": matchingPort.type, "toggledOn": toggledOn });
    linesByPortAndPortType.push({ "element": arrowhead, "port": matchingPort.port, "type": matchingPort.type, "toggledOn": toggledOn });
    linesByPortAndPortType.push({ "element": horizontal_line_label, "port": matchingPort.port, "type": matchingPort.type, "toggledOn": toggledOn });

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
    const left_end_of_edge = settings["NodeXOffset"] + settings["NodeWidth"] - 6 + "px"
    if (matchingPort.type === "pub" || matchingPort.type === "cln") {
        // Arrowhead for the line
        arrowhead.style.transform = "rotate(270deg)";
        arrowhead.style.left = right_end_of_edge - 12 + "px";
        arrowhead.style.top = y_counter.value + avatar_y_counter.value + settings.HorizontalLineYOffset - 4 + settings.HorizontalLineWidth / 2 + "px";
    } else if (matchingPort.type === "sub" || matchingPort.type === "srv") {
        arrowhead.style.top = y_counter.value + avatar_y_counter.value + settings.HorizontalLineYOffset - 4 + settings.HorizontalLineWidth / 2 + "px";
        arrowhead.style.transform = "rotate(90deg)";
        arrowhead.style.left = left_end_of_edge;
        // Make a circle and position it at right_end_of_edge
        const circle = document.createElement("div");
        circle.classList.add("circle");
        circle.style.position = "absolute";
        circle.style.top = y_counter.value + avatar_y_counter.value + settings.HorizontalLineYOffset - 7 + "px";
        circle.style.left = right_end_of_edge - 7 + "px";
        circle.style.width = "15px";
        circle.style.height = "15px";
        circle.style.setProperty("border-radius", "50%", "important");
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
        const isPortService = portOrder[port.type] == portOrder.srv || portOrder[port.type] == portOrder.cli;
        if (isPortService) {
            port_label.classList.add("service");
        }
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
                const datatypes = await getDatatypesForPort(port.port, port.type, yukon_state);
                potentialPopup = document.createElement("div");
                potentialPopup.classList.add("popup");
                potentialPopup.style.position = "absolute";
                potentialPopup.style.top = port_label.getBoundingClientRect().height + "px";
                potentialPopup.style.left = "0px";
                potentialPopup.style.border = "1px solid black";
                potentialPopup.style.borderRadius = "0px";
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
        line_collider.addEventListener("click", () => {
            toggledOn.value = !toggledOn.value;
            changeStateOfElement(port.port, toggledOn.value, false, yukon_state);
        });
        monitor2Div.appendChild(line_collider);
        monitor2Div.appendChild(line);
    }
    if (publishers_and_services.length > 0) {
        settings.SubscriptionsOffset = publishers_and_services[publishers_and_services.length - 1].x_offset + settings.DistanceBetweenLines - 40;
    }
}