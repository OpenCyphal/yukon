export function update_register_value(register_name, register_value, node_id, yukon_state) {
    const zubax_api = yukon_state.zubax_api;
    // Find the avatar which has the node_id
    const the_avatar = yukon_state.current_avatars.find((avatar) => avatar.node_id === parseInt(node_id));
    let unprocessed_value = JSON.parse(JSON.stringify(the_avatar["registers_exploded_values"][register_name]))
    // if unprocessed_value[Object.keys(the_value)[0]]["value"]
    if (typeof unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] == "string") {
        unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] = register_value
    } else if (typeof unprocessed_value[Object.keys(unprocessed_value)[0]]["value"][0] == "number") {
        // Split register_value by comma and convert to array of numbers
        // Remove square brackets
        register_value = register_value.replace("[", "").replace("]", "");
        let register_values = register_value.split(",").map(Number);
        unprocessed_value[Object.keys(unprocessed_value)[0]]["value"] = register_values
    }
    console.log("Register value updated for " + register_name + " to " + register_value + " for node " + node_id)
    zubax_api.update_register_value(register_name, unprocessed_value, node_id);
}