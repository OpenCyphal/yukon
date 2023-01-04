export async function setUpDronecanComponent(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const cbDronecanEnabled = containerElement.querySelector('#cbDronecanEnabled');
    cbDronecanEnabled.addEventListener('change', (event) => {
        yukon_state.zubax_apij.set_dronecan_fw_substitution_enabled(event.target.checked);
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
    setInterval(async () => {
        const entries = await yukon_state.zubax_apij.get_dronecan_node_entries()
        console.log(entries)
    }, 1000);
}