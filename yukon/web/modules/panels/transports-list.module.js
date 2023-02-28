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
            transport_interface.classList.add("card");
            // Make a h5 element for the interface name
            if (_interface.is_udp) {
                // Create a div with card-body for udp_iface, udp_mtu, node_id, the card-title should be the udp_iface, udp_mtu, node_id for each
                const udp_iface = document.createElement('div');
                udp_iface.classList.add("card-body");
                const udp_iface_title = document.createElement('h5');
                udp_iface_title.classList.add("card-title");
                udp_iface_title.innerText = "UDP Interface";
                udp_iface.appendChild(udp_iface_title);
                const udp_iface_text = document.createElement('p');
                udp_iface_text.classList.add("card-text");
                udp_iface_text.innerText = _interface.udp_iface;
                udp_iface.appendChild(udp_iface_text);
                const udp_mtu = document.createElement('div');
                udp_mtu.classList.add("card-body");
                const udp_mtu_title = document.createElement('h5');
                udp_mtu_title.classList.add("card-title");
                udp_mtu_title.innerText = "UDP MTU";
                udp_mtu.appendChild(udp_mtu_title);
                const udp_mtu_text = document.createElement('p');
                udp_mtu_text.classList.add("card-text");
                udp_mtu_text.innerText = _interface.udp_mtu;
                udp_mtu.appendChild(udp_mtu_text);
                transport_interface.appendChild(udp_iface);
                transport_interface.appendChild(udp_mtu);
            } else {
                const can_iface = document.createElement('div');
                can_iface.classList.add("card-body");
                const can_iface_title = document.createElement('h5');
                can_iface_title.classList.add("card-title");
                can_iface_title.innerText = "CAN Interface";
                can_iface.appendChild(can_iface_title);
                const can_iface_text = document.createElement('p');
                can_iface_text.classList.add("card-text");
                can_iface_text.innerText = _interface.iface;
                can_iface.appendChild(can_iface_text);
                const can_mtu = document.createElement('div');
                can_mtu.classList.add("card-body");
                const can_mtu_title = document.createElement('h5');
                can_mtu_title.classList.add("card-title");
                can_mtu_title.innerText = "CAN MTU";
                can_mtu.appendChild(can_mtu_title);
                const can_mtu_text = document.createElement('p');
                can_mtu_text.classList.add("card-text");
                can_mtu_text.innerText = _interface.mtu;
                can_mtu.appendChild(can_mtu_text);
                const can_arbitration_rate = document.createElement('div');
                can_arbitration_rate.classList.add("card-body");
                const can_arbitration_rate_title = document.createElement('h5');
                can_arbitration_rate_title.classList.add("card-title");
                can_arbitration_rate_title.innerText = "CAN Arbitration Rate";
                can_arbitration_rate.appendChild(can_arbitration_rate_title);
                const can_arbitration_rate_text = document.createElement('p');
                can_arbitration_rate_text.classList.add("card-text");
                can_arbitration_rate_text.innerText = _interface.rate_arb;
                can_arbitration_rate.appendChild(can_arbitration_rate_text);
                const can_data_rate = document.createElement('div');
                can_data_rate.classList.add("card-body");
                const can_data_rate_title = document.createElement('h5');
                can_data_rate_title.classList.add("card-title");
                can_data_rate_title.innerText = "CAN Data Rate";
                can_data_rate.appendChild(can_data_rate_title);
                const can_data_rate_text = document.createElement('p');
                can_data_rate_text.classList.add("card-text");
                can_data_rate_text.innerText = _interface.rate_data;
                can_data_rate.appendChild(can_data_rate_text);
                transport_interface.appendChild(can_iface);
                transport_interface.appendChild(can_mtu);
                transport_interface.appendChild(can_arbitration_rate);
                transport_interface.appendChild(can_data_rate);

            }
            // Add a div and title, and body for the node_id
            const node_id = document.createElement('div');
            node_id.classList.add("card-body");
            const node_id_title = document.createElement('h5');
            node_id_title.classList.add("card-title");
            node_id_title.innerText = "Node ID";
            node_id.appendChild(node_id_title);
            const node_id_text = document.createElement('p');
            node_id_text.classList.add("card-text");
            node_id_text.innerText = _interface.node_id;
            node_id.appendChild(node_id_text);
            transport_interface.appendChild(node_id);
            if (!_interface.is_udp) {
                // Add a button for copying the can_iface to the clipboard
                const copy_button = document.createElement('button');
                copy_button.classList.add("btn", "btn-sm", "btn-primary");
                copy_button.innerText = "Copy interface for Yakut";
                copy_button.addEventListener('click', function () {
                    let text = "";
                    text += "export UAVCAN__CAN__IFACE=" + _interface.iface + "\n";
                    text += "export UAVCAN__CAN__MTU=" + _interface.mtu + "\n";
                    text += `export UAVCAN__CAN__BITRATE="${_interface.rate_arb} ${_interface.rate_data}"\n`;
                    text += "export UAVCAN__NODE__ID=$(yakut accommodate)\n";
                    navigator.clipboard.writeText(text);
                });
                transport_interface.appendChild(copy_button);
            }
            transport_interface.classList.add('transport_interface');
            // Add a button to remove the interface
            const remove_button = document.createElement('button');
            remove_button.classList.add("btn");
            remove_button.classList.add("btn-sm");
            remove_button.classList.add('btn-danger');
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