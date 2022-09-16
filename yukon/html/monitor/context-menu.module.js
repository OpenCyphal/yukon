import { export_all_selected_registers, return_all_selected_registers_as_yaml, update_available_configurations_list, applyConfiguration, openFile, actionApplyConfiguration } from "./yaml.configurations.module.js";
import { selectRow, getAllEntireColumnsThatAreSelected, get_all_selected_pairs, make_select_row, unselectAll } from "./registers.selection.module.js";
import { updateRegistersTableColors, showCellValue, editSelectedCellValues } from "./registers.module.js";
import { rereadPairs } from "./registers.data.module.js";
import { downloadIcon, copyIcon, pasteIcon } from "./icons.module.js";
import { copyObject } from "./utilities.module.js";
import { copyTextToClipboard } from "./copy.module.js";

export function make_context_menus(yukon_state) {
    const addLocalMessage = yukon_state.addLocalMessage;
    const importFromSelectedConfigurationMenuElement = {
        content: "Import from selected configuration",
        events: {
            click: async function (event, elementOpenedOn) {
                const cell = elementOpenedOn;
                // If cell is a th then
                let pairs = null;
                if (cell.tagName == "TH") {
                    // If the cell has class left-side-table-header
                    if (cell.classList.contains("left-side-table-header")) {
                        const register_name = cell.getAttribute("data-register_name");
                        pairs = get_all_selected_pairs({
                            "only_of_avatar_of_node_id": null,
                            "get_everything": false,
                            "only_of_register_name": register_name
                        }, yukon_state);
                    } else {
                        // Get the node_id and register_name from the cell
                        const node_id = cell.getAttribute("data-node_id");
                        pairs = get_all_selected_pairs({
                            "only_of_avatar_of_node_id": node_id,
                            "get_everything": false,
                            "only_of_register_name": null
                        }, yukon_state);
                    }
                    
                } else if (cell.tagName == "TD" || cell.tagName == "INPUT") {
                    // Get the node_id and register_name from the cell
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": false,
                        "get_everything": false,
                        "only_of_register_name": null
                    }, yukon_state);
                    // If pairs contains nothing then add the node_id and register_name
                    if (pairs.length == 0) {
                        pairs[node_id][register_name] = true;
                    }
                }
                const node_id = cell.getAttribute("node_id");
                const register_name = cell.getAttribute("register_name");
                const current_config = yukon_state.available_configurations[yukon_state.selections.selected_config];
                if (current_config) {
                    applyConfiguration(current_config, parseInt(node_id), pairs, yukon_state);
                } else {
                    console.log("No configuration selected");
                }
            }
        }
    }
    const unselectAllMenuElement = {
        content: "Unselect all (ESC 2x)",
        events: {
            click: function () {
                unselectAll(yukon_state);
            }
        }
    }
    const moreThanOneSelectedConstraint = (e, elementOpenedOn) => {
        // If there are more than 1 selected registers
        if (Object.keys(yukon_state.selections.selected_registers).length > 1) {
            return true;
        }
        return false;
    }
    const oneSelectedConstraint = (e, elementOpenedOn) => {
        if (Object.keys(yukon_state.selections.selected_registers).length <= 1) {
            return true;
        }
        return false;
    };
    // For table cells
    const table_cell_context_menu_items = [
        {
            content: `${downloadIcon}Set value`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    showCellValue(node_id, register_name, yukon_state);
                }
            },
            shouldBeDisplayed: oneSelectedConstraint
        },
        {
            content: `${downloadIcon}Set values`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const all_selected_pairs = get_all_selected_pairs(null, yukon_state);
                    editSelectedCellValues(all_selected_pairs);
                }
            },
            shouldBeDisplayed: moreThanOneSelectedConstraint
        },
        {
            content: `Make text unselectable`,
            events: {
                click: (e, elementOpenedOn) => {
                    yukon_state.settings.isTableCellTextSelectable = false;
                    document.body.appendChild(yukon_state.selectingTableCellsIsDisabledStyle);
                }
            },
            shouldBeDisplayed: () => yukon_state.settings.isTableCellTextSelectable
        },
        {
            content: `Make text selectable`,
            events: {
                click: (e, elementOpenedOn) => {
                    yukon_state.settings.isTableCellTextSelectable = true;
                    document.body.removeChild(yukon_state.selectingTableCellsIsDisabledStyle);
                }
            },
            shouldBeDisplayed: () => !yukon_state.settings.isTableCellTextSelectable
        },
        {
            content: `${downloadIcon}Export selected registers`,
            events: {
                click: async (e) => {
                    await export_all_selected_registers(null, null, yukon_state);
                }
            },
        },
        {
            content: `${pasteIcon}Set value from config`,
            events: {
                click: (e) => {

                }
            },
            shouldBeDisplayed: oneSelectedConstraint
        },
        {
            content: `${copyIcon}Copy datatype`, divider: "top",
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    const current_avatar = yukon_state.current_avatars.find((a) => a.node_id == node_id);
                    const registers_exploded_values = current_avatar.registers_exploded_values;
                    let datatype = Object.keys(registers_exploded_values[register_name])[0];
                    let register_value = registers_exploded_values[register_name];
                    let value = Object.values(register_value)[0].value;
                    let dimensionality = "";
                    if (Array.isArray(value)) {
                        dimensionality = "[" + value.length + "]";
                    }
                    datatype = datatype + dimensionality;
                    copyTextToClipboard(datatype);
                }
            },
            shouldBeDisplayed: oneSelectedConstraint
        },
        {
            content: `${copyIcon}Copy value`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    const avatar = yukon_state.current_avatars.find((a) => a.node_id == node_id);
                    let register_value = avatar.registers_values[register_name];
                    copyTextToClipboard(register_value);
                }
            },
            shouldBeDisplayed: oneSelectedConstraint
        },
        {
            content: `${copyIcon}Copy selected as yaml`,
            events: {
                click: async (e, elementOpenedOn) => {
                    const headerCell = elementOpenedOn;
                    const node_id = headerCell.getAttribute("data-node_id");
                    let pairs = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": false, "only_of_register_name": null }, yukon_state);
                    copyTextToClipboard(await return_all_selected_registers_as_yaml(pairs, yukon_state));
                    e.stopPropagation();
                }
            },
            shouldBeDisplayed: moreThanOneSelectedConstraint
        },
        {
            content: `${downloadIcon}Reread registers`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    const pairs = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": false, "only_of_register_name": null }, yukon_state);
                    // The current cell was the element that this context menu was summoned on
                    // If there are no keys in pairs, then add the current cell
                    if (Object.keys(pairs).length == 0) {
                        pairs[node_id] = {}
                        pairs[node_id][register_name] = true;
                    }
                    rereadPairs(pairs, yukon_state);
                }
            }
        },
        unselectAllMenuElement,
        importFromSelectedConfigurationMenuElement
    ];
    const table_cell_context_menu = new ContextMenu({
        target: "table-cell",
        menuItems: table_cell_context_menu_items,
        mode: "dark",
        context: this
    });
    table_cell_context_menu.init();

    const table_header_context_menu_items = [
        { content: `${pasteIcon}Select column` },
        {
            content: `${downloadIcon}Apply a config from a file`,
            events: {
                click: async (e, elementOpenedOn) => {
                    const headerCell = elementOpenedOn;
                    const node_id = headerCell.getAttribute("data-node_id");
                    const avatar = Object.values(yukon_state.current_avatars).find((e) => e.node_id == parseInt(node_id));
                    actionApplyConfiguration(true, false, avatar, false, yukon_state);
                }
            },
            divider: "top"
        },
        {
            content: `${copyIcon}Export all registers`,
            events: {
                click: async (e, elementOpenedOn) => {
                    const headerCell = elementOpenedOn;
                    const node_id = headerCell.getAttribute("data-node_id");
                    const avatar = Object.values(yukon_state.current_avatars).find((e) => e.node_id == parseInt(node_id));
                    e.stopPropagation();
                    addLocalMessage("Exporting registers of " + avatar.node_id);
                    //const result = window.chooseFileSystemEntries({ type: "save-file" });
                    // Export all but only for this avatar, dried up code
                    await export_all_selected_registers(avatar.node_id, null, yukon_state);
                    if (!yukon_state.recently_reread_registers[node_id]) {
                        yukon_state.recently_reread_registers[node_id] = {};
                    }
                    for (let i = 0; i < avatar.registers.length; i++) {
                        const register_name = avatar.registers[i];
                        yukon_state.recently_reread_registers[node_id][register_name] = true;
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
                    }, 600);
                }
            }
        },
        {
            content: `${copyIcon}Copy column as yaml`,
            events: {
                click: async (e, elementOpenedOn) => {
                    const headerCell = elementOpenedOn;
                    const node_id = headerCell.getAttribute("data-node_id");
                    let pairs = get_all_selected_pairs({ "only_of_avatar_of_node_id": node_id, "get_everything": false, "only_of_register_name": null }, yukon_state);
                    copyTextToClipboard(await return_all_selected_registers_as_yaml(pairs, yukon_state));
                    e.stopPropagation();
                }
            },
        },
        {
            content: `${downloadIcon}Reread column`,
            events: {
                click: (e, elementOpenedOn) => {
                    const headerCell = elementOpenedOn;
                    const node_id = headerCell.getAttribute("data-node_id");
                    const data = get_all_selected_pairs({ "only_of_avatar_of_node_id": node_id, "get_everything": false, "only_of_register_name": null }, yukon_state);
                    rereadPairs(data, yukon_state);
                }
            }
        },
        unselectAllMenuElement,
        importFromSelectedConfigurationMenuElement
    ];

    const table_header_context_menu = new ContextMenu({
        target: "node_id_header",
        mode: "dark",
        menuItems: table_header_context_menu_items,
        context: this
    });
    table_header_context_menu.init();
    const table_row_header_context_menu_items = [
        {
            content: `Select row`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const register_name = cell.getAttribute("data-register_name");
                    selectRow(register_name, yukon_state);
                    e.stopPropagation();
                }
            },
        },
        importFromSelectedConfigurationMenuElement,
        {
            content: `Copy row as yaml`,
            events: {
                click: async (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const register_name = cell.getAttribute("data-register_name");
                    let pairs = get_all_selected_pairs({ "only_of_avatar_of_node_id": null, "get_everything": true, "only_of_register_name": register_name }, yukon_state);
                    copyTextToClipboard(await return_all_selected_registers_as_yaml(pairs, yukon_state));
                    e.stopPropagation();
                }
            },
        },
    ];
    const table_row_header_context_menu = new ContextMenu({
        target: "left-side-table-header",
        mode: "dark",
        menuItems: table_row_header_context_menu_items,
        context: this
    });
    table_row_header_context_menu.init();
}
