var yukon_state = {
    "current_avatars": [],
    "selections": {
        selected_columns: {}, // Key is the node_id and value is true if selected
        selected_rows: {}, // Key is register_name and value is true if selected
        selected_registers: {}, // Key is array of nodeid and register name, value is true if selected
        selected_config: null,
        last_cell_selected: null,
    },
    "updateRegistersTableColorsAgainTimer": null,
    "recently_reread_registers": {},
    "available_configurations": {},
    "number_input_for_configuration": {}, // The key is the file_name and the value is the input element
    "simplified_configurations_flags": {}, // The key is the file_name and true is is simplified
    "zubax_api": null,
    "pressedKeys": {},
    // Key is subject_id concatenated with datatype, value is an object
    // The value object contains { messages: [], counter: 0}
    "subscriptions": {},

    "existingHashesSet": {
    },
    "last_slcan_list_hash": null,
    "last_socketcan_list_hash": null,
    "is_currently_restoring_default_layout": false,
    "settings": {
        "showAlotOfButtons": false,
        "showDoubleRowHeadersFromCount": 6,
        "shouldDoubleClickOpenModal": true,
        "shouldDoubleClickPromptToSetValue": true,
        "isTableCellTextSelectable": false,
        "simplifyRegisters": true,
        "preferSmallerFileSelectionDialog": false,
        "alwaysSaveAsNetoworkConfig": false,
        "yamlFlowLevel": -1,
    }
};