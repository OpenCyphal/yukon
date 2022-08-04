// Make a callback on the page load event
window.addEventListener('pywebviewready', function () {
    pywebview.api.get_ports_list().then(
        function (portsList) {
            var btnStart = document.getElementById('btnStart');
            var textOut = document.querySelector("#textOut");
            textOut.innerHTML = "Waiting to start...";
            var selector = document.querySelector("#sInterfaces");
            var d = JSON.parse(portsList);
            for (el of d) {
                var option = document.createElement("option");
                option.value = el;
                option.text = el;
                selector.appendChild(option);
            }
            // Get datarate and arbitration rate values from input fields
            var data_rate = document.getElementById('iDataRate').value;
            var arb_rate = document.getElementById('iArbRate').value;
            var node_id = document.getElementById('iNodeId').value;
            var mtu = document.getElementById('iMtu').value;
            btnStart.addEventListener('click', function () {
                var port = selector.value;
                pywebview.api.attach_transport(port, data_rate, arb_rate, node_id, mtu).then(
                    function (result) {
                        textOut.innerHTML = "Now attached: " + result
                    }
                );
            });
        });
    function update_messages() {
        pywebview.api.get_messages().then(
            function (messages) {
                // Clear messages-list
                var messagesList = document.querySelector("#messages-list");
                while (messagesList.children[0]) {
                    var firstChild = messagesList.children[0];
                    if (firstChild && firstChild.getAttribute("timestamp")) {
                        var timestamp = firstChild.getAttribute("timestamp");
                        // if timestamp is older than 10 seconds, remove it
                        if (new Date().getTime() - timestamp > 10000) {
                            messagesList.removeChild(firstChild);
                        }
                    }
                }
                // Add messages to messages-list
                var d = JSON.parse(messages);
                for (el of d) {
                    var li = document.createElement("li");
                    li.innerHTML = el;
                    // Set an attribute on the list element with current timestamp
                    li.setAttribute("timestamp", new Date().getTime());
                    messagesList.appendChild(li);
                }
            });
    }
    // Call update_messages every second
    setInterval(update_messages, 1000);
    var btnFetch = document.getElementById('btnFetch');
    btnFetch.addEventListener('click', function () {
        update_messages()
    });
})