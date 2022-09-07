import { get_all_selected_pairs, select_configuration } from "./registers.selection.module.js";
import { update_tables } from "./registers.module.js";
export function applyConfiguration(configuration, set_node_id, applyPairs, yukon_state) {
    let zubax_api = yukon_state.zubax_api;
    let configuration_deserialized = JSON.parse(configuration);

    let potential_node_id;
    let number_input;
    if (!set_node_id) {
        number_input = number_input_for_configuration[selected_config];
        potential_node_id = parseInt(number_input.value);
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
    zubax_api.is_network_configuration(configuration_deserialized).then(function (result) {
        const is_network_configuration = JSON.parse(result);
        zubax_api.is_configuration_simplified(configuration_deserialized).then(function (result) {
            const is_configuration_simplified = JSON.parse(result);
            if (applyPairs) {
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
                zubax_api.unsimplify_configuration(configuration).then(function (result) {
                    console.log("Unsimplified configuration: " + selected_config);
                    zubax_api.apply_all_of_configuration(result);
                    let interval1 = setInterval(() => update_tables(true), 1000);
                    setTimeout(() => clearInterval(interval1), 6000);
                });
            } else if (!is_network_configuration && is_configuration_simplified) {
                const isValidNodeid = potential_node_id > 0 || potential_node_id < 128;
                if (isValidNodeid) {
                    console.log("Applying configuration: " + yukon_state.selections.selected_config + " to node " + potential_node_id);
                    zubax_api.apply_configuration_to_node(potential_node_id, JSON.stringify(configuration_deserialized))
                    let interval1 = setInterval(() => update_tables(true), 1000);
                    setTimeout(() => clearInterval(interval1), 6000);
                } else if (number_input) {
                    console.log("There was no valid node id supplied.");
                    // Add a small label to the bottom of number_input to indicate that the node id is invalid, color the input red
                    number_input.style.borderColor = "red";
                    // Remove 3 seconds later
                    setTimeout(function () {
                        // Remove the red border
                        number_input.style.borderColor = "";
                    }, 3000);
                }
            }
        });
    });
}
export function export_all_selected_registers(only_of_avatar_of_node_id, get_everything, yukon_state) {
    let zubax_api = yukon_state.zubax_api;
    // A pair is the register_name and the node_id
    let pairs_object = get_all_selected_pairs({ "only_of_avatar_of_node_id": only_of_avatar_of_node_id, "get_everything": get_everything, "only_of_register_name": null }, yukon_state);
    let json_string = JSON.stringify(pairs_object);
    var yaml_string = jsyaml.dump(pairs_object, { flowLevel: 2 });
    if (yukon_state.settings.simplifyRegisters) {
        zubax_api.simplify_configuration(json_string).then(function (simplified_json_string) {
            const intermediary_structure = JSON.parse(simplified_json_string);
            const simplified_yaml_string = jsyaml.dump(intermediary_structure);//, { flowLevel: 2 });
            return zubax_api.save_yaml(simplified_yaml_string);
        });
    } else {
        return zubax_api.save_yaml(yaml_string);
    }
}
export function update_available_configurations_list(yukon_state) {
    let zubax_api = yukon_state.zubax_api;
    var available_configurations_radios = document.querySelector("#available_configurations_radios");
    available_configurations_radios.innerHTML = "";
    let number_input_for_configuration = {};
    let simplified_configurations_flags = {};
    for (const [file_name, configuration_string] of Object.entries(yukon_state.available_configurations)) {
        // Fill in the available_configurations_radios with radio buttons
        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "configuration";
        radio.value = file_name;
        radio.id = file_name;
        // if the file_name is the selected_config, then set the radio button to checked
        if (file_name == yukon_state.selected_config) {
            radio.checked = true;
        }
        radio.onmousedown = function () {
            select_configuration(file_name);
        }
        available_configurations_radios.appendChild(radio);
        // Label for radio
        var label = document.createElement("label");
        label.htmlFor = file_name;
        label.innerHTML = file_name;
        label.onmousedown = function () {
            select_configuration(file_name);
        }
        let conf_deserialized = JSON.parse(configuration_string);
        zubax_api.is_network_configuration(conf_deserialized).then(function (result) {
            const is_network_configuration = JSON.parse(result);
            zubax_api.is_configuration_simplified(conf_deserialized).then(function (result) {
                const is_simplified = JSON.parse(result);
                if (is_simplified) {
                    label.innerHTML += " (simplified)";
                    simplified_configurations_flags[file_name] = true;
                }
                // For each key in the conf_deserialized, add a checkbox under the label with the key as the text and id
                let noKeysWereNumbers = true; // This is essentially the same as is_configuration_simplified, but it is determined here locally
                for (const [key, value] of Object.entries(conf_deserialized)) {
                    // If key is not a number continue
                    if (isNaN(key)) {
                        console.log("Key is not a number: " + key);
                        continue;
                    }
                    noKeysWereNumbers = false;
                    var checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.id = key;
                    checkbox.checked = true;
                    checkbox.onmousedown = function () {
                        // If the checkbox is checked, add the key to the configuration
                        if (checkbox.checked) {

                        } else {

                        }
                    }
                    label.appendChild(checkbox);
                    var text = document.createElement("span");
                    text.innerHTML = key;
                    label.appendChild(text);
                }
                if (!is_network_configuration && is_simplified) {
                    var number_input = document.createElement("input");
                    number_input.type = "number";
                    number_input.placeholder = "Node id needed";
                    number_input.title = "For determining datatypes, a node id is needed";
                    number_input_for_configuration[JSON.parse(JSON.stringify(file_name))] = number_input;
                    label.appendChild(number_input);
                }
                available_configurations_radios.appendChild(label);
            });
        });

    }
}