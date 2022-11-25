import {areThereAnyNewOrMissingHashes, updateLastHashes} from "../hash_checks.module.js";

const settings = {
    "VerticalLineMarginTop": 5,
    "PageMarginTop": 20,
    "NodeXOffset": 20,
    "DistancePerHorizontalConnection": 20, // In pixels
    "DistanceBetweenNodes": 2, // In pixels
    "NodeWidth": 150, // In pixels
    "AvatarMinHeight": 50, // In pixels
    "AvatarConnectionPadding": 10,
    "LinkInfoWidth": 200,
    "PubLineXOffset": 20 + 150 + 20 + 200, // In pixels
    "DistanceBetweenLines": 50, // In pixels
}
export function setUpMonitor2Component(container, yukon_state) {
    const containerElement = container.getElement()[0].querySelector("#monitor2");
    setInterval(() => {
        update_monitor2(containerElement, yukon_state);
    }, 1000);
}
function isContainerPopulated(containerElement) {
    return containerElement.querySelectorAll(".node").length > 0;
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
                let horizontal_line = null;
                let arrowhead = null;
                horizontal_line = document.createElement("div");
                horizontal_line.classList.add("horizontal_line");
                horizontal_line.style.top = y_counter + avatar_y_counter + "px";
                horizontal_line.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + "px";
                horizontal_line.style.width = matchingPort.x_offset - settings["NodeXOffset"] - settings["NodeWidth"] + "px";
                horizontal_line.style.height = "1px";
                containerElement.appendChild(horizontal_line);
                arrowhead = document.createElement("div");
                arrowhead.classList.add("arrowhead");
                arrowhead.style.position = "absolute";
                arrowhead.style.top = y_counter + avatar_y_counter - 2.5 + "px";
                arrowhead.style.left = matchingPort.x_offset - 10 + "px";
                arrowhead.style.width = "0px";
                arrowhead.style.height = "0px";
                arrowhead.style.borderLeft = "7px solid transparent";
                arrowhead.style.borderRight = "7px solid transparent";
                arrowhead.style.borderTop = "7px solid pink";
                containerElement.appendChild(arrowhead);

                if(matchingPort.type === "pub" || matchingPort.type === "srv") {
                    // Arrowhead for the line
                    arrowhead.style.transform = "rotate(270deg)";
                    arrowhead.style.left = matchingPort.x_offset - 10 + "px";
                } else if (matchingPort.type === "sub" || matchingPort.type === "cln") {
                    arrowhead.style.transform = "rotate(90deg)";
                    arrowhead.style.left = settings["NodeXOffset"] + settings["NodeWidth"] - 2.5 +  "px";
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