import { export_all_selected_registers, update_available_configurations_list, applyConfiguration, openFile } from "./yaml.configurations.module.js";
import { getAllEntireColumnsThatAreSelected, get_all_selected_pairs, unselectAll } from "./registers.selection.module.js";
import { updateRegistersTableColors, showCellValue, editSelectedCellValues } from "./registers.module.js";
import { rereadPairs } from "./registers.data.module.js";
function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}
function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function () {
        console.log('Async: Copying to clipboard was successful!');
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
    });
}
export function make_context_menus(yukon_state) {
    const addLocalMessage = yukon_state.addLocalMessage;
    const copyIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const cutIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`;
    const pasteIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px; position: relative; top: -1px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;
    const downloadIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" style="margin-right: 7px; position: relative; top: -1px" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    const deleteIcon = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 7px" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    const importFromSelectedConfigurationMenuElement = {
        content: "Import from selected configuration",
        events: {
            click: async function (event, elementOpenedOn) {
                const cell = elementOpenedOn;
                // If cell is a th then
                let pairs = null;
                if (cell.tagName == "TH") {
                    // Get the node_id and register_name from the cell
                    const node_id = cell.getAttribute("data-node_id");
                    pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": node_id,
                        "get_everything": false,
                        "only_of_register_name": null
                    }, yukon_state);
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
                const current_config = yukon_state.available_configurations[selected_config];
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
                    if (Array.isArray(value)) {
                        dimensionality = "[" + value.length + "]";
                    }
                    datatype = datatype + dimensionality;
                    copyTextToClipboard(datatype);
                }
            }
        },
        {
            content: `${copyIcon}Copy values`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    const avatar = yukon_state.current_avatars.find((a) => a.node_id == node_id);
                    let register_value = avatar.registers_values[register_name];
                    copyTextToClipboard(register_value);
                }
            }
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
                    let result_dto = null;
                    result_dto = await openFile(yukon_state);
                    if (result_dto.text == "") {
                        addLocalMessage("No configuration imported");
                    } else {
                        const headerCell = elementOpenedOn;
                        const node_id = headerCell.getAttribute("data-node_id");
                        const avatar = Object.values(yukon_state.current_avatars).find((e) => e.node_id == parseInt(node_id));
                        addLocalMessage("Configuration imported");
                        const selected_config = result_dto.name;
                        yukon_state.available_configurations[selected_config] = result_dto.text;
                        await update_available_configurations_list(yukon_state);
                        const current_config = yukon_state.available_configurations[yukon_state.selections.selected_config];
                        if (current_config) {
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
                                    console.log("Column " + key + " is fully selected");
                                    applyConfiguration(current_config, parseInt(node_id2), null, yukon_state);
                                }
                            }
                            // The column that the context menu is activated on is used anyway
                            applyConfiguration(current_config, parseInt(avatar.node_id), null, yukon_state);
                        } else {
                            console.log("No configuration selected");
                        }
                        if (!yukon_state.recently_reread_registers[node_id]) {
                            yukon_state.recently_reread_registers[node_id] = {};
                        }
                        for (let i = 0; i < avatar.registers.length; i++) {
                            const register_name = avatar.registers[i];
                            yukon_state.recently_reread_registers[node_id][register_name] = true;
                        }

                        updateRegistersTableColors(yukon_state);
                        let registers_to_reset = JSON.parse(JSON.stringify(yukon_state.recently_reread_registers));
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
                    let registers_to_reset = JSON.parse(JSON.stringify(yukon_state.recently_reread_registers));
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
            content: `${copyIcon}Copy values`,
            events: {
                click: (e) => {

                }
            }
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
}
