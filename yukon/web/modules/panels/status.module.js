import { update_avatars_dto } from '../data.module.js'
import { secondsToString } from "../utilities.module.js";

export function setUpStatusComponent(yukon_state) {
    async function update_avatars_table() {
        var table_body = document.querySelector('#avatars_table tbody');
        if (!table_body) {
            return;
        }
        table_body.innerHTML = "";
        if (yukon_state.current_avatars.length == 0) {
            table_body.innerHTML = "No data, connect a transport from the panel on the right side."
            return;
        }
        // Take every avatar from yukon_state.current_avatars and make a row in the table
        for (let i = 0; i < yukon_state.current_avatars.length; i++) {
            const row = table_body.insertRow(i);
            const node_id = row.insertCell(0);
            node_id.innerHTML = yukon_state.current_avatars[i].node_id;
            const name = row.insertCell(1);
            name.innerHTML = yukon_state.current_avatars[i].name;
            // Insert cells for pub, sub, cln and srv
            const sub_cell = row.insertCell(2);
            const pub_cell = row.insertCell(3);
            const cln_cell = row.insertCell(4);
            const srv_cell = row.insertCell(5);
            const health_cell = row.insertCell(6);
            const software_version_cell = row.insertCell(7);
            const hardware_version_cell = row.insertCell(8);
            const uptime_cell = row.insertCell(9);
            if (!yukon_state.current_avatars[i].ports) {
                continue;
            }
            pub_cell.innerHTML = yukon_state.current_avatars[i].ports.pub.toString();
            if (yukon_state.current_avatars[i].ports.sub.length == 8192) {
                sub_cell.innerHTML = "All";
            } else {
                sub_cell.innerHTML = yukon_state.current_avatars[i].ports.sub.toString();
            }
            cln_cell.innerHTML = yukon_state.current_avatars[i].ports.cln.toString();
            srv_cell.innerHTML = yukon_state.current_avatars[i].ports.srv.toString();
            health_cell.innerHTML = yukon_state.current_avatars[i].last_heartbeat.health_text;
            software_version_cell.innerHTML = yukon_state.current_avatars[i].versions.software_version;
            hardware_version_cell.innerHTML = yukon_state.current_avatars[i].versions.hardware_version;
            uptime_cell.innerHTML = secondsToString(yukon_state.current_avatars[i].last_heartbeat.uptime);
        }
    }

    setInterval(update_avatars_table, 955);
}