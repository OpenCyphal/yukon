export function setUpTransportsListComponent(yukon_state) {
        let lastTransportsListHash = 0;
        async function syncList() {
            const transportsList = document.querySelector('#transports_list');
            const received_transport_interfaces_object = await yukon_state.zubax_apij.get_connected_transport_interfaces();
            if (received_transport_interfaces_object.hash == lastTransportsListHash) {
                return;
            }
            transportsList.innerHTML = "";
            lastTransportsListHash = received_transport_interfaces_object.hash;
            const received_transport_interfaces = received_transport_interfaces_object.interfaces;
            for (const _interface of received_transport_interfaces) {
                const transport_interface = document.createElement('div');
                transport_interface.classList.add('transport_interface');
                // Add a div for the name of the interface
                const name = document.createElement('P');
                name.innerHTML = JSON.stringify(_interface);
                transport_interface.appendChild(name);
                // Add a button to remove the interface
                const remove_button = document.createElement('button');
                remove_button.innerHTML = "Remove";
                remove_button.addEventListener('click', async () => {
                    await zubax_api.detach_transport(_interface.hash);
                    await syncList();
                });
                transport_interface.appendChild(remove_button);
                transportsList.appendChild(transport_interface);
            }
        }
        setInterval(syncList, 1143);
    }