function createTable(inputArray) {
    let table = document.createElement("table");

    let tableHeader = [
        "Node ID",
        "Name",
        "Health",
        "Mode",
        "Uptime (sec)",
        "Hardware Version Major",
        "Hardware Version Minor",
        "Hardware Version Unique ID hex",
        "Software Version Major",
        "Software Version Minor",
        "Software Version Optional Field Flags",
        "Software Version VCS Commit",
        "Software Version Image CRC",
        "Sub Mode",
        "Vendor Specific Status Code",
    ]
    // Create the header row
    let header = table.createTHead();
    let row = header.insertRow();
    for (let i = 0; i < tableHeader.length; i++) {
        let cell = row.insertCell();
        let text = document.createTextNode(tableHeader[i]);
        cell.appendChild(text);
    }
    // For every input in inputArray, create a row in the table
    for (let i = 0; i < inputArray.length; i++) {
        const currentInput = inputArray[i];
        let tableFields = [
            currentInput.node_id,
            currentInput.name,
            currentInput.health,
            currentInput.mode,
            currentInput.uptime_seconds,
            currentInput.hardware_version.major,
            currentInput.hardware_version.minor,
            currentInput.hardware_version.unique_id,
            currentInput.software_version.major,
            currentInput.software_version.minor,
            currentInput.software_version.optional_field_flags,
            currentInput.software_version.vcs_commit,
            currentInput.software_version.image_crc,
            currentInput.sub_mode,
            currentInput.vendor_specific_status_code,
        ];
        let row = table.insertRow();
        for (let j = 0; j < tableFields.length; j++) {
            let cell = row.insertCell();
            let text = document.createTextNode(tableFields[j]);
            cell.appendChild(text);
        }
        table.appendChild(row);
    }
    return table;
}
export async function setUpDronecanComponent(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const dronecanPanel = containerElement.querySelector("#dronecan-panel");
    const cbDronecanEnabled = containerElement.querySelector('#cbDronecanEnabled');
    const cbDronecanFWUpdateEnabled = containerElement.querySelector('#cbDronecanFWUpdateEnabled');
    cbDronecanFWUpdateEnabled.addEventListener('change', (event) => {
        yukon_state.zubax_apij.set_dronecan_fw_substitution_enabled(event.target.checked);
    });
    cbDronecanEnabled.addEventListener('change', (event) => {
        yukon_state.zubax_apij.set_dronecan_enabled(event.target.checked);
    });
    const txtFirmwarePath = containerElement.querySelector('#txtFirmwarePath');
    const btnBrowse = containerElement.querySelector('#btnBrowse');
    btnBrowse.addEventListener("click", async function () {
        let path = "";
        path = await window.electronAPI.openPath({
            properties: ["openFile"],
        });
        if (path) {
            txtFirmwarePath.value = path;
            yukon_state.zubax_apij.set_dronecan_fw_substitution_path(txtFirmwarePath.value);
        }
    });
    const btnSetFirmwarePath = containerElement.querySelector('#btnSetFirmwarePath');
    btnSetFirmwarePath.addEventListener('click', (event) => {
        yukon_state.zubax_apij.set_dronecan_fw_substitution_path(txtFirmwarePath.value);
    });
    let previous_table = null;
    setInterval(async () => {
        const entries = await yukon_state.zubax_apij.get_dronecan_node_entries()
        if (previous_table) {
            dronecanPanel.removeChild(previous_table);
        }
        previous_table = createTable(entries);
        dronecanPanel.appendChild(previous_table);
        // console.log(entries)
    }, 1000);
}