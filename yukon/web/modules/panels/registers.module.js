import { areThereAnyNewOrMissingHashes, updateLastHashes } from '../hash_checks.module.js';
import { applyConfiguration } from '../yaml.configurations.module.js';
import { make_select_column, make_select_row, make_select_cell } from './registers.selection.module.js';
import { update_register_value } from './registers.data.module.js';
import { getDictionaryValueFieldName } from '../utilities.module.js';
import { createGenericModal } from '../modal.module.js';
import {
    loadConfigurationFromOpenDialog
} from '../yaml.configurations.module.js';

export async function setUpRegistersComponent(container, immediateCreateTable, yukon_state) {
    const containerElement = container.getElement()[0];
    if (immediateCreateTable) {
        update_tables(true);
    }
    setInterval(async () => {
        update_tables();
    }, 893);
    let timer = null;
    const iRegistersFilter = document.getElementById('iRegistersFilter');
    iRegistersFilter.addEventListener("input", function () {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(function () {
            create_registers_table(iRegistersFilter.value, yukon_state)
        }, 500);
    });
    const btnImportRegistersConfig = document.getElementById('btnImportRegistersConfig');
    btnImportRegistersConfig.addEventListener('click', async function (click_event) {
        await loadConfigurationFromOpenDialog(false, yukon_state, click_event)
    });
    let posObject = { top: 0, left: 0, x: 0, y: 0 };
    const mouseDownHandler = function (e) {
        if (e.which !== 2) {
            return;
        }
        yukon_state.grabbing_in_registers_view = true;
        e.preventDefault();
        containerElement.style.userSelect = 'none';
        containerElement.style.cursor = 'grabbing';
        posObject = {
            // The current scroll
            left: containerElement.scrollLeft,
            top: containerElement.scrollTop,
            // Get the current mouse position
            x: e.clientX,
            y: e.clientY,
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };
    const mouseMoveHandler = function (e) {
        // How far the mouse has been moved
        const dx = e.clientX - posObject.x;
        const dy = e.clientY - posObject.y;

        // Scroll the element
        containerElement.scrollTop = posObject.top - dy;
        containerElement.scrollLeft = posObject.left - dx;
    };
    const mouseUpHandler = function (e) {
        if (e.which !== 2) {
            return;
        }
        e.preventDefault();
        yukon_state.grabbing_in_registers_view = false;
        containerElement.style.cursor = 'default';
        containerElement.style.removeProperty('user-select');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };
    document.addEventListener('mousedown', mouseDownHandler);
}

export function add_node_id_headers(table_header_row, yukon_state) {
    const avatars_copy = Array.from(yukon_state.current_avatars)
    avatars_copy.sort(compareAvatar);
    for (const avatar of avatars_copy) {
        let table_header_cell = document.createElement('th');
        table_header_cell.innerHTML = avatar.node_id;
        table_header_cell.title = avatar.name;
        table_header_cell.classList.add("node_id_header");
        let isSnappingThisElement = false;
        let isDraggingThisElement = false;
        let isMouseOverLoopRunning = false;
        document.addEventListener("mouseup", function (event) {
            yukon_state.is_cursor_dragging_column = false;
            isDraggingThisElement = false;
            if (isMouseOverLoopRunning) {
                isMouseOverLoopRunning = false;
            }
        });

        let initialWidth = table_header_cell.offsetWidth;
        table_header_cell.addEventListener('mousedown', function () {
            if (isSnappingThisElement) {
                initialWidth = table_header_cell.offsetWidth;
                yukon_state.edge_drag_start_position_x = yukon_state.mousePos.x;
                yukon_state.is_cursor_dragging_column = true;
                isDraggingThisElement = true;
            }
        });
        table_header_cell.addEventListener("mouseout", function () {
            if (!isDraggingThisElement) {
                isMouseOverLoopRunning = false;
                document.body.style.cursor = "default";
            }
        });
        let widthFromSettings = null;
        try {
            widthFromSettings = yukon_state.all_settings["UI"]["Registers"]["Column width (pixels)"]
        } catch (e) {
            widthFromSettings = 400;
        }
        table_header_cell.style.setProperty("width", widthFromSettings + "px", "important");
        table_header_cell.style.setProperty("min-width", widthFromSettings + "px", "important");
        table_header_cell.style.setProperty("max-width", widthFromSettings + "px", "important");
        // Add a listener to the hover event of table_header_cell
        table_header_cell.addEventListener('mouseover', function () {
            console.log("Mouse over node id header");
            isMouseOverLoopRunning = true;
            let myInterval = null;
            myInterval = setInterval(function () {
                const position = table_header_cell.getBoundingClientRect();
                const x = position.left;
                const y = position.top;
                const width = position.width;
                // console.log("x: " + x + " y: " + y + " width: " + width);
                // Calculate the position of the right edge of the element
                const right_edge = x + width;
                // console.log("right_edge: " + right_edge);
                const mouse_distance_from_right_edge = Math.abs(yukon_state.mousePos.x - right_edge);
                // console.log("mouse_distance_from_right_edge: " + mouse_distance_from_right_edge);
                const is_snapping = mouse_distance_from_right_edge <= yukon_state.settings.column_edge_snap_distance;
                if (is_snapping && isMouseOverLoopRunning) {
                    // console.log("Mouse snapping over edge of node_id_header " + avatar.node_id);
                    yukon_state.is_cursor_snapping_column = true;
                    isSnappingThisElement = true;
                    document.body.style.cursor = "ew-resize";
                } else {
                    if (!isDraggingThisElement) {
                        document.body.style.cursor = "default";
                        yukon_state.is_cursor_snapping_column = false;
                        isSnappingThisElement = false;
                    }
                }
                if (isDraggingThisElement) {
                    const distanceBetweenStartAndCurrent = yukon_state.mousePos.x - yukon_state.edge_drag_start_position_x;
                    // Get all td elements that have the node_id attribute set to avatar.node_id
                    const node_id_cells = document.querySelectorAll("td[node_id='" + avatar.node_id + "']");
                    const desiredWidth = (initialWidth + distanceBetweenStartAndCurrent);
                    for (const node_id_cell of node_id_cells) {
                        node_id_cell.style.setProperty("width", desiredWidth + "px", "important");
                        node_id_cell.style.setProperty("min-width", desiredWidth + "px", "important");
                        node_id_cell.style.setProperty("max-width", desiredWidth + "px", "important");
                    }
                    table_header_cell.style.setProperty("width", desiredWidth + "px", "important");
                    table_header_cell.style.setProperty("min-width", desiredWidth + "px", "important");
                    table_header_cell.style.setProperty("max-width", desiredWidth + "px", "important");
                    // table_header_cell.style.minWidth = desiredWidth + "px !important";
                }
                if (!isMouseOverLoopRunning && !isDraggingThisElement) {
                    clearInterval(myInterval);
                    document.body.style.cursor = "default";
                    yukon_state.is_cursor_snapping_column = false;
                    isSnappingThisElement = false;
                }
            }, 5);

            // yukon_state.mousePos
        });
        table_header_cell.setAttribute("data-node_id", avatar.node_id);
        table_header_row.appendChild(table_header_cell);
        if (yukon_state.settings.showAlotOfButtons) {
            // Add a button to table_header_cell for downloading the table column
            let btnExportConfig = document.createElement('button');
            btnExportConfig.innerHTML = 'Export';
            // Attach an event listener on the button click event
            btnExportConfig.addEventListener('mousedown', function (event) {
                event.stopPropagation();
                yukon_state.addLocalMessage("Exporting registers of " + avatar.node_id);
                //const result = window.chooseFileSystemEntries({ type: "save-file" });
                // Export all but only for this avatar, dried up code
                export_all_selected_registers(avatar.node_id);
            });
            table_header_cell.appendChild(btnExportConfig);
            let btnApplyImportedConfig = document.createElement('button');
            btnApplyImportedConfig.innerHTML = 'Apply imported config';
            btnApplyImportedConfig.addEventListener('mousedown', function (event) {
                event.stopPropagation();
                const current_config = yukon_state.available_configurations[selected_config];
                if (current_config) {
                    applyConfiguration(current_config, parseInt(avatar.node_id));
                } else {
                    console.log("No configuration selected");
                }
            });
            table_header_cell.appendChild(btnApplyImportedConfig);
            let btnSelectColumn = document.createElement('button');
            btnSelectColumn.innerHTML = 'Select column';
            btnSelectColumn.addEventListener('mousedown', make_select_column(avatar.node_id, null, yukon_state));
            table_header_cell.appendChild(btnSelectColumn);
        }

        table_header_cell.style.position = "relative";
        // Make a smaller invisible collider on top of table_header_cell, otherwise identical but 70% of the width
        const table_header_cell_collider = document.createElement('div');
        table_header_cell_collider.classList.add("table_header_cell_collider");
        table_header_cell_collider.style.width = "70%";
        table_header_cell_collider.style.height = "100%";
        table_header_cell_collider.style.minWidth = "92%";
        table_header_cell_collider.style.maxWidth = "92%";
        table_header_cell_collider.style.position = "absolute";
        table_header_cell_collider.style.top = "0";
        table_header_cell_collider.style.left = "12px";
        table_header_cell_collider.style.zIndex = "100";
        table_header_cell_collider.style.opacity = "0";
        // Right clicks should bubble below the collider

        table_header_cell.appendChild(table_header_cell_collider);

        table_header_cell_collider.onmousedown = make_select_column(avatar.node_id, null, yukon_state);
        table_header_cell_collider.onmouseover = make_select_column(avatar.node_id, true, yukon_state);
    }
}

export function make_empty_table_header_row_cell(table_header_row, yukon_state) {
    const empty_table_header_row_cell = document.createElement('th');
    if (yukon_state.settings.showAlotOfButtons) {
        // Add a button into the empty table header row cell
        const button = document.createElement('button');
        button.innerHTML = 'Apply sel. conf to all nodes';
        button.onclick = function () {
            if (yukon_state.selections.selected_config != null && yukon_state.available_configurations[yukon_state.selections.selected_config] != null) {
                applyConfiguration(yukon_state.available_configurations[yukon_state.selections.selected_config]);
            }
        }
        empty_table_header_row_cell.appendChild(button);
        const button2 = document.createElement('button');
        button2.innerHTML = 'Save all of configuration';
        button2.onclick = function () {
            export_all_selected_registers(null, true)
        }
        empty_table_header_row_cell.appendChild(button2);
    }
    table_header_row.appendChild(empty_table_header_row_cell);
}

export function addContentForRegisterName(register_name, filter_keyword_inclusive, registers_table_body, yukon_state) {
    if (filter_keyword_inclusive != "" && !register_name.includes(filter_keyword_inclusive)) {
        return;
    }
    let table_register_row = document.createElement('tr');
    registers_table_body.appendChild(table_register_row);

    function make_header_cell() {
        let table_header_cell = document.createElement('th');
        // REGISTER NAME HERE
        table_header_cell.innerHTML = register_name;
        table_header_cell.setAttribute("data-register_name", register_name);
        // Make table_header_cell have sticky position
        // Add class left-side-table-header
        table_header_cell.classList.add('left-side-table-header');
        table_header_cell.onmousedown = make_select_row(register_name, null, yukon_state);
        table_header_cell.onmouseover = make_select_row(register_name, true, yukon_state);
        if (yukon_state.settings.showAlotOfButtons) {
            let btnSelectRow = document.createElement('button');
            btnSelectRow.innerHTML = 'Select row';
            // Attach an event listener on the button click event
            btnSelectRow.onmousedown = make_select_row(register_name, null, yukon_state);
            table_header_cell.appendChild(btnSelectRow);
        }

        table_register_row.appendChild(table_header_cell);
    }

    make_header_cell();

    addContentForCells(register_name, table_register_row, yukon_state);
    // Add table cells for each avatar, containing the value of the register from register_name

    if (yukon_state.current_avatars.length >= yukon_state.settings.showDoubleRowHeadersFromCount) {
        make_header_cell();
    }
}

function compareAvatar(a, b) {
    if (a.node_id < b.node_id) {
        return -1;
    }
    if (a.node_id > b.node_id) {
        return 1;
    }
    return 0;
}

export function addContentForCells(register_name, table_register_row, yukon_state) {
    const avatars_copy = Array.from(yukon_state.current_avatars)
    avatars_copy.sort(compareAvatar);
    for (const avatar of avatars_copy) {
        // ALL THE REGISTER VALUES HERE
        const table_cell = document.createElement('td');
        table_register_row.appendChild(table_cell);
        // Add a table_cell class to table_cell
        table_cell.classList.add('no-padding');
        let widthFromSettings = null;
        try {
            widthFromSettings = yukon_state.all_settings["UI"]["Registers"]["Column width (pixels)"]
        } catch (e) {
            widthFromSettings = 400;
        }
        let doWrapFromSettings = null;
        try {
            doWrapFromSettings = yukon_state.all_settings["UI"]["Registers"]["Wrap cell text"]
        } catch (e) {
            doWrapFromSettings = false;
        }
        table_cell.style.setProperty("width", widthFromSettings + "px", "important");
        table_cell.style.setProperty("min-width", widthFromSettings + "px", "important");
        table_cell.style.setProperty("max-width", widthFromSettings + "px", "important");
        if (!doWrapFromSettings) {
            table_cell.style.setProperty("word-wrap", "normal", "important");
            table_cell.style.setProperty("white-space", "no-wrap", "important");
        } else {
            console.log("Wrap is enabled")
            table_cell.style.setProperty("word-wrap", "break-word", "important");
            table_cell.style.setProperty("white-space", "normal", "important");
        }
        // Set an attribute on td to store the register name
        table_cell.setAttribute('id', "cell_" + avatar.node_id + "_" + register_name);
        table_cell.setAttribute("register_name", register_name);
        table_cell.setAttribute("node_id", avatar.node_id);
        table_cell.title = "Register name: " + register_name;
        let register_value = avatar.registers_exploded_values[register_name];
        let register_value_simplified = avatar.registers_values[register_name];
        // Here we check if the register value is a byte string and then we convert it to hex
        let inputFieldReference = null;
        if (register_value == null) {
            table_cell.setAttribute("no_value", "true");
            table_cell.classList.add("no-value");
            // table_cell.style.backgroundColor = colors["no_value"];
            table_cell.title = "This register doesn't exist for this node";
            table_cell.innerHTML = "Not available";
            continue;
        }
        let type_string = getDictionaryValueFieldName(register_value);
        let value = register_value[type_string].value;
        let isOnlyValueInArray = false;
        // If value is an array
        if (Array.isArray(value)) {
            // If the length of the array value is 1 then display the value without brackets
            let text_input = document.createElement('div');
            inputFieldReference = text_input;
            if (value.length === 1) {
                isOnlyValueInArray = true;
                text_input.innerHTML = value[0];
            } else {
                text_input.innerHTML = JSON.stringify(value);
            }
            // When the text input is clicked
        } else if (type_string.includes("natural")) {
            // Create a number input field
            let number_input_field = document.createElement('div');
            inputFieldReference = number_input_field;
            if (register_value === 65535) {
                number_input_field.style.backgroundColor = '#ee0e0e';
            }
            inputFieldReference.innerHTML = value;
        } else if (type_string === "string") {
            let text_input = document.createElement('div');
            inputFieldReference = text_input;
            text_input.innerHTML = value;
            // When the text input is clicked
        } else {
            let text_input = document.createElement('div');
            inputFieldReference = text_input;
            text_input.disabled = 'true';
            text_input.style.backgroundColor = '#ee0e0e !important';
            text_input.innerHTML = "Unhandled: " + value;
        }
        table_cell.appendChild(inputFieldReference);

        function styleLabel(label) {
            label.style.height = '0px';
            label.style.position = 'absolute';
            label.style.bottom = '10px';
            label.style.fontSize = '8px';
            // label.style.color = '#000000';
            label.style.backgroundColor = 'transparent !important';
            label.style.padding = '0px';
            label.style.margin = '1px';
            label.style.border = '0px';
            label.style.borderRadius = '0px';
            label.style.display = 'inline';
            label.style.width = 'calc(100% - 4px)';
            label.style.fontFamily = 'monospace';
            label.style.whiteSpace = 'nowrap';
            label.style["pointer-events"] = 'none';
            // label.style.zIndex = '-1';
            // label.onmouseover = function(event) {
            //     event.stopPropagation();
            // }
        }

        // Create a new 10% height label in inputFieldReference and place it in the bottom right corner of the input field
        {
            // For displaying the value
            const label = document.createElement('label');
            styleLabel(label);
            label.style.textAlign = 'right';
            label.style.fontFamily = 'monospace';
            label.style.zIndex = '1';
            table_cell.style.position = 'relative';
            label.style.right = '2px';
            label.style.left = '2px';
            let dimensionality = "";
            if (Array.isArray(value)) {
                dimensionality = "[" + value.length + "]";
            }
            label.innerHTML = type_string + dimensionality;
            table_cell.insertBefore(label, inputFieldReference);
        }
        {
            // For displaying the mutability and persistence
            const explodedRegister = avatar.registers_exploded_values[register_name];
            const isMutable = explodedRegister["_meta_"].mutable;
            const isPersistent = explodedRegister["_meta_"].persistent;
            const label = document.createElement('label');
            styleLabel(label);
            label.style.textAlign = 'left';
            label.style.verticalAlign = 'bottom';
            label.style.right = '2px';
            label.style.left = '0px';
            label.style.zIndex = '1';
            table_cell.style.position = 'relative';
            label.innerHTML = "";
            if (isMutable) {
                label.innerHTML += "M";
                table_cell.setAttribute("mutable", "true");
            }
            if (isPersistent) {
                label.innerHTML += "P";
                table_cell.setAttribute("persistent", "true");
            }
            table_cell.insertBefore(label, inputFieldReference);
        }
        // Set the height of inputFieldReference to match the height of the table cell
        inputFieldReference.setAttribute("spellcheck", "false");
        inputFieldReference.setAttribute("register_name", register_name);
        inputFieldReference.setAttribute("node_id", avatar.node_id);
        inputFieldReference.classList.add('input');
        inputFieldReference.style["pointer-events"] = 'none'; // This is to make sure that the table_cell can receive events
        table_cell.classList.add('table-cell');
        table_cell.onmouseover = make_select_cell(avatar, register_name, true, yukon_state);
        // inputFieldReference.onmousedown = make_select_cell(avatar, register_name);
        let lastClick = null;
        table_cell.addEventListener('mousedown', function (event) {
            // Check if the mouse button was left click
            if (event.button !== 0) {
                return;
            }
            if (lastClick && new Date() - lastClick < 500 && yukon_state.settings.shouldDoubleClickPromptToSetValue) {
                // Make a dialog box to enter the new value
                showCellValue(avatar.node_id, register_name, yukon_state);
            } else {
                make_select_cell(avatar, register_name, null, yukon_state)(event)
            }
            lastClick = new Date();
        });
        // Create a text input element in the table cell
    }
}

export function create_registers_table(_filter_keyword_inclusive, yukon_state) {
    // Clear the table
    const iRegistersFilter = document.querySelector('#iRegistersFilter');
    const filter_keyword_inclusive = _filter_keyword_inclusive || iRegistersFilter.value;
    const registers_table = document.querySelector('#registers_table')
    registers_table.innerHTML = '';
    if (yukon_state.current_avatars.length == 0) {
        registers_table.innerHTML = "An empty table, no data, maybe connect a transport (interface) from the panel on the right side."
        return;
    }
    const registers_table_body = document.createElement('tbody');
    registers_table.appendChild(registers_table_body);
    const registers_table_header = document.createElement('thead');
    registers_table.appendChild(registers_table_header);
    // Add the table headers
    const table_header_row = document.createElement('tr');

    make_empty_table_header_row_cell(table_header_row, yukon_state);

    add_node_id_headers(table_header_row, yukon_state);
    if (yukon_state.current_avatars.length >= yukon_state.settings.showDoubleRowHeadersFromCount) {
        make_empty_table_header_row_cell(table_header_row, yukon_state);
    }
    registers_table_header.appendChild(table_header_row);
    // Combine all register names from avatar.registers into an array
    let register_names = [];
    yukon_state.current_avatars.forEach(function (avatar) {
        avatar.registers.forEach(function (register) {
            if (register != "" && !register_names.includes(register)) {
                register_names.push(register);
            }
        });
    });
    register_names.sort();

    register_names.forEach(function (register_name) {
        addContentForRegisterName(register_name, filter_keyword_inclusive, registers_table_body, yukon_state);
    });

    updateRegistersTableColors(yukon_state);
}

export function update_tables(override) {
    if (override || areThereAnyNewOrMissingHashes("registers_hash", yukon_state)) {
        create_registers_table(null, yukon_state);
    }
    updateLastHashes("registers_hash", yukon_state);
}

export function updateRegistersTableColors(yukon_state, repeat_times, repeat_delay) {
    if (repeat_times && repeat_times > 0) {
        setTimeout(() => updateRegistersTableColors(yukon_state, repeat_times - 1, repeat_delay), repeat_delay)
    }
    const registers_table = document.querySelector('#registers_table')
    // For all table cells in registers_table, if the cell has the attribute node_id set to node_id then color it red if the node is selected or white if not
    let needsRefresh = false;
    for (let i = 1; i < registers_table.rows.length; i++) {
        for (let j = 1; j < registers_table.rows[i].cells.length; j++) {
            const table_cell = registers_table.rows[i].cells[j]
            // Remove the string "register_" from the register_name
            const register_name = table_cell.getAttribute("register_name");
            if (register_name == null) {
                continue; // Must be the header cell at the end
            }
            const node_id = table_cell.getAttribute("node_id");
            const is_register_selected = yukon_state.selections.selected_registers[[node_id, register_name]];
            const is_column_selected = yukon_state.selections.selected_columns[node_id];
            const is_row_selected = yukon_state.selections.selected_rows[register_name];
            const temp_node = yukon_state.recently_reread_registers[node_id];
            const is_recently_reread = temp_node && temp_node[register_name] === true;
            if (!table_cell) {
                continue;
            }
            if (!register_name) {
                console.warn("No register name found in table cell " + i + "," + j)
                continue;
            }
            if (is_register_selected || is_column_selected || is_row_selected) {
                table_cell.classList.add("selected-cell");
            } else {
                // Remove the class "selected_element" from the input element if it has it
                table_cell.classList.remove("selected-cell");
            }
            if (is_register_selected) {
                table_cell.classList.add("selected-cell");
                if (is_recently_reread) {
                    table_cell.classList.add("recently_reread_register");
                    needsRefresh = true;
                }
            } else if (is_row_selected) {
                table_cell.style.backgroundColor = colors["selected_row"];
                if (is_column_selected) {
                    table_cell.classList.add("selected_row_and_column");
                }
            } else if (is_column_selected) {
                table_cell.classList.add("selected_column");
            } else {
                table_cell.classList.remove("selected-cell");
            }
            if (is_recently_reread) {
                table_cell.classList.add("recently_reread_register");
                needsRefresh = true;
            } else {
                table_cell.classList.remove("recently_reread_register");
            }
        }
    }
    if (needsRefresh) {
        if (yukon_state.updateRegistersTableColorsAgainTimer != null) {
            clearTimeout(yukon_state.updateRegistersTableColorsAgainTimer);
        }
        yukon_state.updateRegistersTableColorsAgainTimer = setTimeout(yukon_state.updateRegistersTableColors, 1000);
    }
}

export function showCellValue(node_id, register_name, yukon_state) {
    const avatar = yukon_state.current_avatars.find((avatar) => avatar.node_id == node_id);
    const explodedRegister = avatar.registers_exploded_values[register_name];
    const isMutable = explodedRegister["_meta_"].mutable;
    let enterListener = null;
    let disconnectEnterListener = function () {
        if (enterListener) {
            document.removeEventListener("keydown", enterListener);
            enterListener = null;
        }
    }
    let register_value = avatar.registers_exploded_values[register_name];
    let type_string = getDictionaryValueFieldName(register_value);
    let value = register_value[type_string].value;
    // If value is an array then convert it to a string
    if (Array.isArray(value)) {
        value = JSON.stringify(value);
    }
    // Create a modal with the value of the register
    let returnObject = createGenericModal(disconnectEnterListener);
    let modal = returnObject.modal;
    document.body.appendChild(modal);
    let modal_content = returnObject.modal_content;
    document.body.appendChild(modal);
    let modal_title = document.createElement("p");
    // Value of
    modal_title.innerHTML = register_name;
    modal_content.appendChild(modal_title);

    let modal_value = document.createElement("textarea");
    modal_value.value = value;
    modal_value.style.width = "100%";
    // Disable spellcheck
    modal_value.setAttribute("spellcheck", "false");

    modal_content.appendChild(modal_value);

    autosize(modal_value);
    let submit_modal = async function () {
        let new_value = modal_value.value;
        if (new_value != null) {
            // Update the value in the table
            // text_input.value = new_value;
            // Update the value in the server
            await update_register_value(register_name, new_value, avatar.node_id, yukon_state);
            // Run update_tables every second, do that only for the next 4 seconds
            let interval1 = setInterval(() => update_tables(true), 1000);
            setTimeout(() => clearInterval(interval1), 4000);
            document.body.removeChild(modal);
            disconnectEnterListener();
        } else {
            addLocalMessage("No value entered", 40);
        }
    }
    // Add a submit button
    let modal_submit = document.createElement("button");
    modal_submit.classList.add("btn");
    modal_submit.classList.add("btn-primary");
    modal_submit.style.marginTop = "4px";
    modal_submit.innerHTML = "Submit";
    if (!isMutable) {
        modal_submit.disabled = true;

    }
    modal_submit.onclick = submit_modal;
    // If enter is pressed the modal should submit too
    enterListener = function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            console.log("Enter pressed");
            submit_modal();
            disconnectEnterListener();
        }
    }
    document.addEventListener("keydown", enterListener);
    modal_content.appendChild(modal_submit);

    let modal_type = document.createElement("span");
    modal_type.innerHTML = type_string;
    // Position modal_type in the bottom right corner
    modal_type.style.position = "absolute";
    modal_type.style.bottom = "2px";
    modal_type.style.right = "2px";
    modal_content.appendChild(modal_type);
    setTimeout(() => modal_value.focus(), 100);
}

//  This is the modal that you see when you click Set values and have multiple registers selected
export function editSelectedCellValues(pairs, yukon_state) {
    let returnObject = createGenericModal();
    let modal = returnObject.modal;
    let modal_content = returnObject.modal_content;
    let modal_title = document.createElement("h2");
    modal_title.innerHTML = "Selected cell values";
    modal_content.appendChild(modal_title);
    let modal_value = document.createElement("textarea");
    modal_value.value = "";
    modal_value.style.width = "100%";

    modal_content.appendChild(modal_value);
    autosize(modal_value);
    let submit_modal = async function () {
        let new_value = modal_value.value;
        if (new_value != null) {
            // Update the value in the table
            // text_input.value = new_value;
            // Update the value in the server
            for (const node_id in pairs) {
                const registers = pairs[node_id];
                for (const register_name in registers) {
                    await update_register_value(register_name, new_value, node_id, yukon_state);
                }
            }
            // Run update_tables every second, do that only for the next 4 seconds
            let interval1 = setInterval(() => update_tables(true), 1000);
            setTimeout(() => clearInterval(interval1), 4000);
            document.body.removeChild(modal);
        } else {
            addLocalMessage("No value entered", 40);
        }
    }
    let datatypes = new Set();
    let register_count = 0;
    let uneditable_register_count = 0;
    // Create a list with all pairs, displaying the register name and the value and a submit button
    // When the submit button is clicked then the value is updated in the server and the list element is removed
    // Make a div that is at max 80% of the screen height and has a scrollbar
    let modal_list = document.createElement("div");
    modal_list.style.maxHeight = "80vh";
    modal_list.style.overflowY = "auto";
    modal_list.style.overflowX = "hidden";
    modal_list.style.marginBottom = "10px";
    modal_content.appendChild(modal_list);
    let array_size = null;
    for (const node_id in pairs) {
        const registers = pairs[node_id];
        for (const register_name in registers) {
            const avatar = yukon_state.current_avatars.find((avatar) => avatar.node_id.toString() === node_id.toString());
            const explodedRegister = avatar.registers_exploded_values[register_name];
            const isMutable = explodedRegister["_meta_"].mutable;
            const isPersistent = explodedRegister["_meta_"].persistent;
            register_count += 1;
            const register_value = registers[register_name];
            const datatype = getDictionaryValueFieldName(register_value);
            datatypes.add(datatype);
            const register_value_object = register_value[datatype].value;
            let pair_div = document.createElement("div");
            pair_div.classList.add("pair-div");
            pair_div.style.display = "flex";
            pair_div.style.alignItems = "center";
            let pair_name = document.createElement("span");
            pair_name.innerHTML = register_name;
            pair_name.style.marginRight = "10px";
            pair_div.appendChild(pair_name);
            let is_pair_incompatible = false;
            let current_array_size = 0;
            // Add a span for datatype
            // if register_value[datatype].value is an array
            if (Array.isArray(register_value_object)) {
                current_array_size = register_value[datatype].value.length;
            } else {
                current_array_size = 1;
            }
            if (array_size === null) {
                array_size = current_array_size;
            } else if (array_size === current_array_size) {
                // Do nothing
            } else {
                // Color the pair div red
                pair_div.classList.add("incompatible");
                is_pair_incompatible = true;
                uneditable_register_count += 1;
            }
            let pair_datatype = document.createElement("span");
            if (!is_pair_incompatible) {
                pair_datatype.innerHTML = datatype + "[" + current_array_size + "]";
            } else {
                pair_datatype.innerHTML = datatype + "[<b>" + current_array_size + "</b>]";
            }
            pair_datatype.style.marginRight = "10px";
            pair_div.appendChild(pair_datatype);
            let pair_value = document.createElement("input");
            pair_value.value = JSON.stringify(register_value_object);
            pair_value.style.width = "100%";
            pair_value.disabled = true;
            pair_div.appendChild(pair_value);
            // Add a discard button
            let discard_button = document.createElement("button");
            discard_button.innerHTML = "Discard";
            discard_button.style.marginLeft = "10px";
            discard_button.onclick = function () {
                pair_div.remove();
            }
            pair_div.appendChild(discard_button);
            let pair_submit = document.createElement("button");
            pair_submit.innerHTML = "Submit";
            if (!isMutable) {
                pair_submit.innerHTML = "Immutable";
                if (!is_pair_incompatible) {
                    uneditable_register_count += 1;
                    pair_submit.disabled = true;
                    pair_div.classList.add("incompatible");
                }

            }
            if (is_pair_incompatible) {
                pair_submit.disabled = true;
            }
            pair_submit.onclick = async function () {
                if (modal_value.value !== "") {
                    // Remove the list element
                    pair_div.parentNode.removeChild(pair_div);
                    // Update the value in the table
                    // text_input.value = new_value;
                    // Update the value in the server
                    await update_register_value(register_name, modal_value.value, node_id, yukon_state);
                    // Run update_tables every second, do that only for the next 4 seconds
                    let interval1 = setInterval(() => update_tables(true), 1000);
                    setTimeout(() => clearInterval(interval1), 4000);
                    if (register_count === 1) {
                        document.body.removeChild(modal);
                    } else {
                        register_count -= 1;
                        // Remove the submit button
                        pair_submit.parentNode.removeChild(pair_submit);
                    }
                } else {
                    addLocalMessage("No value entered", 40);
                }
            }
            pair_div.appendChild(pair_submit);
            modal_list.appendChild(pair_div);
        }
    }

    // Add a submit button
    let modal_submit = document.createElement("button");
    modal_submit.classList.add("btn");
    modal_submit.classList.add("btn-primary");
    modal_submit.innerHTML = "Submit compatible";
    if (uneditable_register_count === register_count) {
        modal_submit.disabled = true;
    }
    modal_submit.onclick = submit_modal;
    // If enter is pressed the modal should submit too
    let enterListener = null;
    let disconnectEnterListener = function () {
        document.removeEventListener("keydown", enterListener);
    }
    enterListener = function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            submit_modal();
            disconnectEnterListener();
        }
    }
    document.addEventListener("keydown", enterListener);
    modal_content.appendChild(modal_submit);
    // For each pair in pairs, add the datatype to a string variable called type_string

    let modal_type = document.createElement("div");
    const datatypes_string = Array.from(datatypes).join(", ");
    modal_type.innerHTML = "The value you are entering has to be castable to these types: " + datatypes_string + "<br>It also has to be of size: " + array_size;
    modal_content.appendChild(modal_type);
    document.body.appendChild(modal);
    setTimeout(() => modal_value.focus(), 100);
}

