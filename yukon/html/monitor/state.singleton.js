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
    "zubax_api": null,
    "last_table_hashes": { set: new Set() }, // The same avatar hashes but for tables
    "last_hashes": { set: new Set() },
    "existingHashesSet": {
        "set": new Set(),
    },
    "settings": {
        "showAlotOfButtons": false,
        "showDoubleRowHeadersFromCount": 6,
        "shouldDoubleClickOpenModal": true,
        "isTableCellTextSelectable": false,
        "isSelectionModeComplicated": false
    }
};