export function initTransports(yukon_state) {
    var lastMessageIndex = -1;
    const transports = Object.freeze({
        UDP: {
            UDP: "UDP",
        },
        CAN: {
            MANUAL: "MANUAL",
            SLCAN: "SLCAN",
            SOCKETCAN: "SOCKETCAN",
            CANDUMP: "CANDUMP",
            PICAN: "P-CAN"
        },
    });
    var currentSelectedTransportType = [transports.CAN, transports.CAN.MANUAL];
    console.log("zubax_api_ready in add_transport.js");
    const cbShowTransportCombobox = document.getElementById('cbShowTransportCombobox');
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
            for (const message of messagesObject) {
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
        const divUdpIface = document.getElementById("divUdpIface");
        const divServiceTransferMultiplier = document.getElementById("divServiceTransferMultiplier");
        const divUdpMtu = document.getElementById("divUdpMtu");
        const UDPLinuxWarning = document.getElementById("UDPLinuxWarning");
        divTypeTransport.style.display = "block";
        divSelectTransport.style.display = "block";
        divMtu.style.display = "block";
        divArbRate.style.display = "block";
        divDataRate.style.display = "block";
        divNodeId.style.display = "block";
        divServiceTransferMultiplier.style.display = "none";
        divUdpIface.style.display = "none";
        divCandump.style.display = "none";
        divUdpMtu.style.display = "none";
        UDPLinuxWarning.style.display = "none";
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

        switch (currentSelectedTransportType[1]) {
            case transports.CAN.MANUAL:
                h1TransportType.innerHTML = "A connection string";
                divSelectTransport.style.display = "none";
                break;
            case transports.UDP.UDP:
                h1TransportType.innerHTML = "UDP";
                divTypeTransport.style.display = "none";
                divSelectTransport.style.display = "none";
                divArbRate.style.display = "none";
                divDataRate.style.display = "none";
                divUdpIface.style.display = "block";
                divServiceTransferMultiplier.style.display = "block";
                divUdpMtu.style.display = "block";
                divMtu.style.display = "none";
                UDPLinuxWarning.style.display = "block";
                break;
            case transports.CAN.SLCAN:
                h1TransportType.innerHTML = "SLCAN";
                divTypeTransport.style.display = "none";
                iMtu.value = 8;
                fillSelectionWithSlcan();
                break;
            case transports.CAN.SOCKETCAN:
                h1TransportType.innerHTML = "SocketCAN";
                divTypeTransport.style.display = "none";
                divArbRate.style.display = "none";
                divDataRate.style.display = "none";
                iMtu.value = 64;
                fillSelectionWithSocketcan();
                break;
            case transports.CAN.CANDUMP:
                h1TransportType.innerHTML = "CANDUMP";
                divTypeTransport.style.display = "none";
                divSelectTransport.style.display = "none";
                divMtu.style.display = "none";
                divArbRate.style.display = "none";
                divDataRate.style.display = "none";
                divNodeId.style.display = "none";
                divCandump.style.display = "block";
                break;
            case transports.CAN.PICAN:
                h1TransportType.innerHTML = "PICAN";
                divTypeTransport.style.display = "none";
                break;
        }
    }
    // Disable all inputs contained in these divs that are not visible
    function disableAllInputs() {
        const divTypeTransport = document.getElementById("divTypeTransport");
        const divSelectTransport = document.getElementById("divSelectTransport");
        const divMtu = document.getElementById("divMtu");
        const divArbRate = document.getElementById("divArbRate");
        const divDataRate = document.getElementById("divDataRate");
        const divNodeId = document.getElementById("divNodeId");
        const divCandump = document.getElementById("divCandump");
        const divUdpIface = document.getElementById("divUdpIface");
        const divServiceTransferMultiplier = document.getElementById("divServiceTransferMultiplier");
        const divUdpMtu = document.getElementById("divUdpMtu");
        const divs = [divTypeTransport, divSelectTransport, divMtu, divArbRate, divDataRate, divNodeId, divCandump, divUdpIface, divServiceTransferMultiplier, divUdpMtu];
        for (const div of divs) {
            if (div.style.display == "none") {
                for (input of div.getElementsByTagName("input")) {
                    input.disabled = true;
                }
                for (select of div.getElementsByTagName("select")) {
                    select.disabled = true;
                }
                for (button of div.getElementsByTagName("button")) {
                    button.disabled = true;
                }
            }
        }
    }
    disableAllInputs();
    setInterval(function () {
        let currentWidth = messagesList.getBoundingClientRect().width
        if (currentWidth != messagesListWidth) {
            messagesListWidth = currentWidth
            for (child of messagesList.children) {
                autosize.update(child);
            }
        }
    }, 500);
    function getCoords(elem) {
        let box = elem.getBoundingClientRect();

        return {
            top: box.top + window.pageYOffset,
            right: box.right + window.pageXOffset,
            bottom: box.bottom + window.pageYOffset,
            left: box.left + window.pageXOffset
        };
    }
    const getChildTopAndLeftPosition = (element) => [getCoords(element).top, getCoords(element).left];
    function setCurrentTransport(tabRow, index, isTopMost) {
        if (isTopMost) {
            currentSelectedTransportType = [tabRow, tabRow.tabNames[0]];
        }
        else {
            currentSelectedTransportType = [tabRow.parentTabName, tabRow.tabNames[index]];
        }
    }
    function moveTab(tabRow, index, isTopMost) {
        const labelChildren = tabRow.getLabelChildren();
        setCurrentTransport(tabRow, index, isTopMost);
        const child = labelChildren[index];
        const targetWidth = child.getBoundingClientRect().width
        var [topValue, leftValue] = getChildTopAndLeftPosition(child);
        var t = new Tween(tabRow.slider.style, 'left', Tween.regularEaseOut, parseInt(tabRow.slider.style.left), leftValue, 0.3, 'px');
        t.start();
        var t = new Tween(tabRow.slider.style, 'top', Tween.regularEaseOut, parseInt(tabRow.slider.style.top), topValue, 0.3, 'px');
        t.start();
        var t2 = new Tween(tabRow.slider.style, 'width', Tween.regularEaseOut, parseInt(tabRow.slider.style.width), targetWidth, 0.3, 'px');
        t2.start();
        setTimeout(function () {
            tabRow.slider.style.width = targetWidth + "px";
            tabRow.slider.style.left = leftValue + "px";
            tabRow.slider.style.top = topValue + "px";
        }, 0.3)
        tabRow.slider.style.height = tabRow.div.getBoundingClientRect().height + 4 + 'px';
        if (isTopMost) {
            const selectedTabName = Object.keys(transports)[index];
            addChildTabRow(tabRow, selectedTabName);
        }

        doTheTabSwitching();
        for (const child2 of labelChildren) {
            if (child2 != child) {
                child2.style.backgroundColor = '#e0e0e0';
                child2.style.color = '#000';
                child2.style["z-index"] = "0";
            } else {
                child2.style.backgroundColor = 'transparent';
                child2.style.color = '#fff';
                child2.style["z-index"] = "1";
            }
        }
    }
    const maybe_tabs = document.querySelector('#maybe-tabs');
    function addChildTabRow(ParentTabRow, selectedTabName) {
        ParentTabRow.removeCurrentChildTabRow();
        const arrayOfTabNames = Object.values(transports[selectedTabName]);
        const tabRow = addOneTabRow(arrayOfTabNames, false);
        tabRow.parent = ParentTabRow;
        tabRow.parentTabName = selectedTabName;
        ParentTabRow.childTabRow = tabRow;
        maybe_tabs.appendChild(tabRow.div);
    }
    function addOneTabRow(tabNameArray, isTopMost) {
        let tabRow = {};
        tabRow.div = document.createElement("div");
        tabRow.div.classList.add("tab-row");
        tabRow.tabNames = tabNameArray;
        tabRow.slider = document.createElement("span");
        tabRow.slider.classList.add("tab-slider");
        tabRow.getInputChildren = () => [].slice.call(tabRow.div.children).filter((child) => child.tagName == "INPUT");
        tabRow.getLabelChildren = () => [].slice.call(tabRow.div.children).filter((child) => child.tagName == "LABEL");
        tabRow.removeCurrentChildTabRow = () => {
            if (tabRow.childTabRow) {
                tabRow.childTabRow.div.remove();
                tabRow.childTabRow.slider.remove();
                tabRow.childTabRow.removeCurrentChildTabRow();
                tabRow.childTabRow = null;
            }
        };
        tabRow.div.appendChild(tabRow.slider);
        let current_child_index = 0;
        for (var tabName of tabNameArray) {
            let thisChildIndex = current_child_index + 0;
            var new_radio = document.createElement('input');
            new_radio.setAttribute('type', 'radio');
            new_radio.setAttribute('name', 'transport');
            new_radio.setAttribute('id', "transport" + tabName);
            new_radio.setAttribute('value', tabName);
            // A label for new_radio
            var new_label = document.createElement('label');
            new_label.setAttribute('for', "transport" + tabName);
            new_label.innerHTML = tabName;
            new_label.classList.add('tab_label');
            new_label.setAttribute("value", tabName);
            tabRow.div.appendChild(new_radio);
            tabRow.div.appendChild(new_label);
            new_radio.addEventListener('change', function () {
                if (this.checked) {
                    moveTab(tabRow, thisChildIndex, isTopMost);
                }
            });
            current_child_index++;
        }
        setTimeout(() => moveTab(tabRow, 0, isTopMost), 30);
        return tabRow;
    }
    function InitTabStuff() {


        const firstMainRow = addOneTabRow(Object.keys(transports), true)
        maybe_tabs.appendChild(firstMainRow.div);
        for (const child in transports) {
            if (currentSelectedTransportType[0] == transports[child]) {
                addChildTabRow(firstMainRow, child);
            }
        }

        // // Iterate over each property of transport_types and add it to maybe-tabs

        // I was here

        // for (row of [firstRow, secondRow]) {
        //     const width_of_first_child = getLabelChildren(row)[0].getBoundingClientRect().width;
        //     const [topPos, leftPos] = getChildTopAndLeftPosition(getLabelChildren(row)[0]);
        //     getLabelChildren(row)[0].style.backgroundColor = 'transparent';
        //     getLabelChildren(row)[0].style.backgroundColor = 'transparent';
        //     slider.style.width = width_of_first_child + 'px';
        //     slider.style.height = row.getBoundingClientRect().height + 'px';
        //     slider.style.top = topPos + 'px';
        //     slider.style.left = leftPos + 'px';
        //     slider.style["z-index"] = "0";
        //     moveTab(row, 0);
        // }
        // currentSelectedTransportType = transport_types.MANUAL;
        // doTheTabSwitching();
    }
    function verifyInputs() {
        const iTransport = document.getElementById("iTransport");
        const sTransport = document.getElementById("sTransport");
        const iMtu = document.getElementById("iMtu");
        const iArbRate = document.getElementById("iArbRate");
        const iDataRate = document.getElementById("iDataRate");
        const iNodeId = document.getElementById("iNodeId");
        const iUdpMtu = document.getElementById("iUdpMtu");
        const iUdpIface = document.getElementById("iUdpIface");
        // Remove is-danger from every input
        iTransport.classList.remove("is-danger");
        sTransport.classList.remove("is-danger");
        iMtu.classList.remove("is-danger");
        iArbRate.classList.remove("is-danger");
        iDataRate.classList.remove("is-danger");
        iNodeId.classList.remove("is-danger");
        let isFormCorrect = true;
        if (currentSelectedTransportType[1] == transports.CAN.MANUAL) {
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
        } else if (currentSelectedTransportType[1] == transports.UDP.UDP) {
            // Check if value of iUdpMtu is a number in range 1200 to 9000 inclusive and value of iUdpIface is a string separated by whitespace
            if (isNaN(parseInt(iUdpMtu.value)) || parseInt(iUdpMtu.value) < 1200 || parseInt(iUdpMtu.value) > 9000) {
                iUdpMtu.classList.add("is-danger");
                displayOneMessage("MTU should be a number in range 1200 to 9000");
                isFormCorrect = false;
            }
            if (iUdpIface.value == "") {
                iUdpIface.classList.add("is-danger");
                isFormCorrect = false;
            }
        } else if (sTransport.value == "") {
            sTransport.classList.add("is-danger");
            displayOneMessage("Transport shouldn't be empty");
            isFormCorrect = false;
        } else {
            // This is a temporary CAN specific section
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
        }


        return isFormCorrect;
    }

    btnStart.addEventListener('click', async function () {
        if (!verifyInputs()) { console.error("Invalid input values."); return; }

        if (currentSelectedTransportType[1] == transports.UDP.UDP) {
            console.log("UDP");
            const udp_iface = document.getElementById('iUdpIface').value;
            const udp_mtu = document.getElementById('iUdpMtu').value;
            const node_id = document.getElementById('iNodeId').value;
            result = await zubax_api.attach_udp_transport(udp_iface, udp_mtu, node_id);
        } else {
            console.log("CAN");
            let port = "";
            const useSocketCan = currentSelectedTransportType[1] == transports.CAN.SOCKETCAN;
            if (currentSelectedTransportType[1] != transports.CAN.MANUAL) {
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
            result = await zubax_api.attach_transport(port, data_rate, arb_rate, node_id, mtu)
        }



        addLocalMessage("Going to attach now!")

        var resultObject = JSON.parse(result);
        if (resultObject.success) {
            addLocalMessage("Now attached: " + resultObject.message);
            //zubax_api.hide_transport_window();
            zubax_api.open_monitor_window();
        } else {
            console.error("Error: " + resultObject.message);
            addLocalMessage("Error: " + resultObject.message);
        }
    });
    // Toggle between showing divTypeTransport and divSelectTransport by clicking on the respective buttons
    const divTypeTransport = document.getElementById('divTypeTransport');
    const divSelectTransport = document.getElementById('divSelectTransport');
    const btnOpenCandumpFile = document.getElementById('btnOpenCandumpFile');

    setInterval(fetchAndDisplayMessages, 1000);


    InitTabStuff();

    divTypeTransport.style.display = "block";
    divSelectTransport.style.display = "none";

    btnAddTransport.addEventListener('click', function () {
        zubax_api.open_add_transport_window();
    });
}