import { updateRegistersTableColors } from "./registers.module.js";
import { copyObject, getDictionaryValueFieldName } from "./utilities.module.js";
export async function update_register_value(register_name, register_value, node_id, yukon_state) {
    const zubax_api = yukon_state.zubax_api;
    // Find the avatar which has the node_id
    const the_avatar = yukon_state.current_avatars.find((avatar) => avatar.node_id === parseInt(node_id));
    let unprocessed_value = copyObject(the_avatar["registers_exploded_values"][register_name])
    // if unprocessed_value[Object.keys(the_value)[0]]["value"]
    if (typeof unprocessed_value[getDictionaryValueFieldName(unprocessed_value)]["value"] == "string") {
        unprocessed_value[getDictionaryValueFieldName(unprocessed_value)]["value"] = register_value
    } else if (typeof unprocessed_value[getDictionaryValueFieldName(unprocessed_value)]["value"][0] == "number") {
        // Split register_value by comma and convert to array of numbers
        // Remove square brackets
        register_value = register_value.replace("[", "").replace("]", "");
        let register_values = register_value.split(",").map(Number);
        unprocessed_value[getDictionaryValueFieldName(unprocessed_value)]["value"] = register_values
    }
    console.log("Register value updated for " + register_name + " to " + register_value + " for node " + node_id)
    return await zubax_api.update_register_value(register_name, unprocessed_value, node_id);
}
export function rereadPairs(pairs, yukon_state) {
    // For every key of node_id in pairs
    for (let node_id in pairs) {
        if (!yukon_state.recently_reread_registers[node_id]) {
            yukon_state.recently_reread_registers[node_id] = {};
        }
        // For every key of register_name in pairs[node_id]
        for (let register_name in pairs[node_id]) {
            // Add the register to recently_reread_registers
            yukon_state.recently_reread_registers[node_id][register_name] = true;
        }
    }
    updateRegistersTableColors(yukon_state);
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
    yukon_state.zubax_api.reread_registers(pairs);
}
export function rereadNode(integer_node_id) {
    zubax_api.reread_node(integer_node_id)
}