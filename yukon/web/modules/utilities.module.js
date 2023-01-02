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
    if (datatypes_response["fixed_id_messages"][portNr] !== undefined) {
        fixed_datatype_short = datatypes_response["fixed_id_messages"][portNr]["short_name"];
        fixed_datatype_full = datatypes_response["fixed_id_messages"][portNr]["full_name"];
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

export async function getEmptyPortsForNode(node_id, yukon_state) {
    // Look for all registers that are named like "port_1.id" and "port_1.type"
    // If the id is empty, then the port is empty
    const emptyPorts = [];
    const node = yukon_state.current_avatars.find(a => a.id === node_id);
    if (node) {
        for (const register_name in node.registers_values) {
            if (register_name.endsWith(".id")) {
                const register_name_split = register_name.split(".");
                const link_name = register_name_split[register_name_split.length - 2];
                const subject_id = node.registers_values[register_name];
                if (subject_id === "") {
                    emptyPorts.push(link_name);
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
        if (timeOutMilliSeconds) {
            let timeoutFunction = () => {
                console.error("Timeout waiting for element: " + selector);
                resolve(null);
            };
            timeoutFunction = timeoutFunction.bind(outer_context);
            timeOutTimeout = setTimeout(timeoutFunction, timeOutMilliSeconds);
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