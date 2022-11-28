import {areThereAnyNewOrMissingHashes, updateLastHashes} from "../hash_checks.module.js";
import {getRelatedLinks} from "../meanings.module.js";

const settings = {};
settings.VerticalLineMarginTop = 5;
settings.PageMarginTop = 20;
settings.NodeXOffset = 20;
settings.DistancePerHorizontalConnection = 20;
settings.DistanceBetweenNodes = 2;
settings.NodeWidth = 150;
settings.AvatarMinHeight = 50;
settings.AvatarConnectionPadding = 10;
settings.LinkInfoWidth = 300;
settings.PubLineXOffset = settings.NodeXOffset + settings.NodeWidth + settings.LinkInfoWidth + 20;
settings.DistanceBetweenLines = 60;
settings.HorizontalColliderHeight = 17;
settings.HorizontalColliderOffsetY = (settings.HorizontalColliderHeight - 1) / 2
settings.HorizontalLabelOffsetY = 10;
settings.LabelLeftMargin = 5;
settings.VerticalColliderWidth = 9;
export function setUpMonitor2Component(container, yukon_state) {
    const containerElement = container.getElement()[0].querySelector("#monitor2");
    setInterval(() => {
        update_monitor2(containerElement, yukon_state);
    }, 1000);
}
function isContainerPopulated(containerElement) {
    return containerElement.querySelectorAll(".node").length > 0;
}
let linesByPortAndPortType = [];
function findRelatedObjects(port) {
    return linesByPortAndPortType.filter((line) => {
        return line.port === port;
    });
}
function highlightElement(object) {
    if(object.element.classList.contains("arrowhead")) {
        object.element.style.setProperty("border-top", "7px solid red");
    } else {
        object.element.style.setProperty("background-color", "red");
    }
}
function removeHighlightFromElement(object) {
    if(object.element.classList.contains("arrowhead")) {
        object.element.style.setProperty("border-top", "7px solid pink");
    } else {
        object.element.style.removeProperty("background-color");
    }
}
function update_monitor2(containerElement, yukon_state) {
    if (!areThereAnyNewOrMissingHashes("monitor2_hash", yukon_state)) {
        updateLastHashes("monitor2_hash", yukon_state);
        // If there are any elements in my_graph.elements() then we can return, otherwise we need to make a graph (below)
        if (isContainerPopulated(containerElement)) {
            return;
        }
    }
    updateLastHashes("monitor2_hash", yukon_state);
    // Clear the container
    containerElement.innerHTML = "";
    // Add all nodes
    let y_counter = settings["PageMarginTop"];
    let ports = [];
    for(const avatar of yukon_state.current_avatars) {
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                if(port === "") {
                    continue;
                }
                let alreadyExistingPorts = ports.filter(p => p.port === port && p.type === port_type);
                if (alreadyExistingPorts.length === 0) {
                    ports.push({"type": port_type, "port": port, "x_offset": 0});
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
    for(const port of ports) {
        if(port.type === "pub") {
            port.x_offset = x_counter;
            x_counter += settings["DistanceBetweenLines"];
        } else if (port.type === "srv") {
            port.x_offset = x_counter;
            x_counter += settings["DistanceBetweenLines"];
        }
    }
    for(const port of ports) {
        if(port.type === "sub") {
            let pub_port = ports.find(p => p.type === "pub" && p.port === port.port);
            if(pub_port !== undefined) {
                port.x_offset = pub_port.x_offset;
            }
        } else if (port.type === "cln") {
            let srv_port = ports.find(p => p.type === "srv" && p.port === port.port);
            if(srv_port !== undefined) {
                port.x_offset = srv_port.x_offset;
            }
        }
    }
    for(const avatar of yukon_state.current_avatars) {
        const node_id = avatar.node_id;
        console.log("Avatar in update_monitor2", avatar);
        // Add the sizes of ports.cln, ports.srv, ports.pub, ports.sub
        const total_ports = avatar.ports.cln.length + avatar.ports.srv.length + avatar.ports.pub.length + avatar.ports.sub.length;
        console.assert(total_ports >= 0);
        let avatar_height = Math.max(total_ports * settings["DistancePerHorizontalConnection"] + settings["AvatarConnectionPadding"], settings["AvatarMinHeight"]);
        const node = addNode(avatar, y_counter, avatar_height, avatar.name + ": " + total_ports,  containerElement, yukon_state);
        let avatar_y_counter = settings["AvatarConnectionPadding"];
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                const matchingPort = ports.find(p => p.port === port && p.type === port_type);
                if(matchingPort === undefined || (matchingPort && matchingPort.x_offset === 0)) {
                    continue;
                }
                // Getting info about more links than necessary for later highlighting purposes
                const relatedLinks = getRelatedLinks(port, yukon_state);
                const currentLinkObject = relatedLinks.find(link => link.port === port && link.type === port_type);
                let currentLinkDsdlDatatype = null;
                if(currentLinkObject !== undefined) {
                    currentLinkDsdlDatatype = currentLinkObject.datatype || "";
                }
                let horizontal_line = null;
                let arrowhead = null;
                horizontal_line = document.createElement("div");
                horizontal_line.classList.add("horizontal_line");
                horizontal_line.style.top = y_counter + avatar_y_counter + "px";
                horizontal_line.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + "px";
                horizontal_line.style.width = matchingPort.x_offset - settings["NodeXOffset"] - settings["NodeWidth"] + "px";
                horizontal_line.style.height = "1px";
                containerElement.appendChild(horizontal_line);
                // Create an invisible collider div for horizontal_line, it should have a height of 10px
                const horizontal_line_collider = document.createElement("div");
                horizontal_line_collider.classList.add("horizontal_line_collider");
                horizontal_line_collider.style.top = y_counter + avatar_y_counter - settings["HorizontalColliderOffsetY"] + "px";
                horizontal_line_collider.style.left = horizontal_line.style.left;
                horizontal_line_collider.style.width = horizontal_line.style.width;
                horizontal_line_collider.style.height = settings["HorizontalColliderHeight"] + "px";
                horizontal_line_collider.style.zIndex = "2";
                horizontal_line_collider.style.position = "absolute";
                horizontal_line_collider.style.backgroundColor = "transparent";
                horizontal_line_collider.style.cursor = "pointer";
                containerElement.appendChild(horizontal_line_collider);
                // Place a label above the horizontal line at the left side
                const horizontal_line_label = document.createElement("label");
                horizontal_line_label.classList.add("horizontal_line_label");
                horizontal_line_label.style.top = y_counter + avatar_y_counter - settings["HorizontalLabelOffsetY"] + "px";
                horizontal_line_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
                horizontal_line_label.style.width = settings.LinkInfoWidth  - settings.LabelLeftMargin + "px";
                horizontal_line_label.style.height = settings.DistancePerHorizontalConnection + "px";
                horizontal_line_label.style.position = "absolute";
                horizontal_line_label.innerHTML = currentLinkDsdlDatatype;
                containerElement.appendChild(horizontal_line_label);


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
                containerElement.appendChild(arrowhead);
                let toggledOn = {value: false};
                linesByPortAndPortType.push({"element": horizontal_line, "port": port, "type": port_type, "toggledOn": toggledOn});
                linesByPortAndPortType.push({"element": arrowhead, "port": port, "type": port_type, "toggledOn": toggledOn});
                horizontal_line_collider.addEventListener("mouseover", () => {
                    horizontal_line.style.setProperty("background-color", "red");
                    arrowhead.style.setProperty("border-top", "7px solid red");
                });
                horizontal_line_collider.addEventListener("mouseout", () => {
                    if(!toggledOn.value) {
                        horizontal_line.style.removeProperty("background-color");
                        arrowhead.style.setProperty("border-top", "7px solid pink");
                    }
                });
                horizontal_line_collider.addEventListener("click", () => {
                    toggledOn.value = !toggledOn.value;
                    if(toggledOn.value) {
                        horizontal_line.style.setProperty("background-color", "red");
                        arrowhead.style.setProperty("border-top", "7px solid red");
                        findRelatedObjects(port).forEach(object => {
                            highlightElement(object)
                            object["toggledOn"].value = true;
                        })
                    } else {
                        horizontal_line.style.removeProperty("background-color");
                        arrowhead.style.setProperty("border-top", "7px solid pink");
                        findRelatedObjects(port).forEach(object => {
                            removeHighlightFromElement(object);
                            object["toggledOn"].value = false;
                        })
                    }
                    // ports.find(p => p.port === port && p.type === "pub" || p.type === "srv");
                });

                if(matchingPort.type === "pub" || matchingPort.type === "srv") {
                    // Arrowhead for the line
                    arrowhead.style.transform = "rotate(270deg)";
                    arrowhead.style.left = matchingPort.x_offset - 10 + "px";
                } else if (matchingPort.type === "sub" || matchingPort.type === "cln") {
                    arrowhead.style.transform = "rotate(90deg)";
                    arrowhead.style.left = settings["NodeXOffset"] + settings["NodeWidth"] - 3 +  "px";
                }
                avatar_y_counter += settings["DistancePerHorizontalConnection"];
            }
        }
        y_counter += avatar_height + settings["DistanceBetweenNodes"];
    }

    for (const port of ports.filter(p => p.type === "pub" || p.type === "srv")) {
        // Create a line like <div class="line" style="width: 4px; position: absolute; top:20px; left: 140px">-42</div>-->
        let line = document.createElement("div");
        line.classList.add("line");
        line.style.width = "4px";
        line.style.position = "absolute";
        line.style.height = y_counter + "px";
        line.style.top = settings["VerticalLineMarginTop"] + "px";
        line.style.left = port.x_offset + "px";
        line.innerText = "-" + port.port;
        let toggledOn = {value: false};
        linesByPortAndPortType.push({"element": line, "port": port.port, "type": "vertical", "toggledOn": toggledOn});
        // Create a collider for the line
        const line_collider = document.createElement("div");
        line_collider.classList.add("line_collider");
        line_collider.style.width = settings["VerticalColliderWidth"] + "px";
        line_collider.style.position = "absolute";
        line_collider.style.height = line.style.height;
        line_collider.style.top = line.style.top;
        line_collider.style.left = port.x_offset - ((settings["VerticalColliderWidth"] - 1) / 2) + "px";
        line_collider.style.zIndex = "1";
        line_collider.style.backgroundColor = "transparent";
        line_collider.style.cursor = "pointer";
        line_collider.addEventListener("mouseover", () => {
            line.style.setProperty("background-color", "red");
        });
        line_collider.addEventListener("mouseout", () => {
            if(!toggledOn.value) {
                line.style.removeProperty("background-color");
            }
        });
        line_collider.addEventListener("click", () => {
            toggledOn.value = !toggledOn.value;
            if(toggledOn.value) {
                line.style.setProperty("background-color", "red");
                findRelatedObjects(port.port).forEach(object => {
                    highlightElement(object)
                    object["toggledOn"].value = true;
                })
            } else {
                line.style.removeProperty("background-color");
                findRelatedObjects(port.port).forEach(object => {
                    removeHighlightFromElement(object);
                    object["toggledOn"].value = false;
                });
            }
        });
        containerElement.appendChild(line_collider);
        containerElement.appendChild(line);
    }
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