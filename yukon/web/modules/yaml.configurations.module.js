import {
    get_all_selected_pairs,
    select_configuration,
    getAllEntireColumnsThatAreSelected
} from "./panels/registers.selection.module.js";
import {update_tables, updateRegistersTableColors} from "./panels/registers.module.js";
import {copyObject, JsonParseHelper} from "./utilities.module.js";

export async function applyConfiguration(configuration, set_node_id, applyPairs, yukon_state) {
    let zubax_api = yukon_state.zubax_api;
    // If configuration starts with a { then it is json
    let configuration_deserialized = null;
    if (configuration.startsWith("{")) {
        yukon_state.addLocalMessage("Configuration is JSON", 10);
        configuration_deserialized = JSON.parse(configuration, JsonParseHelper);
    } else {
        configuration_deserialized = yukon_state.jsyaml.load(configuration);
        yukon_state.addLocalMessage("Configuration is YAML", 10);
    }

    let potential_node_id;
    let number_input;
    if (!set_node_id) {
        number_input = yukon_state.number_input_for_configuration[yukon_state.selections.selected_config];
        potential_node_id = parseInt(number_input.value);
        yukon_state.addLocalMessage("Node ID was specified as " + potential_node_id, 10);
    } else {
        potential_node_id = set_node_id;
    }

    function removeUnnecessaryPairsFromAvatar(avatar) {
        for (let j = 0; j < avatar.length; j++) {
            let register_name = avatar[j];
            // If register.name is not in applyPairs[avatar.node_id]
            if (!applyPairs[avatar.node_id] || !applyPairs[avatar.node_id].includes(register_name)) {
                // Remove the register
                // Remove the register_name key from avatar[node_id]
                console.log("Not including " + register_name + " for node " + avatar.node_id);
                avatar[node_id].splice(j, 1);
                j--;
            }
        }
    }

    const is_network_configuration = await isNetworkConfiguration(configuration_deserialized);
    const is_configuration_simplified = await isSimplifiedConfiguration(configuration_deserialized);
    if (is_network_configuration) {
        yukon_state.addLocalMessage("Configuration is a network configuration", 10);
    }
    if (is_configuration_simplified) {
        yukon_state.addLocalMessage("Configuration is simplified", 10);
    }
    if (applyPairs) {
        yukon_state.addLocalMessage("Applying only selected registers", 10);
        if (is_network_configuration) {
            // Iterate over the configuration and remove the keys that are not in applyPairs
            // For avatar in configuration_deserialized
            for (let i = 0; i < configuration_deserialized.length; i++) {
                let avatar = configuration_deserialized[i];
                // For register in avatar.registers
                removeUnnecessaryPairsFromAvatar(avatar);
            }
        } else {
            let avatar = configuration_deserialized;
            // For register in avatar.registers
            removeUnnecessaryPairsFromAvatar(avatar);
        }
    }
    if (is_network_configuration && is_configuration_simplified) {
        // Start fetching datatypes
        const unsimplified_configuration = await zubax_api.unsimplify_configuration(configuration)
        yukon_state.addLocalMessage("Unsimplified configuration", 10);
        await zubax_api.apply_all_of_configuration(unsimplified_configuration);
        let interval1 = setInterval(() => update_tables(true), 1000);
        setTimeout(() => clearInterval(interval1), 6000);
    } else if (!is_network_configuration && is_configuration_simplified) {
        const isValidNodeid = potential_node_id > 0 || potential_node_id < 128;
        if (isValidNodeid) {
            console.log("Applying configuration: " + yukon_state.selections.selected_config + " to node " + potential_node_id);
            yukon_state.addLocalMessage("Applying configuration: " + yukon_state.selections.selected_config + " to node " + potential_node_id, 20);
            await zubax_api.apply_configuration_to_node(potential_node_id, JSON.stringify(configuration_deserialized))
            let interval1 = setInterval(() => update_tables(true), 1000);
            setTimeout(() => clearInterval(interval1), 6000);
        } else if (number_input) {
            console.log("There was no valid node id supplied.");
            yukon_state.addLocalMessage("There was no valid node id supplied.", 40);
            // Add a small label to the bottom of number_input to indicate that the node id is invalid, color the input red
            number_input.style.borderColor = "red";
            // Remove 3 seconds later
            setTimeout(function () {
                // Remove the red border
                number_input.style.borderColor = "";
            }, 3000);
        }
    } else {
        yukon_state.addLocalMessage("Didn't know what to do with the configuration", 40);
    }
}

async function isNetworkConfiguration(yamlOrJSONSerializedConfiguration) {
    return (await zubax_api.is_network_configuration(yamlOrJSONSerializedConfiguration)).trim() == "true";
}

async function isSimplifiedConfiguration(yamlOrJSONSerializedConfiguration) {
    return (await zubax_api.is_configuration_simplified(yamlOrJSONSerializedConfiguration)).trim() == "true";
}

async function saveString(string, yukon_state) {
    let isElectron = typeof yukon_state.navigator === 'object' && typeof yukon_state.navigator.userAgent === 'string' && yukon_state.navigator.userAgent.indexOf('Electron') >= 0;
    if (window.showSaveFilePicker && !yukon_state.settings.preferSmallerFileSelectionDialog & !isElectron) {
        const fileHandle = await window.showSaveFilePicker();
        yukon_state.addLocalMessage("We got this path: " + fileHandle.name, 10);
        if (fileHandle) {
            // Create a FileSystemWritableFileStream to write to.
            const writable = await fileHandle.createWritable()
            // Write the contents of the file to the stream.
            await writable.write(string)
            await writable.close()
            yukon_state.addLocalMessage("File written to disk.", 20);
        } else {
            yukon_state.addLocalMessage("User didn't specify a file path in the dialog", 20);
        }
    } else {
        // Substitute r"['\"](\d+)['\"]" with r"\1" in string\
        // This will make the node_ids numbers instead of strings
        string = string.replace(/['"](\d+)['"]/g, "$1");
        return await window.electronAPI.saveFile(string);
    }
}

function parseYamlStringsToNumbers(string) {
    return string.replace(/['"](\d+)['"]/g, "$1");
}

async function saveYaml(string, yukon_state) {
    // Use regex ['\"](\d+)['\"] and replace with $1
    string = parseYamlStringsToNumbers(string);
    saveString(string, yukon_state);
}

export async function openFile(yukon_state) {
    let file_dto = {};
    try {
        if (!yukon_state.settings.preferSmallerFileSelectionDialog && window.showOpenFilePicker) {
            const fileHandlesArray = await window.showOpenFilePicker();
            if (fileHandlesArray) {
                const fileHandle = fileHandlesArray[0];
                yukon_state.addLocalMessage("We got this path: " + fileHandle.name, 20);
                if (fileHandle) {
                    // Create a FileSystemWritableFileStream to write to.
                    const file = await fileHandle.getFile();
                    const text = await file.text()
                    file_dto.text = text;
                    file_dto.name = file.name;
                    return file_dto;
                } else {
                    yukon_state.addLocalMessage("User didn't specify a file path in the dialog", 30);
                }
            }
        } else {
            return await yukon_state.zubax_apij.open_file_dialog();
        }
    } catch (e) {
        yukon_state.addLocalMessage("Error opening file: " + e, 40);
    }
}

async function serverFormatYaml(object) {
    return await yukon_state.zubax_api.yaml_to_yaml(jsyaml.dump(object));
}

export async function return_all_selected_registers_as_yaml(pairs, yukon_state) {
    let zubax_api = yukon_state.zubax_api;
    // A pair is the register_name and the node_id
    let pairs_object = pairs;
    // Check if all the keys in pairs_object are convertible to numbers
    let all_keys_are_numbers = true;
    for (let key in pairs_object) {
        if (isNaN(key)) {
            all_keys_are_numbers = false;
            break;
        }
    }
    // Determine, whether the configuration is a network configuration or a single node configuration
    let is_networked = all_keys_are_numbers;
    const required_flow_level = is_networked ? 2 : 1;
    let contains_single_node = is_networked && Object.keys(pairs_object).length == 1;
    let json_string = JSON.stringify(pairs_object);
    let yaml_string = await serverFormatYaml(pairs_object);
    if (yukon_state.settings.simplifyRegisters) {
        let intermediary_structure = await zubax_apij.simplify_configuration(json_string)
        if (contains_single_node && !yukon_state.settings.alwaysSaveAsNetworkConfig) {
            intermediary_structure = intermediary_structure[Object.keys(intermediary_structure)[0]];
        }
        const simplified_yaml_string = await serverFormatYaml(intermediary_structure);
        return parseYamlStringsToNumbers(simplified_yaml_string);
    } else {
        let intermediary_structure = JSON.parse(yaml_string, JsonParseHelper);
        if (contains_single_node && !yukon_state.settings.alwaysSaveAsNetworkConfig) {
            intermediary_structure = intermediary_structure[Object.keys(intermediary_structure)[0]];
        }
        const yaml_string_modified = await serverFormatYaml(intermediary_structure);
        return parseYamlStringsToNumbers(yaml_string_modified);
    }
}

export async function export_all_selected_registers(only_of_avatar_of_node_id, get_everything, yukon_state) {
    let pairs = get_all_selected_pairs({
        "only_of_avatar_of_node_id": only_of_avatar_of_node_id,
        "get_everything": get_everything,
        "only_of_register_name": null
    }, yukon_state);
    await saveYaml(await return_all_selected_registers_as_yaml(pairs, yukon_state), yukon_state);
}

export async function update_available_configurations_list(yukon_state) {
    let zubax_api = yukon_state.zubax_api;
    var available_configurations_radios = document.querySelector("#available_configurations_radios");
    available_configurations_radios.innerHTML = "";
    let number_input_for_configuration = yukon_state.number_input_for_configuration;
    yukon_state.simplified_configurations_flags = {};
    for (const [file_name, configuration_string] of Object.entries(yukon_state.available_configurations)) {
        // Fill in the available_configurations_radios with radio buttons
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "configuration";
        radio.value = file_name;
        radio.id = file_name;
        // if the file_name is the selected_config, then set the radio button to checked
        if (file_name == yukon_state.selected_config) {
            radio.checked = true;
        }
        radio.onmousedown = function () {
            select_configuration(file_name, yukon_state);
        }
        available_configurations_radios.appendChild(radio);
        // Label for radio
        const label = document.createElement("label");
        label.htmlFor = file_name;
        label.innerHTML = file_name;
        label.onmousedown = function () {
            select_configuration(file_name, yukon_state);
        }
        let conf_yaml_deserialized = yukon_state.jsyaml.load(configuration_string);
        let is_network_configuration = await isNetworkConfiguration(configuration_string);
        let is_configuration_simplified = await isSimplifiedConfiguration(configuration_string);
        if (is_configuration_simplified) {
            label.innerHTML += " (simplified)";
            yukon_state.simplified_configurations_flags[file_name] = true;
        }
        // For each key in the conf_deserialized, add a checkbox under the label with the key as the text and id
        let noKeysWereNumbers = true; // This is essentially the same as is_configuration_simplified, but it is determined here locally
        for (const [key, value] of Object.entries(conf_yaml_deserialized)) {
            // If key is not a number continue
            if (isNaN(key)) {
                continue;
            }
            noKeysWereNumbers = false;
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = key;
            checkbox.checked = true;
            checkbox.onmousedown = function () {
                yukon_state.addLocalMessage("There isn't actually functionality tied to these checkboxes, yet.", 30);
                // If the checkbox is checked, add the key to the configuration
                if (checkbox.checked) {

                } else {

                }
            }
            label.appendChild(checkbox);
            const text = document.createElement("span");
            text.innerHTML = key;
            label.appendChild(text);
        }
        if (!is_network_configuration && is_configuration_simplified) {
            const number_input = document.createElement("input");
            number_input.type = "number";
            number_input.placeholder = "Node id needed";
            number_input.title = "For determining datatypes, a node id is needed";
            number_input_for_configuration[copyObject(file_name)] = number_input;
            label.appendChild(number_input);
        }
        available_configurations_radios.appendChild(label);
    }
}

export async function loadConfigurationFromOpenDialog(selectImmediately, yukon_state, click_event) {
    const result_dto = await openFile(yukon_state);
    if (!result_dto || result_dto.text == "") {
        return null;
    }
    if (selectImmediately) {
        yukon_state.selections.selected_config = result_dto.name;
    }
    yukon_state.available_configurations[result_dto.name] = result_dto.text;
    await update_available_configurations_list(yukon_state);
    yukon_state.addLocalMessage("Configuration file added to the list of selectable configurations", 20);
    return result_dto;
}

export async function actionApplyConfiguration(selectImmediately, applyToAll, avatar, onlyApplySelected, yukon_state, click_event) {
    let result_dto = await loadConfigurationFromOpenDialog(selectImmediately, yukon_state, click_event);
    let pairs = null;
    if (result_dto) {
        const current_config = yukon_state.available_configurations[yukon_state.selections.selected_config];
        if (onlyApplySelected) {
            pairs = get_all_selected_pairs({
                "only_of_avatar_of_node_id": false,
                "get_everything": false,
                "only_of_register_name": null
            }, yukon_state);
        }
        if (current_config) {
            if (avatar && !applyToAll) {
                const node_id = avatar.node_id;
                const selections = getAllEntireColumnsThatAreSelected(yukon_state);

                // For key and value in selections
                for (const key in selections) {
                    const value = selections[key];
                    const node_id2 = key;
                    if (node_id2 == node_id) {
                        // The column that the context menu is activated on is used anyway
                        continue;
                    }
                    if (value) {
                        // If any other columns are fully selected then they are applied aswell.
                        applyConfiguration(current_config, parseInt(node_id2), pairs, yukon_state);
                    }
                }
                // The column that the context menu is activated on is used anyway
                applyConfiguration(current_config, parseInt(avatar.node_id), pairs, yukon_state);
            } else {
                for (const avatar of yukon_state.current_avatars) {
                    applyConfiguration(current_config, parseInt(avatar.node_id, pairs, yukon_state))
                }
                addLocalMessage("Applying configuration to all avatars", 20);
            }
        } else {
            console.log("No configuration selected");
        }
        if (!yukon_state.recently_reread_registers[avatar.node_id]) {
            yukon_state.recently_reread_registers[avatar.node_id] = {};
        }
        for (let i = 0; i < avatar.registers.length; i++) {
            const register_name = avatar.registers[i];
            yukon_state.recently_reread_registers[avatar.node_id][register_name] = true;
        }

        updateRegistersTableColors(yukon_state, 4, 1000);
        let registers_to_reset = copyObject(yukon_state.recently_reread_registers);
        setTimeout(() => {
            // Iterate through registers_to_reset and remove them from recently_reread_registers
            for (let node_id in registers_to_reset) {
                for (let register_name in registers_to_reset[node_id]) {
                    yukon_state.recently_reread_registers[node_id][register_name] = false;
                }
            }
            updateRegistersTableColors(yukon_state);
        }, 600);
    }
}