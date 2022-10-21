export function copyObject(object) {
    return structuredClone(object)
}
export function secondsToString(seconds) {
    var numyears = Math.floor(seconds / 31536000);
    var numdays = Math.floor((seconds % 31536000) / 86400);
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
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
export function isRunningInElectron(yukon_state) {
    const does_navigator_exist = typeof yukon_state.navigator === 'object';
    const is_user_agent_a_string = typeof yukon_state.navigator.userAgent === 'string';
    const is_electron_listed_in_agents = yukon_state.navigator.userAgent.indexOf('Electron') >= 0;

    return does_navigator_exist && is_user_agent_a_string && is_electron_listed_in_agents
}

export function areThereAnyActiveModals() {
    return document.querySelectorAll('#modal').length > 0
}
