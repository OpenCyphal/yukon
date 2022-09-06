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

export function make_select_column(node_id, is_mouse_over) {
    return function (event) {
        if (is_mouse_over) {
            if (!event.buttons == 1) {
                return;
            }
        }
        // Check if the mouse button was not a left click
        if (event.button !== 0) {
            return;
        }
        // I want to make sure that the user is not selecting text, that's not when we activate this.
        if (window.getSelection().toString() !== "") {
            return;
        }
        event.stopPropagation();
        if (is_selection_mode_complicated) {
            if (selected_columns[node_id]) {
                selected_columns[node_id] = false;
                addLocalMessage("Column " + node_id + " deselected");
            } else {
                selected_columns[node_id] = true;
                addLocalMessage("Column " + node_id + " selected");
            }
        } else {
            // See if any register of this node_id is selected
            let any_register_selected = false;
            // For every register in the avatar with the node_id
            for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                const current_avatar = yukon_state.current_avatars[i]
                if (current_avatar.node_id == node_id) {
                    for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                        const register_name = yukon_state.current_avatars[i].registers[j];
                        if (selected_registers[[node_id, register_name]]) {
                            any_register_selected = true;
                            break;
                        }
                    }
                }
            }
            if (any_register_selected) {
                // Deselect all registers of this node_id
                for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                    const current_avatar = yukon_state.current_avatars[i]
                    if (current_avatar.node_id == node_id) {
                        for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                            const register_name = yukon_state.current_avatars[i].registers[j];
                            selected_registers[[node_id, register_name]] = false;
                        }
                    }
                }
                addLocalMessage("Column " + node_id + " deselected");
            } else {
                // Select all registers of this node_id
                for (var i = 0; i < yukon_state.current_avatars.length; i++) {
                    const current_avatar = yukon_state.current_avatars[i]
                    if (current_avatar.node_id == node_id) {
                        for (var j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                            const register_name = yukon_state.current_avatars[i].registers[j];
                            selected_registers[[node_id, register_name]] = true;
                        }
                    }
                }
                addLocalMessage("Column " + node_id + " selected");
            }

        }
        updateRegistersTableColors();

    }
}