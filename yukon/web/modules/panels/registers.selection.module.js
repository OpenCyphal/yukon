import { updateRegistersTableColors, showCellValue } from "./registers.module.js";
import { rereadPairs } from "./registers.data.module.js";

// A pair is a pair of nodeid and register name
export function get_all_selected_pairs(options, yukon_state) {
    if (!options) {
        options = {};
    }
    let final_dict = {};
    let current_avatars = yukon_state.current_avatars;
    let selected_columns = yukon_state.selections.selected_columns;
    let selected_rows = yukon_state.selections.selected_rows;
    let selected_registers = yukon_state.selections.selected_registers;
    // For each avatar in current_avatars
    for (let i = 0; i < current_avatars.length; i++) {
        let avatar_dto = {
            // "uavcan.node.id": current_avatars[i].node_id,
        };
        let avatar = current_avatars[i];
        let saving_all = selected_columns[avatar.node_id] || options.only_of_avatar_of_node_id == avatar.node_id;
        if (options.only_of_avatar_of_node_id && current_avatars[i].node_id != options.only_of_avatar_of_node_id) {
            continue;
        }

        // For each key in avatar.registers_exploded_values
        for (let key in avatar.registers_exploded_values) {
            let register_name = key;
            let register_value = avatar.registers_exploded_values[key];
            if (options.only_of_register_name && register_name != options.only_of_register_name) {
                continue;
            }
            if (options.get_everything) {
                avatar_dto[register_name] = register_value;
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

export function select_configuration(file_name, yukon_state) {
    yukon_state.selections.selected_config = file_name;
}

export function getAllEntireColumnsThatAreSelected(yukon_state) {
    let all_registers_selected = {};
    // For every register in the avatar with the node_id
    for (let i = 0; i < yukon_state.current_avatars.length; i++) {
        const current_avatar = yukon_state.current_avatars[i]
        const node_id = current_avatar.node_id;
        all_registers_selected[current_avatar.node_id] = true;
        for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
            const register_name = yukon_state.current_avatars[i].registers[j];
            if (!yukon_state.selections.selected_registers[[node_id, register_name]]) {
                all_registers_selected[current_avatar.node_id] = false;
                break;
            }
        }
    }
    return all_registers_selected;
}

export function make_select_column(node_id, is_mouse_over, yukon_state) {
    return function (event) {
        if (yukon_state.is_cursor_snapping_column || yukon_state.is_cursor_dragging_column || yukon_state.grabbing_in_registers_view) {
            return;
        }
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
        if (yukon_state.settings.is_selection_mode_complicated) {
            if (yukon_state.selections.selected_columns[node_id]) {
                yukon_state.selections.selected_columns[node_id] = false;
            } else {
                yukon_state.selections.selected_columns[node_id] = true;
            }
        } else {
            selectColumn(node_id, yukon_state);
        }
        updateRegistersTableColors(yukon_state);

    }
}

export function selectColumn(node_id, yukon_state) {
    // See if any register of this node_id is selected
    let any_register_selected = false;
    // For every register in the avatar with the node_id
    for (let i = 0; i < yukon_state.current_avatars.length; i++) {
        const current_avatar = yukon_state.current_avatars[i]
        if (current_avatar.node_id == node_id) {
            for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                const register_name = yukon_state.current_avatars[i].registers[j];
                if (yukon_state.selections.selected_registers[[node_id, register_name]]) {
                    any_register_selected = true;
                    break;
                }
            }
        }
    }
    if (any_register_selected) {
        // Deselect all registers of this node_id
        for (let i = 0; i < yukon_state.current_avatars.length; i++) {
            const current_avatar = yukon_state.current_avatars[i]
            if (current_avatar.node_id == node_id) {
                for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                    const register_name = yukon_state.current_avatars[i].registers[j];
                    yukon_state.selections.selected_registers[[node_id, register_name]] = false;
                }
            }
        }
    } else {
        // Select all registers of this node_id
        for (let i = 0; i < yukon_state.current_avatars.length; i++) {
            const current_avatar = yukon_state.current_avatars[i]
            if (current_avatar.node_id == node_id) {
                for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                    const register_name = yukon_state.current_avatars[i].registers[j];
                    yukon_state.selections.selected_registers[[node_id, register_name]] = true;
                }
            }
        }
    }
}

export function selectRow(register_name, yukon_state) {
    if (yukon_state.settings.is_selection_mode_complicated) {
        if (!yukon_state.selections.selected_rows[register_name]) {
            yukon_state.selections.selected_rows[register_name] = true;
        } else {
            yukon_state.selections.selected_rows[register_name] = false;
        }
    } else {
        // See if any register of this node_id is selected
        let any_register_selected = false;
        // For every register in the avatar with the node_id
        for (let i = 0; i < yukon_state.current_avatars.length; i++) {
            const current_avatar = yukon_state.current_avatars[i];
            const node_id = current_avatar.node_id;
            for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                const register_name2 = yukon_state.current_avatars[i].registers[j];
                if (register_name2 == register_name) {
                    if (yukon_state.selections.selected_registers[[node_id, register_name]]) {
                        any_register_selected = true;
                        break;
                    }
                }
            }
        }
        if (any_register_selected) {
            // Deselect all registers with this register_name
            for (let i = 0; i < yukon_state.current_avatars.length; i++) {
                const current_avatar = yukon_state.current_avatars[i]
                const node_id = current_avatar.node_id;
                for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                    const register_name2 = yukon_state.current_avatars[i].registers[j];
                    if (register_name2 == register_name) {
                        yukon_state.selections.selected_registers[[node_id, register_name]] = false;
                    }
                }
            }
        } else {
            // Select all registers with this register_name
            for (let i = 0; i < yukon_state.current_avatars.length; i++) {
                const current_avatar = yukon_state.current_avatars[i]
                const node_id = current_avatar.node_id;
                for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                    const register_name2 = yukon_state.current_avatars[i].registers[j];
                    if (register_name2 == register_name) {
                        yukon_state.selections.selected_registers[[node_id, register_name]] = true;
                    }
                }
            }
        }
    }
    updateRegistersTableColors(yukon_state);
}

export function make_select_row(register_name, is_mouse_over, yukon_state) {
    return function (event) {
        // If left mouse button is pressed
        // if (is_mouse_over) {
        // Check if the left mouse button isn't down or if the right mouse button is down, then return
        if (!event.buttons == 1 || event.buttons == 2) {
            return;
        }
        if (yukon_state.grabbing_in_registers_view) {
            return;
        }
        // }
        // I want to make sure that the user is not selecting text, that's not when we activate this.
        // if (window.getSelection().toString() !== "") {
        //     return;
        // }
        selectRow(register_name, yukon_state);
        event.stopPropagation();
    }
}

export function make_select_cell(avatar, register_name, is_mouse_over, yukon_state) {
    let selectCell = function () {
        if (yukon_state.is_cursor_snapping_column || yukon_state.is_cursor_dragging_column || yukon_state.grabbing_in_registers_view) {
            return;
        }
        if (!yukon_state.selections.selected_registers[[avatar.node_id, register_name]]) {
            yukon_state.selections.selected_registers[[avatar.node_id, register_name]] = true;
            // If shift is being held down
            if (yukon_state.pressedKeys[16] && yukon_state.selections.last_cell_selected) {
                const allCells = getAllCellsInBetween(yukon_state.selections.last_cell_selected, {
                    "node_id": avatar.node_id,
                    "register_name": register_name
                }, yukon_state);
                for (let i = 0; i < allCells.length; i++) {
                    const cell = allCells[i];
                    yukon_state.selections.selected_registers[[cell.node_id, cell.register_name]] = true;
                }
            }
            yukon_state.selections.last_cell_selected = { "node_id": avatar.node_id, "register_name": register_name };
        } else {
            yukon_state.selections.selected_registers[[avatar.node_id, register_name]] = false;
        }
        updateRegistersTableColors(yukon_state);
    }
    return function (event) {
        if (is_mouse_over) {
            if (!event.buttons == 1) {
                return;
            }
            if (event.target.matches(':hover')) {
                // If alt is pressed
                if (yukon_state.pressedKeys[18]) {
                    // Reread the register
                    let pairs_object = {};
                    pairs_object[avatar.node_id] = {};
                    pairs_object[avatar.node_id][register_name] = true;
                    rereadPairs(pairs_object, yukon_state);
                    return;
                }
                selectCell();
                event.stopPropagation();
            }
        } else {
            // If alt is pressed
            if (yukon_state.pressedKeys[18]) {
                // Reread the register
                let pairs_object = {};
                pairs_object[avatar.node_id] = {};
                pairs_object[avatar.node_id][register_name] = true;
                rereadPairs(pairs_object, yukon_state);
                return;
            }
            // If control is pressed
            if (yukon_state.pressedKeys[17]) {
                showCellValue(avatar.node_id, register_name, yukon_state);
                return;
            }
            selectCell();
        }
    }
}

function getAllCellsInBetween(start_cell, end_cell, yukon_state) {
    let row_based_selection = false;
    let column_based_selection = false;
    if (start_cell.node_id === end_cell.node_id) {
        column_based_selection = true;
    } else if (start_cell.register_name === end_cell.register_name) {
        row_based_selection = true;
    } else {
        return [];
    }
    let all_cells = [];
    let start_table_cell = null;
    let end_table_cell = null;
    if (row_based_selection) {
        start_table_cell = document.getElementById("cell_" + start_cell.node_id + "_" + start_cell.register_name);
        end_table_cell = document.getElementById("cell_" + end_cell.node_id + "_" + end_cell.register_name);
        for (let i = 0; i < yukon_state.current_avatars.length; i++) {
            const current_avatar = yukon_state.current_avatars[i];
            // For every register in the avatar
            for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                const register_name = yukon_state.current_avatars[i].registers[j];
                if (!register_name || register_name !== start_cell.register_name) {
                    continue;
                }
                // Get the cell corresponding to this register
                const table_cell = document.getElementById("cell_" + current_avatar.node_id + "_" + register_name);

                if (table_cell.offsetLeft > start_table_cell.offsetLeft && table_cell.offsetLeft < end_table_cell.offsetLeft ||
                    table_cell.offsetLeft < start_table_cell.offsetLeft && table_cell.offsetLeft > end_table_cell.offsetLeft) {
                    // Add it to the list
                    all_cells.push({ "node_id": current_avatar.node_id, "register_name": register_name });
                }
            }
        }
    } else {
        start_table_cell = document.getElementById("cell_" + start_cell.node_id + "_" + start_cell.register_name);
        end_table_cell = document.getElementById("cell_" + end_cell.node_id + "_" + end_cell.register_name);
        for (let i = 0; i < yukon_state.current_avatars.length; i++) {
            const current_avatar = yukon_state.current_avatars[i];
            if (current_avatar.node_id !== start_cell.node_id) {
                continue;
            }
            // For every register in the avatar
            for (let j = 0; j < yukon_state.current_avatars[i].registers.length; j++) {
                const register_name = yukon_state.current_avatars[i].registers[j];
                if (!register_name) {
                    continue;
                }
                // Get the cell corresponding to this register
                const table_cell = document.getElementById("cell_" + current_avatar.node_id + "_" + register_name);
                // If the table_cell is above the start_table_cell and below the end_table_cell
                if (table_cell.offsetTop > start_table_cell.offsetTop && table_cell.offsetTop < end_table_cell.offsetTop ||
                    table_cell.offsetTop < start_table_cell.offsetTop && table_cell.offsetTop > end_table_cell.offsetTop) {
                    // Add it to the list
                    all_cells.push({ "node_id": current_avatar.node_id, "register_name": register_name });
                }

            }
        }
    }
    return all_cells;
}

export function unselectAll(yukon_state) {
    yukon_state.addLocalMessage("Unselecting all registers", 10);
    yukon_state.selections.selected_registers = {};
    yukon_state.selections.selected_columns = {};
    yukon_state.selections.selected_rows = {};
    updateRegistersTableColors(yukon_state);
    window.getSelection()?.removeAllRanges();
    yukon_state.selections.last_cell_selected = null;
}

export function selectAll(yukon_state) {
    // Iterate through every avatar in current_avatars and register_name and add them to the selected_registers
    yukon_state.addLocalMessage("Selecting all registers", 10);
    if (isAllSelected(yukon_state)) {
        unselectAll(yukon_state);
        return;
    }
    for (let avatar of yukon_state.current_avatars) {
        for (let register_name of avatar.registers) {
            if (!register_name) {
                continue;
            }
            yukon_state.selections.selected_registers[[avatar.node_id, register_name]] = true;
        }
    }
    updateRegistersTableColors(yukon_state);
}

function isAllSelected(yukon_state) {
    let allSelected = true;
    for (let avatar of yukon_state.current_avatars) {
        for (let register_name of avatar.registers) {
            if (!register_name) {
                continue;
            }
            if (yukon_state.selections.selected_registers[[avatar.node_id, register_name]]) {
                continue;
            } else {
                allSelected = false;
                break;
            }
        }
    }
    return allSelected;
}

export const moreThanOneSelectedConstraint = () => {
    // If there are more than 1 selected registers
    return Object.keys(yukon_state.selections.selected_registers).length > 1;
}
export const oneSelectedConstraint = () => {
    return Object.keys(yukon_state.selections.selected_registers).length == 1;
};