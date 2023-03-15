
import { doCommandFeedbackResult } from "../utilities.module.js";
function createTable(inputArray) {
    let table = document.createElement("table");

    let tableHeader = [
        "Actions",
        "Node ID",
        "Name",
        "Health",
        "Mode",
        "Uptime (sec)",
        "Hardware Version",
        "Unique ID",
        "Software Version",
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
        if(!currentInput) {
            break;
        }
        let tableFields = [
            currentInput.node_id,
            currentInput.name,
            currentInput.health_text,
            currentInput.mode_text,
            currentInput.uptime_seconds,
        ];
        if(currentInput.hardware_version) {
            tableFields.push(...[
                currentInput.hardware_version.major + "." + currentInput.hardware_version.minor,
                "0x" + currentInput.hardware_version.unique_id,
            ]);
        }
        if(currentInput.software_version) {
            tableFields.push(...[
                currentInput.software_version.major + "." + currentInput.software_version.minor,
                currentInput.software_version.optional_field_flags,
                currentInput.software_version.vcs_commit,
                currentInput.software_version.image_crc,
            ]);
        }
        tableFields.push(...[
            currentInput.sub_mode,
            currentInput.vendor_specific_status_code,
        ]);
        let row = table.insertRow();
        let cell1 = row.insertCell();
        let btn = document.createElement("button");
        btn.innerHTML = "Update Firmware";
        btn.classList.add("btn_button", "btn", "btn-secondary", "btn-sm");
        if (currentInput.node_id == 126) {
            btn.disabled = true;
            btn.innerHTML = "Yukon's Node"
        } else {
            btn.addEventListener("click", async function () {
                // Add a button for firmware update
                let path = "";
                path = await window.electronAPI.openPath({
                    properties: ["openFile"],
                });
                if (path) {
                    const result = await yukon_state.zubax_apiws.dronecan_node_fw_update(currentInput.node_id, path);
                    doCommandFeedbackResult(result);
                }
            });
        }
        cell1.appendChild(btn);
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
    cbDronecanEnabled.parentElement.style.display = "none";
    cbDronecanFWUpdateEnabled.parentElement.style.display = "none";
    cbDronecanFWUpdateEnabled.addEventListener('change', (event) => {
        yukon_state.zubax_apiws.set_dronecan_fw_substitution_enabled(event.target.checked);
    });
    cbDronecanEnabled.addEventListener('change', (event) => {
        yukon_state.zubax_apiws.set_dronecan_enabled(event.target.checked);
    });
    const txtFirmwarePath = containerElement.querySelector('#txtFirmwarePath');
    txtFirmwarePath.parentElement.style.display = "none";
    const btnBrowse = containerElement.querySelector('#btnBrowse');
    btnBrowse.addEventListener("click", async function () {
        let path = "";
        path = await window.electronAPI.openPath({
            properties: ["openFile"],
        });
        if (path) {
            txtFirmwarePath.value = path;
            yukon_state.zubax_apiws.set_dronecan_fw_substitution_path(txtFirmwarePath.value);
        }
    });
    const btnSetFirmwarePath = containerElement.querySelector('#btnSetFirmwarePath');
    btnSetFirmwarePath.addEventListener('click', (event) => {
        yukon_state.zubax_apiws.set_dronecan_fw_substitution_path(txtFirmwarePath.value);
    });
    let previous_table = null;
    setInterval(async () => {
        const entries = await yukon_state.zubax_apiws.get_dronecan_node_entries()
        if (previous_table) {
            try {
                dronecanPanel.removeChild(previous_table);
            } catch (e) {
            }
        }
        previous_table = createTable(entries);
        dronecanPanel.appendChild(previous_table);
        // console.log(entries)
    }, 1000);
}