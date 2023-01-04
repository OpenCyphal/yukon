export function setUpDronecanComponent(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const cbDronecanEnabled = containerElement.querySelector('#cbDronecanEnabled');
    cbDronecanEnabled.addEventListener('change', (event) => {
        yukon_state.zubax_apij.set_dronecan_enabled(event.target.checked);
    });
}