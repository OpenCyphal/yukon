import { areThereAnyNewOrMissingHashes, updateLastHashes } from "../hash_checks.module.js";
import { getRelatedLinks } from "../meanings.module.js";
import {
    getHoveredContainerElementAndContainerObject,
    secondsToColonSeparatedString
} from "../utilities.module.js";

const settings = {};
settings.VerticalLineMarginTop = 3;
settings.PageMarginTop = 20;
settings.NodeXOffset = 20;
settings.DistancePerHorizontalConnection = 20;
settings.DistanceBetweenNodes = 2;
settings.NodeWidth = 250;
settings.AvatarMinHeight = 50;
settings.AvatarConnectionPadding = 20;
settings.LinkInfoWidth = 300;
settings.PubLineXOffset = settings.NodeXOffset + settings.NodeWidth + settings.LinkInfoWidth + 20;
settings.DistanceBetweenLines = 60;
settings.HorizontalColliderHeight = 17;
settings.HorizontalColliderOffsetY = (settings.HorizontalColliderHeight - 1) / 2
settings.HorizontalLabelOffsetY = 20;
settings.HorizontalPortLabelOffsetY = 10;
settings.LabelLeftMargin = 12;
settings.VerticalColliderWidth = 9;
settings.LinkLabelColor = "transparent";
settings.LinkLabelTextColor = "black";
settings.LinkLabelHighlightColor = "black";
settings.LinkLabelHighlightTextColor = "white";
// Add random shades of orange to the list
settings.HighlightColorsRaw = ["red", "blue", "green", "yellow", "orange", "purple", "brown"];
settings.HighlightColors = [];
settings.SubscriptionsOffset = null;
settings.SubscriptionsVerticalOffset = settings.PageMarginTop;
// Use a for loop to generate the structure
for (const color of settings.HighlightColorsRaw) {
    settings.HighlightColors.push({ color: color, taken: false });
}

let linesByPortAndPortType = [];
function pickHighlightColor(objects) {
    for (const color of settings.HighlightColors) {
        if (color.taken === false) {
            color.taken = true;
            for (const object of objects) {
                object.takenColor = color;
            }
            return color.color;
        }
    }
    return "red";
}
function highlightElement(element, color) {
    if (element.classList.contains("arrowhead")) {
        element.style.setProperty("border-top", "7px solid " + color);
    } else if (element.classList.contains("horizontal_line_label") && element.tagName === "LABEL") {
        element.style.setProperty("background-color", settings.LinkLabelHighlightColor);
        element.style.setProperty("color", settings.LinkLabelHighlightTextColor);
    } else if (element.classList.contains("horizontal_line") || element.classList.contains("line")) {
        element.style.setProperty("background-color", color);
    }
}
function highlightElements(objects) {
    const pickedHighlightColor = pickHighlightColor(objects);
    for (const object of objects) {
        highlightElement(object.element, pickedHighlightColor);
    }
}
function removeHighlightsFromObjects(objects) {
    for (const object of objects) {
        object.toggledOn.value = false;
        if (object.takenColor) {
            const takenColor = settings.HighlightColors.find((color) => { return color.color === object.takenColor.color; });
            takenColor.taken = false;
        }
        removeHighlightFromElement(object.element);
    }
}
function removeHighlightFromElement(element) {
    if (element.classList.contains("arrowhead")) {
        element.style.setProperty("border-top", "7px solid pink");
    } else if (element.classList.contains("horizontal_line_label") && element.tagName === "LABEL") {
        element.style.setProperty("background-color", settings.LinkLabelColor);
        element.style.setProperty("color", settings.LinkLabelTextColor);
    } else if (element.classList.contains("horizontal_line") || element.classList.contains("line")) {
        element.style.removeProperty("background-color");
    }
}
function unhighlightAll() {
    for (const object of linesByPortAndPortType) {
        object.toggledOn.value = false;
        if (object.takenColor) {
            const takenColor = settings.HighlightColors.find((color) => { return color.color === object.takenColor.color; });
            takenColor.taken = false;
        }
        removeHighlightFromElement(object.element);
    }
}
function drawSubscriptions(subscriptionsDiv) {
    if (settings.SubscriptionsOffset === null) {
        // Subscriptions cannot be drawn currently before any nodes and ports have been drawn
        return;
    }
    const existing_specifiers = {};
    for (const specifier of yukon_state.subscription_specifiers.specifiers) {
        existing_specifiers[specifier] = true;
    }
    for (const child of subscriptionsDiv.children) {
        const specifier = child.getAttribute("data-specifier");
        const isExisting = existing_specifiers[specifier];
        if (!isExisting) {
            child.parentElement.removeChild(child);
        }
    }
    subscriptionsDiv.innerHTML = "";
    let vertical_offset_counter = settings.SubscriptionsVerticalOffset;
    if (!yukon_state.subscription_specifiers) {
        return;
    }
    for (const specifier of yukon_state.subscription_specifiers.specifiers) {
        console.log("Drawing subscription specifier", specifier);
        const subscriptionElement = document.createElement("div");
        subscriptionElement.classList.add("subscription");
        subscriptionElement.innerText = specifier;
        subscriptionElement.style.position = "absolute";
        subscriptionElement.style.top = vertical_offset_counter + "px";
        subscriptionElement.style.left = settings.SubscriptionsOffset + "px";
        subscriptionsDiv.appendChild(subscriptionElement);
        vertical_offset_counter += 20;
    }
}
export function setUpMonitor2Component(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const monitor2Div = containerElement.querySelector("#monitor2");
    const subscriptionsDiv = containerElement.querySelector("#subscriptions");
    setInterval(async () => {
        yukon_state.subscription_specifiers = await yukon_state.zubax_apij.get_current_available_subscription_specifiers();
        if (typeof yukon_state.subscription_specifiers_previous_hash === "undefined" || yukon_state.subscription_specifiers_previous_hash !== yukon_state.subscription_specifiers.hash) {
            drawSubscriptions(subscriptionsDiv);
        }
        yukon_state.subscription_specifiers_previous_hash = yukon_state.subscription_specifiers_hash;

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
                unhighlightAll();
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
        containerElement.style.cursor = 'grab';
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

function compareAvatar(a, b) {
    if (a.node_id < b.node_id) {
        return -1;
    }
    if (a.node_id > b.node_id) {
        return 1;
    }
    return 0;
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
    // Add all nodes
    let y_counter = settings["PageMarginTop"];
    let ports = [];
    for (const avatar of yukon_state.current_avatars) {
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                if (port === "") {
                    continue;
                }
                let alreadyExistingPorts = ports.filter(p => p.port === port && p.type === port_type);
                if (alreadyExistingPorts.length === 0) {
                    ports.push({ "type": port_type, "port": port, "x_offset": 0 });
                }
            }
        }
    }
    function comparePorts(a, b) {
        // Compare ports by type and port number (port) for sorting
        if (a.type < b.type) {
            return -1;
        }
        if (a.type > b.type) {
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
    ports.sort(comparePorts);
    let x_counter = settings["PubLineXOffset"];
    for (const port of ports) {
        if (port.type === "pub") {
            port.x_offset = x_counter;
            x_counter += settings["DistanceBetweenLines"];
        } else if (port.type === "srv") {
            port.x_offset = x_counter;
            x_counter += settings["DistanceBetweenLines"];
        }
    }
    for (const port of ports) {
        if (port.type === "sub") {
            let pub_port = ports.find(p => p.type === "pub" && p.port === port.port);
            if (pub_port !== undefined) {
                port.x_offset = pub_port.x_offset;
            }
        } else if (port.type === "cln") {
            let srv_port = ports.find(p => p.type === "srv" && p.port === port.port);
            if (srv_port !== undefined) {
                port.x_offset = srv_port.x_offset;
            }
        }
    }
    const datatypes_response = await yukon_state.zubax_apij.get_known_datatypes_from_dsdl();
    const avatars_copy = Array.from(yukon_state.current_avatars)
    avatars_copy.sort(compareAvatar);
    for (const avatar of avatars_copy) {
        const node_id = avatar.node_id;
        const get_up_to_date_avatar = () => { return yukon_state.current_avatars.find(a => a.node_id === node_id); };
        // Add the sizes of ports.cln, ports.srv, ports.pub, ports.sub
        const total_ports = avatar.ports.cln.length + avatar.ports.srv.length + avatar.ports.pub.length + avatar.ports.sub.length;
        console.assert(total_ports >= 0);
        let avatar_height = Math.max(total_ports * settings["DistancePerHorizontalConnection"] + settings["AvatarConnectionPadding"], settings["AvatarMinHeight"]);
        const node = addNode(avatar, y_counter, avatar_height, "", monitor2Div, yukon_state);
        /*
            health_cell.innerHTML = yukon_state.current_avatars[i].last_heartbeat.health_text;
            software_version_cell.innerHTML = yukon_state.current_avatars[i].versions.software_version;
            hardware_version_cell.innerHTML = yukon_state.current_avatars[i].versions.hardware_version;
            uptime_cell.innerHTML = secondsToString(yukon_state.current_avatars[i].last_heartbeat.uptime);
         */
        const fieldsObject = {
            "Name": avatar.name, "Health": avatar.last_heartbeat.health_text,
            "Software Version": avatar.versions.software_version,
            "Hardware Version": avatar.versions.hardware_version,
            "Uptime": secondsToColonSeparatedString(avatar.last_heartbeat.uptime),
            "Node ID": avatar.node_id
        };
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
        let avatar_y_counter = settings["AvatarConnectionPadding"];
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                const matchingPort = ports.find(p => p.port === port && p.type === port_type);
                if (matchingPort === undefined || (matchingPort && matchingPort.x_offset === 0)) {
                    continue;
                }
                // Getting info about more links than necessary for later highlighting purposes
                const relatedLinks = getRelatedLinks(port, yukon_state);
                const currentLinkObject = relatedLinks.find(link => link.port === port && link.type === port_type);
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
                    if (currentLinkObject.name) {
                        currentLinkDsdlDatatype = currentLinkObject.name + ":" + currentLinkDsdlDatatype;
                    }
                } else {
                    currentLinkDsdlDatatype = fixed_datatype_full || "There is no info about this link";
                }
                let horizontal_line = null;
                let arrowhead = null;
                horizontal_line = document.createElement("div");
                horizontal_line.classList.add("horizontal_line");
                horizontal_line.style.top = y_counter + avatar_y_counter + "px";
                horizontal_line.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + "px";
                horizontal_line.style.width = matchingPort.x_offset - settings["NodeXOffset"] - settings["NodeWidth"] + "px";
                horizontal_line.style.height = "2px";
                monitor2Div.appendChild(horizontal_line);
                // Create an invisible collider div for horizontal_line, it should have a height of 10px
                const horizontal_line_collider = document.createElement("div");
                horizontal_line_collider.classList.add("horizontal_line_collider");
                horizontal_line_collider.style.top = y_counter + avatar_y_counter - settings["HorizontalColliderOffsetY"] + "px";
                horizontal_line_collider.style.left = horizontal_line.style.left;
                horizontal_line_collider.style.width = horizontal_line.style.width;
                horizontal_line_collider.style.height = settings["HorizontalColliderHeight"] + "px";
                horizontal_line_collider.style.zIndex = "1";
                horizontal_line_collider.style.position = "absolute";
                horizontal_line_collider.style.backgroundColor = "transparent";
                horizontal_line_collider.style.cursor = "pointer";
                monitor2Div.appendChild(horizontal_line_collider);
                // Place a label above the horizontal line at the left side
                const horizontal_line_label = document.createElement("label");
                horizontal_line_label.classList.add("horizontal_line_label");
                horizontal_line_label.style.top = y_counter + avatar_y_counter - settings["HorizontalLabelOffsetY"] + "px";
                horizontal_line_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
                horizontal_line_label.style.width = "fit-content"; // settings.LinkInfoWidth  - settings.LabelLeftMargin + "px";
                horizontal_line_label.style.height = settings.DistancePerHorizontalConnection + "px";
                horizontal_line_label.style.position = "absolute";
                horizontal_line_label.innerHTML = currentLinkDsdlDatatype;
                horizontal_line_label.style.zIndex = "4";
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
                // Create a label for the port number on the left side of the horizontal line
                const port_number_label = document.createElement("label");
                port_number_label.classList.add("port_number_label");
                port_number_label.style.top = y_counter + avatar_y_counter - settings.HorizontalPortLabelOffsetY + "px";
                // align it 50px to the left from the left side of the horizontal line
                port_number_label.style.setProperty("left", settings["NodeXOffset"] + settings["NodeWidth"] - 50 + "px");
                port_number_label.style.width = "45px";
                port_number_label.style.height = settings.DistancePerHorizontalConnection + "px";
                port_number_label.style.position = "absolute";
                port_number_label.innerHTML = port;
                port_number_label.style.zIndex = "4";
                port_number_label.style.backgroundColor = settings["LinkLabelHighlightColor"];
                port_number_label.style.color = settings["LinkLabelHighlightTextColor"];
                // Align text right
                port_number_label.style.textAlign = "right";
                monitor2Div.appendChild(port_number_label);

                monitor2Div.appendChild(horizontal_line_label);


                arrowhead = document.createElement("div");
                arrowhead.classList.add("arrowhead");
                arrowhead.style.position = "absolute";
                arrowhead.style.top = y_counter + avatar_y_counter - 3 + "px";
                arrowhead.style.left = matchingPort.x_offset - 12 + "px";
                arrowhead.style.width = "0px";
                arrowhead.style.height = "0px";
                arrowhead.style.borderLeft = "7px solid transparent";
                arrowhead.style.borderRight = "7px solid transparent";
                arrowhead.style.borderTop = "7px solid pink";
                monitor2Div.appendChild(arrowhead);
                linesByPortAndPortType.push({ "element": horizontal_line, "port": port, "type": port_type, "toggledOn": toggledOn });
                linesByPortAndPortType.push({ "element": arrowhead, "port": port, "type": port_type, "toggledOn": toggledOn });
                linesByPortAndPortType.push({ "element": horizontal_line_label, "port": port, "type": port_type, "toggledOn": toggledOn });
                horizontal_line_collider.addEventListener("mouseover", () => {
                    if (!toggledOn.value) {
                        highlightElement(horizontal_line, "red");
                        highlightElement(arrowhead, "red");
                        highlightElement(horizontal_line_label, "none");
                    }
                });
                horizontal_line_collider.addEventListener("mouseout", () => {
                    if (!toggledOn.value) {
                        removeHighlightFromElement(horizontal_line);
                        removeHighlightFromElement(arrowhead);
                        removeHighlightFromElement(horizontal_line_label);
                    }
                });
                horizontal_line_collider.addEventListener("click", () => {
                    toggledOn.value = !toggledOn.value;
                    if (toggledOn.value) {
                        horizontal_line.style.setProperty("background-color", "red");
                        arrowhead.style.setProperty("border-top", "7px solid red");
                        const relatedObjects = findRelatedObjects(port);
                        highlightElements(relatedObjects)
                        relatedObjects.forEach(object => {
                            object["toggledOn"].value = true;
                        })
                    } else {
                        horizontal_line.style.removeProperty("background-color");
                        arrowhead.style.setProperty("border-top", "7px solid pink");
                        const relatedObjects = findRelatedObjects(port);
                        removeHighlightsFromObjects(relatedObjects);
                        relatedObjects.forEach(object => {
                            object["toggledOn"].value = false;
                        })
                    }
                    // ports.find(p => p.port === port && p.type === "pub" || p.type === "srv");
                });

                if (matchingPort.type === "pub" || matchingPort.type === "srv") {
                    // Arrowhead for the line
                    arrowhead.style.transform = "rotate(270deg)";
                    arrowhead.style.left = matchingPort.x_offset - 10 + "px";
                } else if (matchingPort.type === "sub" || matchingPort.type === "cln") {
                    arrowhead.style.transform = "rotate(90deg)";
                    arrowhead.style.left = settings["NodeXOffset"] + settings["NodeWidth"] - 3 + "px";
                }
                avatar_y_counter += settings["DistancePerHorizontalConnection"];
            }
        }
        y_counter += avatar_height + settings["DistanceBetweenNodes"];
    }
    const publishers_and_services = ports.filter(p => p.type === "pub" || p.type === "srv");
    for (const port of publishers_and_services) {
        // Create a line like <div class="line" style="width: 4px; position: absolute; top:20px; left: 140px">-42</div>-->
        let line = document.createElement("div");
        line.classList.add("line");
        line.style.width = "4px";
        line.style.position = "absolute";
        line.style.height = y_counter + "px";
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
        line_collider.addEventListener("mouseover", () => {
            if (!toggledOn.value) {
                line.style.setProperty("background-color", "red");
            }
        });
        line_collider.addEventListener("mouseout", () => {
            if (!toggledOn.value) {
                line.style.removeProperty("background-color");
            }
        });
        line_collider.addEventListener("click", () => {
            toggledOn.value = !toggledOn.value;
            if (toggledOn.value) {
                line.style.setProperty("background-color", "red");
                const relatedObjects = findRelatedObjects(port.port);
                highlightElements(relatedObjects);
                relatedObjects.forEach(object => {
                    object["toggledOn"].value = true;
                })
            } else {
                line.style.removeProperty("background-color");
                const relatedObjects = findRelatedObjects(port.port);
                removeHighlightsFromObjects(relatedObjects);
                relatedObjects.forEach(object => {
                    object["toggledOn"].value = false;
                });
            }
        });
        monitor2Div.appendChild(line_collider);
        monitor2Div.appendChild(line);
    }
    settings.SubscriptionsOffset = publishers_and_services[publishers_and_services.length - 1].x_offset + settings.DistanceBetweenLines + 10;
}
function addNode(avatar, y, height, text, container, yukon_state) {
    // Verify that the avatar is not undefined
    console.assert(avatar !== undefined);
    let node = document.createElement("div");
    node.classList.add("node");
    node.style.top = y + "px";
    node.style.left = settings.NodeXOffset + "px";
    node.style.height = height + "px";
    node.style.maxHeight = height + "px";
    node.style.minHeight = height + "px";
    node.style.setProperty("border-sizing", "border-box");
    node.style.width = settings.NodeWidth + "px";
    // node.style.backgroundColor = avatar.color;
    node.innerText = text;
    container.appendChild(node);
    return node;
}