import {
    export_all_selected_registers,
    return_all_selected_registers_as_yaml,
    update_available_configurations_list,
    applyConfiguration,
    openFile,
    actionApplyConfiguration
} from "./yaml.configurations.module.js";
import {
    selectColumn,
    selectRow,
    getAllEntireColumnsThatAreSelected,
    get_all_selected_pairs,
    make_select_row,
    unselectAll,
    make_select_column,
    moreThanOneSelectedConstraint,
    oneSelectedConstraint,
} from "./panels/registers.selection.module.js";
import { getDatatypesForPort } from "./utilities.module.js";
import { updateRegistersTableColors, showCellValue, editSelectedCellValues } from "./panels/registers.module.js";
import { rereadNode, rereadPairs } from "./panels/registers.data.module.js";
import { downloadIcon, copyIcon, pasteIcon } from "./icons.module.js";
import { copyObject, getDictionaryValueFieldName } from "./utilities.module.js";
import { copyTextToClipboard } from "./copy.module.js";
import { getPortType } from "./panels/monitor2/monitor2.module.js";
import { guid } from "./guid.js";

export function make_context_menus(yukon_state) {
    const addLocalMessage = yukon_state.addLocalMessage;
    const importFromSelectedConfigurationMenuElement = {
        content: "Apply from selected configuration",
        events: {
            click: async function (event, elementOpenedOn) {
                const cell = elementOpenedOn;
                // If cell is a th then
                let pairs = null;
                let node_id = null;
                if (cell.tagName === "TH") {
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
                        node_id = cell.getAttribute("data-node_id");
                        pairs = get_all_selected_pairs({
                            "only_of_avatar_of_node_id": node_id,
                            "get_everything": false,
                            "only_of_register_name": null
                        }, yukon_state);
                    }

                } else if (cell.tagName === "TD" || cell.tagName === "INPUT") {
                    // Get the node_id and register_name from the cell
                    node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": false,
                        "get_everything": false,
                        "only_of_register_name": null
                    }, yukon_state);
                    // If pairs contains nothing then add the node_id and register_name
                    if (pairs.length === 0) {
                        pairs[node_id][register_name] = true;
                    }
                }
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
    // For table cells
    const table_cell_context_menu_items = [
        {
            content: `Show/edit value`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    showCellValue(node_id, register_name, yukon_state);
                }
            },
        },
        {
            content: `Bulk set values`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const all_selected_pairs = get_all_selected_pairs(null, yukon_state);
                    editSelectedCellValues(all_selected_pairs, yukon_state);
                }
            },
            shouldBeDisplayed: moreThanOneSelectedConstraint
        },
        {
            content: `Export selected registers`,
            events: {
                click: async (e) => {
                    await export_all_selected_registers(null, null, yukon_state);
                }
            },
        },
        {
            content: `Set value from config`,
            events: {
                click: (e) => {

                }
            },
            shouldBeDisplayed: oneSelectedConstraint
        },
        {
            content: `Copy datatype`, divider: "top",
            events: {
                click: async (e, elementOpenedOn) => {
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
                    await copyTextToClipboard(datatype);
                }
            },
        },
        {
            content: `Copy value`,
            events: {
                click: async (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    const avatar = yukon_state.current_avatars.find((a) => a.node_id == node_id);
                    let register_value = avatar.registers_values[register_name];
                    await copyTextToClipboard(register_value);
                }
            },
        },
        {
            content: `Copy selected as yaml`,
            events: {
                click: async (e, elementOpenedOn) => {
                    let pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": null,
                        "get_everything": false,
                        "only_of_register_name": null
                    }, yukon_state);
                    const selectedCells = document.querySelectorAll(".selected-cell .input")
                    for (let i = 0; i < selectedCells.length; i++) {
                        const selectedCell = selectedCells[i];
                        const previousText = selectedCell.innerHTML;
                        selectedCell.innerHTML = "Generating yaml!";
                        setTimeout(function () {
                            if (selectedCell.innerHTML === "Copied!" || selectedCell.innerHTML === "Generating yaml!" || selectedCell.innerHTML === "Copy failed!") {
                                selectedCell.innerHTML = previousText;
                            }
                        }, 1000);
                    }
                    const yaml_text = await return_all_selected_registers_as_yaml(pairs, yukon_state);

                    const didCopySucceed = await copyTextToClipboard(yaml_text, e);
                    if (!didCopySucceed) {
                        for (let i = 0; i < selectedCells.length; i++) {
                            const selectedCell = selectedCells[i];
                            selectedCell.innerHTML = "Copy failed!";
                        }
                        addLocalMessage("Please make sure to click on the Yukon window somewhere to focus the window when a copy fails.", 40)
                    }
                    for (let i = 0; i < selectedCells.length; i++) {
                        const selectedCell = selectedCells[i];
                        selectedCell.innerHTML = "Copied!";
                    }
                }
            },
            shouldBeDisplayed: moreThanOneSelectedConstraint
        },
        {
            content: `Reread registers`,
            events: {
                click: (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const node_id = cell.getAttribute("node_id");
                    const register_name = cell.getAttribute("register_name");
                    const pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": null,
                        "get_everything": false,
                        "only_of_register_name": null
                    }, yukon_state);
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
    const restoreBtnContextMenu = new ContextMenu({
        target: ".restore-btn",
        menuItems: [
            {
                content: `Remove restore button`,
                events: {
                    click: async (e, elementOpenedOn) => {
                        elementOpenedOn.parentElement.removeChild(elementOpenedOn);
                    }
                },
            },
        ],
        mode: "dark",
        context: this
    });
    restoreBtnContextMenu.init();
    const table_cell_context_menu = new ContextMenu({
        target: ".table-cell",
        menuItems: table_cell_context_menu_items,
        mode: "dark",
        context: this
    });
    table_cell_context_menu.init();
    function getHeaderCellFromElement(elementOpenedOn) {
        if (elementOpenedOn.classList.contains("table_header_cell_collider")) {
            return elementOpenedOn.parentElement;
        } else {
            return elementOpenedOn;
        }
    }
    const table_header_context_menu_items = [
        {
            content: `Select node registers`,
            events: {
                click: async (e, elementOpenedOn) => {
                    let headerCell = getHeaderCellFromElement(elementOpenedOn);
                    const node_id = headerCell.getAttribute("data-node_id");
                    selectColumn(parseInt(node_id), yukon_state);
                    updateRegistersTableColors(yukon_state);
                }
            },
        },
        {
            content: `Apply config from file`,
            events: {
                click: async (e, elementOpenedOn) => {
                    let headerCell = getHeaderCellFromElement(elementOpenedOn);
                    const node_id = headerCell.getAttribute("data-node_id");
                    const avatar = Object.values(yukon_state.current_avatars).find((e) => e.node_id == parseInt(node_id));
                    actionApplyConfiguration(true, false, avatar, false, yukon_state, e);
                }
            },
            divider: "top"
        },
        importFromSelectedConfigurationMenuElement,
        {
            content: `Export all registers`,
            events: {
                click: async (e, elementOpenedOn) => {
                    let headerCell = getHeaderCellFromElement(elementOpenedOn);
                    const node_id = headerCell.getAttribute("data-node_id");
                    const avatar = Object.values(yukon_state.current_avatars).find((e) => e.node_id == parseInt(node_id));
                    e.stopPropagation();
                    addLocalMessage("Exporting registers of " + avatar.node_id, 20);
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
            content: `Copy node registers as YAML`,
            events: {
                click: async (e, elementOpenedOn) => {
                    let headerCell = getHeaderCellFromElement(elementOpenedOn);
                    const node_id = headerCell.getAttribute("data-node_id");
                    let pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": node_id,
                        "get_everything": false,
                        "only_of_register_name": null
                    }, yukon_state);
                    await copyTextToClipboard(await return_all_selected_registers_as_yaml(pairs, yukon_state));
                    e.stopPropagation();
                }
            },
        },
        {
            content: `Reread node`,
            events: {
                click: async (e, elementOpenedOn) => {
                    let headerCell = getHeaderCellFromElement(elementOpenedOn);
                    const node_id = headerCell.getAttribute("data-node_id");
                    await rereadNode(parseInt(node_id), yukon_state);
                }
            }
        },
        {
            content: "Store persistent states",
            events: {
                click: async (e, elementOpenedOn) => {
                    let headerCell = getHeaderCellFromElement(elementOpenedOn);
                    const node_id = headerCell.getAttribute("data-node_id");
                    const response = await yukon_state.zubax_apij.send_command(parseInt(node_id), 65530, "");
                    if (response) {
                        if (response.success) {
                            addLocalMessage("Stored persistent states for node " + node_id, 20);
                            const previousValue = headerCell.innerText;
                            headerCell.innerText = "Stored";
                            setTimeout(() => {
                                headerCell.innerText = previousValue;
                            }, 1200);
                        } else {
                            addLocalMessage("Failed to store persistent states for node " + node_id + " for this reason: ");
                            addLocalMessage(response.message, 40);
                            const previousValue = headerCell.innerText;
                            headerCell.innerText = "Store failed";
                            setTimeout(() => {
                                headerCell.innerText = previousValue;
                            }, 1200);
                        }
                    }
                }
            }
        },
        unselectAllMenuElement,
    ];

    const table_header_context_menu = new ContextMenu({
        target: ".node_id_header,.table_header_cell_collider",
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
        {
            content: `Copy register name`,
            events: {
                click: async (e, elementOpenedOn) => {
                    const cell = elementOpenedOn;
                    const register_name = cell.getAttribute("data-register_name");
                    await copyTextToClipboard(register_name);
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
                    let pairs = get_all_selected_pairs({
                        "only_of_avatar_of_node_id": null,
                        "get_everything": true,
                        "only_of_register_name": register_name
                    }, yukon_state);
                    await copyTextToClipboard(await return_all_selected_registers_as_yaml(pairs, yukon_state));
                    e.stopPropagation();
                }
            },
        },
    ];
    const table_row_header_context_menu = new ContextMenu({
        target: ".left-side-table-header",
        mode: "dark",
        menuItems: table_row_header_context_menu_items,
        context: this
    });
    table_row_header_context_menu.init();
    const cy_context_menu = new ContextMenu({
        target: "#cy",
        mode: "dark",
        menuItems: [
            {
                content: `Toggle background image`,
                events: {
                    click: async (e, elementOpenedOn) => {
                        elementOpenedOn.classList.toggle("with-background");
                    }
                },
            }
        ],
    })
    cy_context_menu.init();
    const subscriber_menu_items = [
        {
            content: "Add synchronized subscriber",
            events: {
                adjust: async (contextMenuContext, element, button, data) => {
                    const portsSelected = yukon_state.monitor2selections;
                    if (!portsSelected) {
                        element.parentElement.removeChild(element);
                        return;
                    }
                    const portsSelectedAndAllowed = [];
                    // TODO: Find which of the numbers correspond to publishers (don't want to subscribe to services)
                    for (const portNr of portsSelected) {
                        const portType = getPortType(portNr, yukon_state);
                        if (portType === "pub") {
                            portsSelectedAndAllowed.push(portNr);
                        } else {
                            console.log("Not subscribing to port " + portNr + " because it's not a publisher");
                            console.log("portType: " + portType);
                        }
                    }
                    if (portsSelectedAndAllowed.length > 1) {
                        button.innerHTML = "Subscribe to " + portsSelectedAndAllowed.join(", ") + " synchronously";
                    } else {
                        element.parentElement.removeChild(element);
                        return;
                    }
                },
                click: async (e, elementOpenedOn) => {
                    const portsSelectedAndAllowed = [];
                    // TODO: Find which of the numbers correspond to publishers (don't want to subscribe to services)
                    for (const portNr of yukon_state.monitor2selections) {
                        const portType = getPortType(portNr, yukon_state);
                        if (portType === "pub") {
                            portsSelectedAndAllowed.push(portNr);
                        } else {
                            console.log("Not subscribing to port " + portNr + " because it's not a publisher");
                            console.log("portType: " + portType);
                        }
                    }
                    yukon_state.subscriptions_being_set_up.push({ subject_ids: portsSelectedAndAllowed.slice() });
                }
            }
        },
        {
            content: "Add separate subscribers",
            events: {
                adjust: async (contextMenuContext, element, button, data) => {
                    const portsSelected = yukon_state.monitor2selections;
                    if (!portsSelected) {
                        element.parentElement.removeChild(element);
                        return;
                    }
                    const portsSelectedAndAllowed = [];
                    // TODO: Find which of the numbers correspond to publishers (don't want to subscribe to services)
                    for (const portNr of portsSelected) {
                        const portType = getPortType(portNr, yukon_state);
                        if (portType === "pub") {
                            portsSelectedAndAllowed.push(portNr);
                        } else {
                            console.log("Not subscribing to port " + portNr + " because it's not a publisher");
                            console.log("portType: " + portType);
                        }
                    }
                    if (portsSelectedAndAllowed.length > 1) {
                        button.innerHTML = "Subscribe to " + portsSelectedAndAllowed.join(", ") + " separately";
                    } else {
                        element.parentElement.removeChild(element);
                        return;
                    }
                },
                click: async (e, elementOpenedOn) => {
                    const portsSelectedAndAllowed = [];
                    // TODO: Find which of the numbers correspond to publishers (don't want to subscribe to services)
                    for (const portNr of yukon_state.monitor2selections) {
                        const portType = getPortType(portNr, yukon_state);
                        if (portType === "pub") {
                            portsSelectedAndAllowed.push(portNr);
                        } else {
                            console.log("Not subscribing to port " + portNr + " because it's not a publisher");
                            console.log("portType: " + portType);
                        }
                    }

                    for (const portNr of portsSelectedAndAllowed) {
                        yukon_state.subscriptions_being_set_up.push({ subject_id: portNr });
                    }
                }
            }
        },
    ]
    const monitor2_vertical_line_context_menu = new ContextMenu({
        target: ".line_collider,.horizontal_line_collider",
        mode: "dark",
        menuItems: [
            {
                content: "Add subscriber",
                events: {
                    adjust: async (contextMenuContext, element, button) => {
                        const portType = contextMenuContext.elementOpenedOn.getAttribute("data-port-type");
                        if (portType !== "pub" && portType !== "sub") {
                            element.parentElement.removeChild(element);
                        }
                        button.innerHTML = "Subscribe to " + contextMenuContext.elementOpenedOn.getAttribute("data-port");
                    },
                    click: async (e, elementOpenedOn) => {
                        yukon_state.subscriptions_being_set_up.push({ subject_id: parseInt(elementOpenedOn.getAttribute("data-port")) });
                        yukon_state.monitor2shouldScrollWhenNewSubscribeFrame = true;
                    }
                }
            },
            {
                content: "Add publisher",
                events: {
                    adjust: async (contextMenuContext, element, button) => {
                        const portType = contextMenuContext.elementOpenedOn.getAttribute("data-port-type");
                        if (portType !== "pub" && portType !== "sub") {
                            element.parentElement.removeChild(element);
                        }
                        button.innerHTML = "Publish to " + contextMenuContext.elementOpenedOn.getAttribute("data-port");
                    },
                    click: async (e, elementOpenedOn) => {
                        const portNr = parseInt(elementOpenedOn.getAttribute("data-port"));
                        const datatypes = await getDatatypesForPort(portNr, "pub", yukon_state);
                        const response = await yukon_state.zubax_apij.make_simple_publisher_with_datatype_and_port_id(datatypes[0], portNr);
                        const portType = elementOpenedOn.getAttribute("data-port-type"); // sub or pub or cln or srv
                        if (response && response.success) {
                            // yukon_state.publishers.push({ id: response.id });
                            console.log("Added a publisher with ID " + response.id);
                        }
                    }
                }
            },
            {
                content: "Remove all subscribers",
                events: {
                    adjust: async (contextMenuContext, element, button) => {
                        const portType = contextMenuContext.elementOpenedOn.getAttribute("data-port-type");
                        if (portType !== "pub") {
                            element.parentElement.removeChild(element);
                        }
                        button.innerHTML = "Remove all subscribers of " + contextMenuContext.elementOpenedOn.getAttribute("data-port");
                    },
                    click: async (e, elementOpenedOn) => {
                        const portType = elementOpenedOn.getAttribute("data-port-type");
                        const portNr = parseInt(elementOpenedOn.getAttribute("data-port"));

                    }
                }
            },
            subscriber_menu_items[0],
            subscriber_menu_items[1],
        ],
    });
    monitor2_vertical_line_context_menu.init();
    const monitor2_general_context_menu = new ContextMenu({
        target: ".monitor2-parent",
        mode: "dark",
        menuItems: [
            subscriber_menu_items[0],
            subscriber_menu_items[1],
            {
                content: "Add a publisher",
                events: {
                    click: async (e, elementOpenedOn) => {
                        const response = await yukon_state.zubax_apij.make_simple_publisher();
                        if (response && response.success) {
                            // yukon_state.publishers.push({ id: response.id });
                            console.log("Added a publisher with ID " + response.id);
                        }
                        // yukon_state.publishers.push({ id: guid() });
                    }
                }
            },
            {
                content: "Add a subscriber",
                events: {
                    click: async (e, elementOpenedOn) => {
                        yukon_state.subscriptions_being_set_up.push({ subject_id: 0 });
                        yukon_state.monitor2shouldScrollWhenNewSubscribeFrame = true;
                    }
                }
            },
        ],
    });
    monitor2_general_context_menu.init();
    // For .port_number_label
    const monitor2_port_number_label_context_menu = new ContextMenu({
        target: ".port_number_label",
        mode: "dark",
        menuItems: [
            {
                content: "Disable",
                events: {
                    "click": async (e, elementOpenedOn) => {
                        elementOpenedOn.value = 65535;
                        if ("createEvent" in document) {
                            var evt = document.createEvent("HTMLEvents");
                            evt.initEvent("change", false, true);
                            elementOpenedOn.dispatchEvent(evt);
                        }
                        else
                        elementOpenedOn.fireEvent("onchange");
                    }
                }
            }
        ]
    });
    monitor2_port_number_label_context_menu.init();
    const node_context_menu = new ContextMenu({
        target: ".node.disappeared",
        mode: "dark",
        menuItems: [
            {
                content: "Remove node from monitor",
                events: {
                    click: async (e, elementOpenedOn) => {
                        const node_id = elementOpenedOn.getAttribute("data-node-id");
                        const response = await yukon_state.zubax_apij.remove_avatar(node_id);
                        if(response && response.success) {
                            addLocalMessage("Node " + node_id + " was removed from the monitor.", undefined)
                        } else {
                            addLocalMessage("Node " + node_id + " was not removed from the monitor.", 30)
                        }
                    }
                }
            }
        ]
    });
    node_context_menu.init()
}
