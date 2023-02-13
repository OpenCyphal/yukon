import { getRelatedLinks } from "./meanings.module.js";

export function copyObject(object) {
    return structuredClone(object)
}

export function secondsToString(seconds) {
    const numyears = Math.floor(seconds / 31536000);
    const numdays = Math.floor((seconds % 31536000) / 86400);
    const numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    const numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    const numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    return numyears + " years " + numdays + " days " + numhours + " hours " + numminutes + " minutes " + numseconds + " seconds";
}
export function secondsToColonSeparatedString(seconds) {

    const numhours = Math.floor(seconds / 86400);
    const numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    const numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    // Use zero padding on hours and minutes and seconds
    return numhours.toString().padStart(2, '0') + ":" + numminutes.toString().padStart(2, '0') + ":" + numseconds.toString().padStart(2, '0');
}

export function JsonParseHelper(k, v) {
    if (v === Infinity) {
        return "Infinity";
    } else if (v === NaN) {
        return "NaN";
    } else {
        return v;
    }
}

export function getDictionaryValueFieldName(dictionary) {
    // Iterate over keys of the dictionary and return the first one that doesn't start with _
    for (let key in dictionary) {
        if (!key.startsWith("_")) {
            return key;
        }
    }
}

export function getKnownDatatypes(yukon_state) {
    let knownDatatypes = [];
    for (let i = 0; i < yukon_state.current_avatars.length; i++) {
        let avatar = yukon_state.current_avatars[i];
        // For each register in registers_exploded
        for (let register_name in avatar.registers_values) {
            if (register_name.endsWith(".id")) {
                const register_name_split = register_name.split(".");
                const link_name = register_name_split[register_name_split.length - 2];
                const datatype_register_name = Object.keys(avatar.registers_values).find((a) => a.endsWith(link_name + ".type"));
                if (datatype_register_name) {
                    knownDatatypes.push(avatar.registers_values[datatype_register_name]);
                }
            }
        }
    }
    // Remove duplicates
    knownDatatypes = Array.from(new Set(knownDatatypes));
    return knownDatatypes;
}

export function isRunningInElectron(yukon_state) {
    const does_navigator_exist = typeof yukon_state.navigator === 'object';
    const is_user_agent_a_string = typeof yukon_state.navigator.userAgent === 'string';
    const is_electron_listed_in_agents = yukon_state.navigator.userAgent.indexOf('Electron') >= 0;

    return does_navigator_exist && is_user_agent_a_string && is_electron_listed_in_agents
}

export function areThereAnyActiveModals() {
    return document.querySelectorAll('#modal').length > 0
}
function createPortStructure(yukon_state) {
    let ports = [];
    for (const avatar of yukon_state.current_avatars) {
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                if (port === "") {
                    continue;
                }
                let alreadyExistingPorts = ports.filter(p => p.port === port && p.type === port_type);
                if (alreadyExistingPorts.length === 0) {
                    ports.push({ "type": port_type, "port": port });
                }
            }
        }
    }
    return ports;
}
export async function getDatatypesForPort(portNr, yukon_state) {
    const chosenDatatypes = {};
    const relatedLinks = getRelatedLinks(portNr, yukon_state);
    //const ports = createPortStructure(yukon_state);
    const currentLinkObjects = relatedLinks.filter(link => link.port === portNr && (link.type === "sub" || link.type === "pub"));
    let fixed_datatype_short = null;
    let fixed_datatype_full = null;
    const datatypes_response = await yukon_state.zubax_apij.get_known_datatypes_from_dsdl();
    if (datatypes_response && datatypes_response["fixed_id_messages"] && datatypes_response["fixed_id_messages"][portNr] !== undefined) {
        fixed_datatype_short = datatypes_response["fixed_id_messages"][portNr]["short_name"];
        fixed_datatype_full = datatypes_response["fixed_id_messages"][portNr]["name"];
        chosenDatatypes[fixed_datatype_full] = 1;
    }
    if (currentLinkObjects.length > 0) {
        for (const link of currentLinkObjects) {
            chosenDatatypes[link.datatype] = chosenDatatypes[link.datatype] || 1;
        }
    }
    const structureForSorting = [];
    for (const datatype of Object.keys(chosenDatatypes)) {
        structureForSorting.push({ "name": datatype, "count": chosenDatatypes[datatype] });
    }
    structureForSorting.sort((a, b) => b.count - a.count);
    const sortedDatatypes = structureForSorting.map((a) => a.name);
    return sortedDatatypes;
}

export function getUnassignedPortsForNode(node_id, yukon_state) {
    // Look for all registers that are named like "port_1.id" and "port_1.type"
    // If the id is empty, then the port is empty
    const emptyPorts = [];
    const node = yukon_state.current_avatars.find(a => a.node_id === node_id);
    if (node) {
        for (const register_name in node.registers_values) {
            if (register_name.endsWith(".id")) {
                const register_name_split = register_name.split(".");
                const link_name = register_name_split[register_name_split.length - 2];
                const link_type = register_name_split[register_name_split.length - 3];
                const probable_datatype_register_name = register_name.replace(".id", ".type");
                let detected_datatype = null;
                if (node.registers_values[probable_datatype_register_name]) {
                    detected_datatype = node.registers_values[probable_datatype_register_name];
                }
                const subject_id = parseInt(node.registers_values[register_name]);
                // If for whatever reason the port is not in the pub, sub, cln, srv lists of node.ports, then it should be displayed still in the unassigned ports list
                const isPortNotDisplayed = node.ports[link_type] && node.ports[link_type].indexOf(subject_id) === -1;
                if (isPortNotDisplayed || subject_id === 65535) {
                    emptyPorts.push({ "link_name": link_name, "link_type": link_type, "full_name": register_name, "datatype": detected_datatype });
                }
            }
        }
    }
    return emptyPorts;
}

export function waitForElm(selector, timeOutMilliSeconds, context) {
    let outer_context = this;
    if (context) {
        outer_context = context;
    }
    return new Promise(resolve => {
        let timeOutTimeout
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        } else {
            if (timeOutMilliSeconds) {
                let timeoutFunction = () => {
                    console.error("Timeout waiting for element: " + selector);
                    resolve(null);
                };
                timeoutFunction = timeoutFunction.bind(outer_context);
                timeOutTimeout = setTimeout(timeoutFunction, timeOutMilliSeconds);
            }
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                console.log("Will clear timeout if it exists")
                if (timeOutTimeout) {
                    clearTimeout(timeOutTimeout);
                    console.log("Clearing timeout")
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

export function getHoveredContainerElementAndContainerObject(yukon_state) {
    const elementOn = document.elementFromPoint(yukon_state.mousePos.x, yukon_state.mousePos.y);
    if (elementOn == null) {
        return;
    }
    // Start navigating up through parents (ancestors) of elementOn, until one of the parents has the class lm_content
    let currentElement = elementOn
    while (elementOn !== document.body) {
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
    if (yukon_state.containerElementToContainerObjectMap.has(currentElement)) {
        containerObject = yukon_state.containerElementToContainerObjectMap.get(currentElement);
    }
    return [currentElement, containerObject];
}

export function doCommandFeedbackResult(result, feedbackMessageElement) {
    if (!feedbackMessageElement) {
        feedbackMessageElement = {
            style: {
            },
            innerHTML: "",
            classList: {
                add: () => { },
                remove: () => { }
            }
        }
    }
    // Tween feedbackMessage.style.backgroundColor from sepia to green
    const starting_color_rgb = [50, 50, 50];
    const increments_to_take = 144;
    const ending_color_rgb = [0, 50, 0];
    let increment_counter = 0;
    let tweenFunction = null;
    tweenFunction = () => {
        let new_color = [];
        for (let i = 0; i < 3; i++) {
            new_color.push(starting_color_rgb[i] + (ending_color_rgb[i] - starting_color_rgb[i]) * increment_counter / increments_to_take);
        }
        feedbackMessageElement.style.backgroundColor = `rgb(${new_color[0]}, ${new_color[1]}, ${new_color[2]})`;
        if (increment_counter < increments_to_take) {
            increment_counter++;
            window.requestAnimationFrame(tweenFunction);
        }
    };
    window.requestAnimationFrame(tweenFunction);
    if (!result.success) {
        feedbackMessageElement.classList.remove("success");
        feedbackMessageElement.style.display = "block";
        if (result.message) {
            feedbackMessageElement.innerHTML = result.message;
            yukon_state.addLocalMessage(result.message);
        } else {
            feedbackMessageElement.innerHTML = "";
        }
    } else {
        feedbackMessageElement.classList.add("success");
        feedbackMessageElement.style.display = "block";
        if (result.message) {
            feedbackMessageElement.innerHTML = result.message;
            yukon_state.addLocalMessage(result.message);
        } else {
            feedbackMessageElement.innerHTML = "";
        }
    }
}