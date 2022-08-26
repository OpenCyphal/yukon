// document load event
(function () {
    var lastMessageIndex = -1;
    const transport_types = Object.freeze({
        MANUAL: "MANUAL",
//        TCP: 'TCP',
        SLCAN: "SLCAN",
        SOCKETCAN: "SOCKETCAN",
//        CANDUMP: "CANDUMP",
//        PICAN: "PICAN",
    })
    var currentSelectedTransport = transport_types.TCP;
    function doStuffWhenReady() {
        console.log("zubax_api_ready in add_transport.js");
        cbShowTransportCombobox = document.getElementById('cbShowTransportCombobox');
        var messagesList = document.querySelector("#messages-list");
        let messagesListWidth = messagesList.getBoundingClientRect().width
        function displayOneMessage(message) {
            var messageItem = document.createElement("textarea");
            messageItem.classList.add("message-item");
            messageItem.classList.add("is-active");
            messageItem.setAttribute("spellcheck", "false");
            messageItem.innerHTML = message;
            messagesList.appendChild(messageItem);
            autosize(messageItem);
        }
        function fillSelectionWithSlcan() {
            zubax_api.get_slcan_ports().then(function (ports) {
                ports = JSON.parse(ports);
                console.log(ports);
                var sTransport = document.getElementById("sTransport");
                sTransport.innerHTML = "";
                if (ports.length == 0) {
                    var option = document.createElement("option");
                    option.value = "";
                    option.text = "No available ports";
                    sTransport.add(option);
                }
                // Fill sTransport with ports
                for (var i = 0; i < ports.length; i++) {
                    var option = document.createElement("option");
                    option.value = ports[i].device;
                    option.text = ports[i].device + " (" + ports[i].description + ")";
                    sTransport.add(option);
                }
            });
        }
        function fillSelectionWithSocketcan() {
            zubax_api.get_socketcan_ports().then(function (ports) {
                ports = JSON.parse(ports);
                console.log(ports);
                var sTransport = document.getElementById("sTransport");
                sTransport.innerHTML = "";
                // Fill sTransport with ports
                if (ports.length == 0) {
                    var option = document.createElement("option");
                    option.value = "";
                    option.text = "No available ports";
                    sTransport.add(option);
                }
                for (var i = 0; i < ports.length; i++) {
                    var option = document.createElement("option");
                    option.value = ports[i];
                    option.text = ports[i];
                    sTransport.add(option);
                }
            });
        }
        function fetchAndDisplayMessages() {
            zubax_api.get_messages(lastMessageIndex + 1).then(function (messages) {
                var messagesObject = JSON.parse(messages);
                for (message of messagesObject) {
                    displayOneMessage(message.message);
                    // For the last message
                    if (message == messagesObject[messagesObject.length - 1]) {
                        lastMessageIndex = message.index;
                    }
                }
            });
        }
        function addLocalMessage(message) {
            zubax_api.add_local_message(message)
        }
        function doTheTabSwitching() {
            const h1TransportType = document.querySelector("h1#TransportType");
            const iTransport = document.getElementById("iTransport");
            const sTransport = document.getElementById("sTransport");
            const iMtu = document.getElementById("iMtu");
            const divMtu = document.getElementById("divMtu");
            const divArbRate = document.getElementById("divArbRate");
            const divDataRate = document.getElementById("divDataRate");
            const divNodeId = document.getElementById("divNodeId");
            const divCandump = document.getElementById("divCandump");
            const divTypeTransport = document.getElementById("divTypeTransport");
            const divSelectTransport = document.getElementById("divSelectTransport");
            divTypeTransport.style.display = "block";
            divSelectTransport.style.display = "block";
            divMtu.style.display = "block";
            divArbRate.style.display = "block";
            divDataRate.style.display = "block";
            divNodeId.style.display = "block";
            divCandump.style.display = "none";
            const iArbRate = document.getElementById("iArbRate");
            const iDataRate = document.getElementById("iDataRate");
            const iNodeId = document.getElementById("iNodeId");

            // Making sure that no inputs are no longer colored red if there was an error with these inputs
            iTransport.classList.remove("is-danger");
            sTransport.classList.remove("is-danger");
            iMtu.classList.remove("is-danger");
            iArbRate.classList.remove("is-danger");
            iDataRate.classList.remove("is-danger");
            iNodeId.classList.remove("is-danger");

            switch (currentSelectedTransport) {
                case transport_types.MANUAL:
                    h1TransportType.innerHTML = "A connection string";
                    divSelectTransport.style.display = "none";
                    break;
                case transport_types.TCP:
                    h1TransportType.innerHTML = "TCP";
                    divTypeTransport.style.display = "none";
                    divSelectTransport.style.display = "none";
                    divMtu.style.display = "none";
                    divArbRate.style.display = "none";
                    divDataRate.style.display = "none";
                    break;
                case transport_types.SLCAN:
                    h1TransportType.innerHTML = "SLCAN";
                    divTypeTransport.style.display = "none";
                    iMtu.value = 8;
                    fillSelectionWithSlcan();
                    break;
                case transport_types.SOCKETCAN:
                    h1TransportType.innerHTML = "SocketCAN";
                    divTypeTransport.style.display = "none";
                    divArbRate.style.display = "none";
                    divDataRate.style.display = "none";
                    iMtu.value = 64;
                    fillSelectionWithSocketcan();
                    break;
                case transport_types.CANDUMP:
                    h1TransportType.innerHTML = "CANDUMP";
                    divTypeTransport.style.display = "none";
                    divSelectTransport.style.display = "none";
                    divMtu.style.display = "none";
                    divArbRate.style.display = "none";
                    divDataRate.style.display = "none";
                    divNodeId.style.display = "none";
                    divCandump.style.display = "block";
                    break;
                case transport_types.PICAN:
                    h1TransportType.innerHTML = "PICAN";
                    divTypeTransport.style.display = "none";
                    break;
            }
        }
        setInterval(function () {
            let currentWidth = messagesList.getBoundingClientRect().width
            if (currentWidth != messagesListWidth) {
                messagesListWidth = currentWidth
                for (child of messagesList.children) {
                    autosize.update(child);
                }
            }
        }, 500);
        function InitTabStuff() {
            const maybe_tabs = document.getElementById('maybe-tabs');
            const slider = document.querySelector('#maybe-tabs > .tab-slider');
            // Iterate over each property of transport_types and add it to maybe-tabs
            for (var property in transport_types) {
                if (transport_types.hasOwnProperty(property)) {
                    var new_tab = document.createElement('input');
                    new_tab.setAttribute('type', 'radio');
                    new_tab.setAttribute('name', 'transport');
                    new_tab.setAttribute('id', "transport" + property);
                    new_tab.setAttribute('value', property);
                    // A label for new_tab
                    var new_label = document.createElement('label');
                    new_label.setAttribute('for', "transport" + property);
                    new_label.innerHTML = property;
                    maybe_tabs.insertBefore(new_tab, slider);
                    maybe_tabs.insertBefore(new_label, slider);
                }
            }


            const maybe_tabs_children_count = maybe_tabs.children.length;
            const maybe_tabs_bounding_rect = maybe_tabs.getBoundingClientRect();
            const slider_width = maybe_tabs_bounding_rect.width / maybe_tabs_children_count;
            const width_of_first_child = maybe_tabs.children[0].getBoundingClientRect().width;
            slider.style.width = width_of_first_child + 'px';
            slider.style.height = maybe_tabs_bounding_rect.height + 'px';
            slider.style.left = 0;
            // Keep a counter of the current child index
            var current_child_index = 0;
            const inputChildren = [].slice.call(maybe_tabs.children).filter((child) => child.tagName == "INPUT");
            const labelChildren = [].slice.call(maybe_tabs.children).filter((child) => child.tagName == "LABEL");
            slider.style.left = labelChildren[0].getBoundingClientRect().left - maybe_tabs.getBoundingClientRect().left - 12 + 'px';
            slider.style.width = labelChildren[0].getBoundingClientRect().width + 24 + 'px';
            labelChildren[0].style.backgroundColor = 'transparent';
            for (const child of inputChildren) {
                let thisChildIndex = current_child_index;
                // Connect each radio box to checked event
                child.addEventListener('change', function () {
                    if (this.checked) {
                        console.log("This child index: " + thisChildIndex);
                        child.style.backgroundColor = 'transparent';
                        const targetLeftValue = labelChildren[thisChildIndex].getBoundingClientRect().left - maybe_tabs.getBoundingClientRect().left - 12;
                        const targetWidth = labelChildren[thisChildIndex].getBoundingClientRect().width + 24

                        var t = new Tween(slider.style, 'left', Tween.regularEaseOut, parseInt(slider.style.left), targetLeftValue, 0.3, 'px');
                        t.start();
                        var t2 = new Tween(slider.style, 'width', Tween.regularEaseOut, parseInt(slider.style.width), targetWidth, 0.3, 'px');
                        t2.start();

                        currentSelectedTransport = child.value;
                        doTheTabSwitching();
                        for (const child2 of labelChildren) {
                            if (child2 != labelChildren[thisChildIndex]) {
                                child2.style.backgroundColor = '#e0e0e0';
                                child2.style.color = '#000';
                            } else {
                                child2.style.backgroundColor = 'transparent';
                                child2.style.color = '#fff';
                            }
                        }
                    }
                });
                current_child_index++;
            }
            currentSelectedTransport = transport_types.MANUAL;
            doTheTabSwitching();
        }
        function verifyInputs() {
            const iTransport = document.getElementById("iTransport");
            const sTransport = document.getElementById("sTransport");
            const iMtu = document.getElementById("iMtu");
            const iArbRate = document.getElementById("iArbRate");
            const iDataRate = document.getElementById("iDataRate");
            const iNodeId = document.getElementById("iNodeId");
            // Remove is-danger from every input
            iTransport.classList.remove("is-danger");
            sTransport.classList.remove("is-danger");
            iMtu.classList.remove("is-danger");
            iArbRate.classList.remove("is-danger");
            iDataRate.classList.remove("is-danger");
            iNodeId.classList.remove("is-danger");
            let isFormCorrect = true;
            if (currentSelectedTransport == transport_types.MANUAL) {
                if (iTransport.value == "" || !iTransport.value.includes(":")) {
                    iTransport.classList.add("is-danger");
                    displayOneMessage("Transport shouldn't be empty and should be in the format <slcan|socketcan>:<port>");
                    isFormCorrect = false;
                }
                const transportMustContain = ["socketcan", "slcan"];
                let containsAtLeastOne = false;
                for (transportType of transportMustContain) {
                    if (iTransport.value.includes(transportType)) {
                        containsAtLeastOne = true;
                    }
                }
                if (!containsAtLeastOne) {
                    displayOneMessage("Transport type should be either slcan or socketcan");
                    iTransport.classList.add("is-danger");
                    isFormCorrect = false;
                }
            } else if (sTransport.value == "") {
                sTransport.classList.add("is-danger");
                displayOneMessage("Transport shouldn't be empty");
                isFormCorrect = false;
            }

            if (iMtu.value == "" || isNaN(iMtu.value)) {
                displayOneMessage("MTU should be a number");
                iMtu.classList.add("is-danger");
                isFormCorrect = false;
            }
            if (iArbRate.value == "" || isNaN(iArbRate.value)) {
                displayOneMessage("Arbitration rate should be a number");
                iArbRate.classList.add("is-danger");
                isFormCorrect = false;
            }
            if (iDataRate.value == "" || isNaN(iDataRate.value)) {
                displayOneMessage("Data rate should be a number");
                iDataRate.classList.add("is-danger");
                isFormCorrect = false;
            }
            if (iNodeId.value == "" || isNaN(iNodeId.value) || iNodeId.value < 0 || iNodeId.value > 128) {
                displayOneMessage("Node ID should be a number between 0 and 128");
                iNodeId.classList.add("is-danger");
                isFormCorrect = false;
            }
            return isFormCorrect;
        }

        btnStart.addEventListener('click', function () {
            if (!verifyInputs()) { return; }
            let port = "";
            const cbToggleSlcanSocketcan = document.getElementById('cbToggleSlcanSocketcan');
            const useSocketCan = currentSelectedTransport == transport_types.SOCKETCAN;
            if (currentSelectedTransport != transport_types.MANUAL) {
                if (useSocketCan) {
                    port_type = "socketcan";
                } else {
                    port_type = "slcan";
                }
                port = port_type + ":" + sTransport.value;
            } else {
                port = iTransport.value;
            }
            const data_rate = document.getElementById('iDataRate').value;
            const arb_rate = document.getElementById('iArbRate').value;
            const node_id = document.getElementById('iNodeId').value;
            const mtu = document.getElementById('iMtu').value;

            addLocalMessage("Going to attach now!")
            zubax_api.attach_transport(port, data_rate, arb_rate, node_id, mtu).then(
                function (result) {
                    var resultObject = JSON.parse(result);
                    if (resultObject.success) {
                        addLocalMessage("Now attached: " + resultObject.message);
                        //zubax_api.hide_transport_window();
                        zubax_api.open_monitor_window();
                    } else {
                        console.error("Error: " + resultObject.message);
                        addLocalMessage("Error: " + resultObject.message);
                    }
                }
            );
        });
        // Toggle between showing divTypeTransport and divSelectTransport by clicking on the respective buttons
        const btnTypeTransport = document.getElementById('btnTypeTransport');
        const btnSelectTransport = document.getElementById('btnSelectTransport');
        const divTypeTransport = document.getElementById('divTypeTransport');
        const divSelectTransport = document.getElementById('divSelectTransport');
        const btnOpenCandumpFile = document.getElementById('btnOpenCandumpFile');
        btnOpenCandumpFile.addEventListener('click', function () {
            zubax_api.open_file_dialog();
        });
        setInterval(fetchAndDisplayMessages, 1000);


        InitTabStuff();

        divTypeTransport.style.display = "block";
        divSelectTransport.style.display = "none";

        btnAddTransport.addEventListener('click', function () {
            zubax_api.open_add_transport_window();
        });
    }
    if (zubax_api_ready) {
        doStuffWhenReady();
    } else {
        window.addEventListener('zubax_api_ready', function () {
            doStuffWhenReady();
        });
    }
})();
