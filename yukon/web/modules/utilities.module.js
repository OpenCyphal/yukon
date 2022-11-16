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

export function waitForElm(selector, timeOutMilliSeconds) {
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