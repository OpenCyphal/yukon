export async function setUpRegisterUpdateLogComponent(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const registerUpdateLog = document.querySelector("#register-update-log");

    async function fetchRegisterUpdateLog() {
        const items = await yukon_state.zubax_apiws.get_register_update_log_items();
        registerUpdateLog.innerHTML = "";
        // Add a header for the table
        const header = document.createElement('tr');
        const header_name = document.createElement('th');
        header_name.innerHTML = "Name";
        header.appendChild(header_name);
        const header_timestamp = document.createElement('th');
        header_timestamp.innerHTML = "Previous value";
        header.appendChild(header_timestamp);
        const new_value_header = document.createElement('th');
        new_value_header.innerHTML = "New value";
        header.appendChild(new_value_header);
        const request_sent_header = document.createElement('th');
        request_sent_header.innerHTML = "Request sent";
        header.appendChild(request_sent_header);
        const response_received_header = document.createElement('th');
        response_received_header.innerHTML = "Response received";
        header.appendChild(response_received_header);
        const request_success = document.createElement('th');
        request_success.innerHTML = "Ok?";
        header.appendChild(request_success);
        registerUpdateLog.appendChild(header);
        for (const item of items) {
            // Create fields for new_value, previous_value, request_sent_time, request_received_time
            const row = registerUpdateLog.insertRow();
            const name_value_cell = row.insertCell(0);
            const previous_value_cell = row.insertCell(1);
            const new_value_cell = row.insertCell(2);
            const request_sent_time_cell = row.insertCell(3);
            const response_received_time_cell = row.insertCell(4);
            const success = row.insertCell(5);
            name_value_cell.innerHTML = item.register_name;
            if (item.response) {
                new_value_cell.innerHTML = item.response.value;
            } else {
                new_value_cell.innerHTML = item.previous_value;
            }
            previous_value_cell.innerHTML = item.previous_value;
            request_sent_time_cell.innerHTML = item.request_sent_time;
            response_received_time_cell.innerHTML = item.response_received_time;
            if (item.success) {
                success.innerHTML = "✓";
            } else {
                success.innerHTML = "✗";
            }
        }
    }

    setInterval(fetchRegisterUpdateLog, 1000);
}