// A pair is a pair of nodeid and register name
export function get_all_selected_pairs(options, state) {
    if(!options) {
        options = {};
    }
    let final_dict = {};
    let current_avatars = state.current_avatars;
    let selected_columns = state.selections.selected_columns;
    let selected_rows = state.selections.selected_rows;
    let selected_registers = state.selections.selected_registers;
    // For each avatar in current_avatars
    for (var i = 0; i < current_avatars.length; i++) {
        let avatar_dto = {
            // "uavcan.node.id": current_avatars[i].node_id,
        };
        var avatar = current_avatars[i];
        let saving_all = selected_columns[avatar.node_id] || options.only_of_avatar_of_node_id == avatar.node_id;
        if (options.only_of_avatar_of_node_id && current_avatars[i].node_id != options.only_of_avatar_of_node_id) {
            continue;
        }

        // For each key in avatar.registers_exploded_values
        for (var key in avatar.registers_exploded_values) {
            let register_name = key;
            let register_value = avatar.registers_exploded_values[key];
            if (options.get_everything) {
                avatar_dto[register_name] = register_value;
                continue;
            }
            if (options.only_of_register_name && register_name != options.only_of_register_name) {
                continue;
            }
            if (saving_all || selected_rows[register_name] ||
                selected_registers[[avatar.node_id, register_name]]) {
                avatar_dto[register_name] = register_value;
            }
        }
        if (Object.keys(avatar_dto).length > 0) {
            final_dict[parseInt(avatar.node_id)] = avatar_dto;
        }
    }
    return final_dict;
}
export function select_configuration(yukon_state, i) {
    yukon_state.selections.selected_config = i;
}
export function getAllEntireColumnsThatAreSelected(yukon_state) {
    let all_registers_selected = {};
    // For every register in the avatar with the node_id
    for (var i = 0; i < yukon_state.current_avatars.length; i++) {
        const current_avatar = yukon_state.current_avatars[i]
        const node_id = current_avatar.node_id;
        all_registers_selected[current_avatar.node_id] = true;
        for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
            const register_name = yukon_state.current_avatars[i].registers[j];
            if (!yukon_state.selections.selected_registers[[node_id, register_name]]) {
                all_registers_selected[current_avatar.node_id] = false;
                break;
            }
        }
    }
    return all_registers_selected;
}