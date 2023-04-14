import { JsonParseHelper } from "../utilities.module.js";

export function initTransports(container, yukon_state) {
    const containerElem = container.getElement()[0];
    const transports = Object.freeze({
        UDP: {
            UDP: "UDP",
        },
        CAN: {
            MANUAL: "MANUAL",
            SLCAN: "SLCAN",
            SOCKETCAN: "SOCKETCAN",
            // CANDUMP: "CANDUMP",
            // "P-CAN": "P-CAN"
        },
    });
    var currentSelectedTransportType = [transports.CAN, transports.CAN.MANUAL];
    const cbShowTransportCombobox = containerElem.querySelector('#cbShowTransportCombobox');

    function resetAllHashes() {
        yukon_state.last_slcan_list_hash = null;
        yukon_state.last_socketcan_list_hash = null;
    }

    function detectDeviceFromProductId(productId) {
        if (productId == 24600) {
            return "Dronecode probe"
        } else if (productId == 24775) {
            return "Zubax"
        }
        return null;

    }

    async function fillSelectionWithSlcan() {
        const results = await zubax_apij.get_slcan_ports();
        const ports = results.ports;
        const hash = results.hash;
        if (hash !== yukon_state.last_slcan_list_hash) {
            resetAllHashes();
            yukon_state.last_slcan_list_hash = hash;
            const sTransport = containerElem.querySelector("#sTransport");
            sTransport.innerHTML = "";
            if (ports.length == 0) {
                const option = document.createElement("option");
                option.value = "";
                option.text = "No available ports";
                sTransport.add(option);
            }
            // Fill sTransport with ports
            for (const port of ports) {
                const option = document.createElement("option");
                option.value = port.device;
                if (port.already_used) {
                    option.disabled = true;
                }
                let device_name = port.usb_description;
                // If the operating system is windows, then display detectDeviceFromProductId instead
                if (window.navigator.platform == "Win32") {
                    device_name = detectDeviceFromProductId(port.product_id);
                }
                if (device_name == null) {
                    device_name = port.description;
                }
                option.title = JSON.stringify(port);
                option.text = port.device + " — " + device_name;
                sTransport.add(option);
            }
        }
    }

    async function fillSelectionWithSocketcan() {
        const results = await zubax_apij.get_socketcan_ports();
        const ports = results.ports;
        const hash = results.hash;
        if (hash !== yukon_state.last_socketcan_list_hash) {
            resetAllHashes();
            yukon_state.last_socketcan_list_hash = hash;
            const sTransport = containerElem.querySelector("#sTransport");
            sTransport.innerHTML = "";
            if (ports.length == 0) {
                const option = document.createElement("option");
                option.value = "";
                option.text = "No available ports";
                sTransport.add(option);
            }
            // Fill sTransport with ports
            for (const port of ports) {
                const option = document.createElement("option");
                if (port.already_used) {
                    option.disabled = true;
                }
                option.value = port.name;
                option.text = port.name;
                sTransport.add(option);
            }
        }
    }

    function addLocalMessage(message, severity) {
        zubax_api.add_local_message(message, severity)
    }
    function showElement(element) {
        element.style.removeProperty("display");
    }
    function hideElement(element) {
        element.style.display = "none";
    }
    async function doTheTabSwitching() {
        const h1TransportType = containerElem.querySelector("#TransportType");
        const pythoncanlink = containerElem.querySelector("#pythoncanlink");
        const iTransport = containerElem.querySelector("#iTransport");
        const sTransport = containerElem.querySelector("#sTransport");
        const iMtu = containerElem.querySelector("#iMtu");
        const divMtu = containerElem.querySelector("#divMtu");
        const divArbRate = containerElem.querySelector("#divArbRate");
        const divDataRate = containerElem.querySelector("#divDataRate");
        const divNodeId = containerElem.querySelector("#divNodeId");
        const divCandump = containerElem.querySelector("#divCandump");
        const divTypeTransport = containerElem.querySelector("#divTypeTransport");
        const divSelectTransport = containerElem.querySelector("#divSelectTransport");
        const divUdpIface = containerElem.querySelector("#divUdpIface");
        const divServiceTransferMultiplier = containerElem.querySelector("#divServiceTransferMultiplier");
        const divUdpMtu = containerElem.querySelector("#divUdpMtu");
        const UDPLinuxWarning = containerElem.querySelector("#UDPLinuxWarning");
        showElement(divTypeTransport);
        showElement(divSelectTransport)
        showElement(divMtu);
        showElement(divArbRate);
        showElement(divDataRate);
        showElement(divNodeId);
        showElement(divServiceTransferMultiplier);
        hideElement(divUdpIface);
        hideElement(divCandump);
        hideElement(divUdpMtu);
        hideElement(UDPLinuxWarning);
        hideElement(pythoncanlink);
        const iArbRate = containerElem.querySelector("#iArbRate");
        const iDataRate = containerElem.querySelector("#iDataRate");
        const iNodeId = containerElem.querySelector("#iNodeId");

        // Making sure that no inputs are no longer colored red if there was an error with these inputs
        iTransport.classList.remove("is-danger");
        sTransport.classList.remove("is-danger");
        iMtu.classList.remove("is-danger");
        iArbRate.classList.remove("is-danger");
        iDataRate.classList.remove("is-danger");
        iNodeId.classList.remove("is-danger");

        switch (currentSelectedTransportType[1]) {
            case transports.CAN.MANUAL:
                h1TransportType.innerHTML = "Connection string";
                divSelectTransport.style.display = "none";
                showElement(pythoncanlink);
                break;
            case transports.UDP.UDP:
                h1TransportType.innerHTML = "UDP";
                hideElement(divTypeTransport);
                hideElement(divSelectTransport);
                hideElement(divArbRate);
                hideElement(divDataRate);
                showElement(divUdpIface);
                showElement(divServiceTransferMultiplier);
                showElement(divUdpMtu);
                hideElement(divMtu);
                showElement(UDPLinuxWarning);
                break;
            case transports.CAN.SLCAN: {
                h1TransportType.innerHTML = "SLCAN";
                hideElement(divTypeTransport);
                iMtu.value = 8;
                await fillSelectionWithSlcan();
                let thisInterval;
                thisInterval = setInterval(async function () {
                    if (currentSelectedTransportType[1] != transports.CAN.SLCAN) {
                        clearInterval(thisInterval);
                        return
                    }
                    await fillSelectionWithSlcan();
                }, 1000);
            }
                break;
            case transports.CAN.SOCKETCAN: {
                h1TransportType.innerHTML = "SocketCAN";
                hideElement(divTypeTransport);
                hideElement(divArbRate);
                hideElement(divDataRate);
                iMtu.value = 64;
                await fillSelectionWithSocketcan();
                let thisInterval;
                thisInterval = setInterval(async function () {
                    if (currentSelectedTransportType[1] != transports.CAN.SOCKETCAN) {
                        clearInterval(thisInterval);
                        return
                    }
                    await fillSelectionWithSocketcan();
                }, 1000);
            }
                break;
            case transports.CAN.CANDUMP:
                h1TransportType.innerHTML = "CANDUMP";
                hideElement(divTypeTransport);
                hideElement(divSelectTransport);
                hideElement(divArbRate);
                hideElement(divDataRate);
                hideElement(divMtu);
                hideElement(divNodeId);
                showElement(divCandump);
                break;
            case transports.CAN["P-CAN"]:
                h1TransportType.innerHTML = "P-CAN";
                hideElement(divTypeTransport);
                break;
        }
    }

    // Disable all inputs contained in these divs that are not visible
    function disableAllInputs() {
        const divTypeTransport = containerElem.querySelector("#divTypeTransport");
        const divSelectTransport = containerElem.querySelector("#divSelectTransport");
        const divMtu = containerElem.querySelector("#divMtu");
        const divArbRate = containerElem.querySelector("#divArbRate");
        const divDataRate = containerElem.querySelector("#divDataRate");
        const divNodeId = containerElem.querySelector("#divNodeId");
        const divCandump = containerElem.querySelector("#divCandump");
        const divUdpIface = containerElem.querySelector("#divUdpIface");
        const divServiceTransferMultiplier = containerElem.querySelector("#divServiceTransferMultiplier");
        const divUdpMtu = containerElem.querySelector("#divUdpMtu");
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

    function setCurrentTransport(tabRow, isTopMost) {
        if (isTopMost) {
            currentSelectedTransportType = [tabRow.parentTabName, tabRow.tabNames[tabRow.selectedTabIndex]];
        } else {
            currentSelectedTransportType = [tabRow.parentTabName, tabRow.tabNames[tabRow.selectedTabIndex]];
        }
    }

    function moveSlider(targetTab, tabRow) {
        const slider = tabRow.slider;
        const targetWidth = targetTab.getBoundingClientRect().width
        if (targetWidth == 0) {
            console.log("Target width is 0, not moving slider");
            return false;
        }
        return true;
    }

    async function moveTab(tabRow, index, isTopMost, wasClicked) {
        if (tabRow.selectedTabIndex == index) {
            return;
        }
        const labelChildren = tabRow.getLabelChildren();
        tabRow.selectedTabIndex = index;
        setCurrentTransport(tabRow, index, isTopMost);
        const child = labelChildren[index];
        if (!moveSlider(child, tabRow)) {
            // If it fails then it's because it is not visible and will be retried until succeeds
            if (!wasClicked) {
                const interval_id = setInterval(() => {
                    if (tabRow.isDestroyed || moveSlider(child, tabRow)) {
                        clearInterval(interval_id);
                    }
                }, 500);
            }
        }
        if (isTopMost) {
            const selectedTabName = Object.keys(transports)[index];
            addChildTabRow(tabRow, selectedTabName, true, false);
        }
        child.classList.add("selected-tab");
        for (const child2 of labelChildren) {
            if (child2 != child) {
                child2.classList.remove("selected-tab");
            }
        }
        await doTheTabSwitching();
    }

    const maybe_tabs = containerElem.querySelector('#maybe-tabs');

    function addChildTabRow(ParentTabRow, selectedTabName, wasClicked) {
        ParentTabRow.removeCurrentChildTabRow();
        const arrayOfTabNames = Object.values(transports[selectedTabName]);
        const tabRow = addOneTabRow(arrayOfTabNames, false, wasClicked);
        tabRow.parent = ParentTabRow;
        tabRow.parentTabName = selectedTabName;
        ParentTabRow.childTabRow = tabRow;
        maybe_tabs.appendChild(tabRow.div);
    }

    function addOneTabRow(tabNameArray, isTopMost, wasClicked) {
        let tabRow = {};
        tabRow.div = document.createElement("div");
        tabRow.div.classList.add("tab-row");
        tabRow.isDestroyed = false;
        tabRow.selectedTabIndex = -1;
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
                tabRow.childTabRow.isDestroyed = true;
                tabRow.childTabRow = null;
            }
        };
        tabRow.div.appendChild(tabRow.slider);
        let current_child_index = 0;
        for (const tabName of tabNameArray) {
            const thisChildIndex = current_child_index + 0;
            const new_radio = document.createElement('input');
            new_radio.setAttribute('type', 'radio');
            new_radio.setAttribute('name', 'transport');
            new_radio.setAttribute('id', "transport" + tabName);
            new_radio.setAttribute('value', tabName);
            // A label for new_radio
            const new_label = document.createElement('label');
            new_label.setAttribute('for', "transport" + tabName);
            new_label.innerHTML = tabName;
            new_label.classList.add('tab_label');
            new_label.setAttribute("value", tabName);
            tabRow.div.appendChild(new_radio);
            tabRow.div.appendChild(new_label);
            new_radio.addEventListener('change', async function () {
                if (this.checked) {
                    moveTab(tabRow, thisChildIndex, isTopMost, true);
                }
            });
            current_child_index++;
        }
        const interval_id = setInterval(async () => {
            // See if the tabRow div has width
            if (tabRow.div.getBoundingClientRect().width > 0) {
                moveTab(tabRow, 0, isTopMost, false);
                clearInterval(interval_id);
            }
        }, 30);
        return tabRow;
    }

    function InitTabStuff() {
        const firstMainRow = addOneTabRow(Object.keys(transports), true, false)
        maybe_tabs.appendChild(firstMainRow.div);
        for (const selectedTabName in transports) {
            if (currentSelectedTransportType[0] == transports[selectedTabName]) {
                addChildTabRow(firstMainRow, selectedTabName, false);
            }
        }
        // Call moveSlider(firstMainRow.getLabelChildren()[0], firstMainRow) every 0.5 seconds until it returns true
        // This is because when the tab is not shown, the width of the label is 0, so it doesn't move the slider
        // const interval_id = setInterval(() => {
        //     if (moveSlider(firstMainRow.getLabelChildren()[0], firstMainRow)) {
        //         clearInterval(interval_id);
        //     }
        // }, 500);
    }

    function displayErrorMessage(message) {
        const feedbackMessageDiv = containerElem.querySelector(".feedback-message");
        feedbackMessageDiv.style.display = "block";
        feedbackMessageDiv.innerHTML = message;
    }

    function verifyInputs() {
        const iTransport = containerElem.querySelector("#iTransport");
        const sTransport = containerElem.querySelector("#sTransport");
        const iMtu = containerElem.querySelector("#iMtu");
        const iArbRate = containerElem.querySelector("#iArbRate");
        const iDataRate = containerElem.querySelector("#iDataRate");
        const iNodeId = containerElem.querySelector("#iNodeId");
        const iUdpMtu = containerElem.querySelector("#iUdpMtu");
        const iUdpIface = containerElem.querySelector("#iUdpIface");
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
                displayErrorMessage("Transport shouldn't be empty and should be in the format <transport_type>:<port>");
                isFormCorrect = false;
            }
        } else if (currentSelectedTransportType[1] == transports.UDP.UDP) {
            // Check if value of iUdpMtu is a number in range 1200 to 9000 inclusive and value of iUdpIface is a string separated by whitespace
            if (isNaN(parseInt(iUdpMtu.value)) || parseInt(iUdpMtu.value) < 1200 || parseInt(iUdpMtu.value) > 9000) {
                iUdpMtu.classList.add("is-danger");
                displayErrorMessage("MTU should be a number in range 1200 to 9000");
                isFormCorrect = false;
            }
            if (iUdpIface.value == "") {
                iUdpIface.classList.add("is-danger");
                isFormCorrect = false;
            }
        } else if (sTransport.value == "") {
            sTransport.classList.add("is-danger");
            displayErrorMessage("Transport shouldn't be empty");
            isFormCorrect = false;
        } else {
            // This is a temporary CAN specific section
            if (iMtu.value == "" || isNaN(iMtu.value)) {
                displayErrorMessage("MTU should be a number");
                iMtu.classList.add("is-danger");
                isFormCorrect = false;
            }
            if (iArbRate.value == "" || isNaN(iArbRate.value)) {
                displayErrorMessage("Arbitration rate should be a number");
                iArbRate.classList.add("is-danger");
                isFormCorrect = false;
            }
            if (iDataRate.value == "" || isNaN(iDataRate.value)) {
                displayErrorMessage("Data rate should be a number");
                iDataRate.classList.add("is-danger");
                isFormCorrect = false;
            }
            if (iNodeId.value == "" || isNaN(iNodeId.value) || iNodeId.value < 0 || iNodeId.value > 128) {
                displayErrorMessage("Node ID should be a number between 0 and 128");
                iNodeId.classList.add("is-danger");
                isFormCorrect = false;
            }
        }


        return isFormCorrect;
    }

    const btnStart = containerElem.querySelector("#btnStart");
    const startTransportFunction = async function (event) {
        event.preventDefault();
        if (!verifyInputs()) {
            console.error("Invalid input values.");
            return;
        }
        const feedbackMessageDiv = containerElem.querySelector(".feedback-message");
        feedbackMessageDiv.style.display = "none";
        feedbackMessageDiv.innerHTML = "";
        let result = null;
        let usedInterfaceName = "";
        if (currentSelectedTransportType[1] == transports.UDP.UDP) {
            console.log("UDP");
            const udp_iface = containerElem.querySelector('#iUdpIface').value;
            const udp_mtu = containerElem.querySelector('#iUdpMtu').value;
            const node_id = containerElem.querySelector('#iNodeId').value;
            result = await zubax_apij.attach_udp_transport(udp_iface, udp_mtu, node_id);
        } else {
            console.log("CAN");
            let port = "";
            const useSocketCan = currentSelectedTransportType[1] == transports.CAN.SOCKETCAN;
            if (currentSelectedTransportType[1] != transports.CAN.MANUAL) {
                let port_type = "";
                if (useSocketCan) {
                    port_type = "socketcan";
                } else {
                    port_type = "slcan";
                }
                port = port_type + ":" + sTransport.value;
                usedInterfaceName = sTransport.options[sTransport.selectedIndex].text;
            } else {
                port = iTransport.value;
            }
            const data_rate = containerElem.querySelector('#iDataRate').value;
            const arb_rate = containerElem.querySelector('#iArbRate').value;
            const node_id = containerElem.querySelector('#iNodeId').value;
            const mtu = containerElem.querySelector('#iMtu').value;
            result = await zubax_apij.attach_transport(port, data_rate, arb_rate, node_id, mtu)
        }

        addLocalMessage("Going to try to attach.", 20)

        const resultObject = result;
        if (resultObject.is_success) {
            addLocalMessage("Now attached: " + resultObject.message, 20);
        } else {
            console.error("Error: " + resultObject.message);
            zubax_api.add_local_message(resultObject.message, 40);
            feedbackMessageDiv.style.display = "block";
            let messageToDisplay = resultObject.message;
            if(resultObject.message_short !== undefined) {
                messageToDisplay = resultObject.message_short;
            }
            feedbackMessageDiv.innerHTML = messageToDisplay;
            if (currentSelectedTransportType[0] === "CAN" && usedInterfaceName.includes("Zubax") && feedbackMessageDiv.innerHTML.includes("Permission denied")) {
                feedbackMessageDiv.innerHTML += "<p>With this error, make sure to use the <a target=\"_blank\" href=\"https://kb.zubax.com/pages/viewpage.action?pageId=2195511\">tutorial</a> to set up udev rules.</p>" +
                "<p>Or just copy and run these commands:</p><pre>" +
                `
echo 'SUBSYSTEMS=="usb", ATTRS{idVendor}=="1d50", ATTRS{idProduct}=="60c7", MODE="0666"' | sudo tee /etc/udev/rules.d/10-zubax.rules
echo 'SUBSYSTEMS=="usb", ATTRS{idVendor}=="1d50", ATTRS{idProduct}=="6018", MODE="0666"' | sudo tee -a /etc/udev/rules.d/10-zubax.rules
sudo udevadm control --reload
sudo usermod -a -G dialout $USER
                </pre>
                <p>Then you should log out and then log back in, or (better yet) just reboot.</p>
                <p>And then open Yukon and click Start transport again.</p>`;
            }
        }
    }
    const form = containerElem.querySelector("#transport-selection-form");
    form.addEventListener("submit", startTransportFunction);
    btnStart.addEventListener('click', startTransportFunction);
    const btnCopyToYakut = containerElem.querySelector("#btnCopyToYakut");
    let exportWord = "export";
    if (navigator.platform == "Win32") {
        exportWord = "set";
    }
    btnCopyToYakut.addEventListener('click', async function () {
        if (currentSelectedTransportType[1] == transports.UDP.UDP) {
            console.log("UDP");
            const udp_iface = containerElem.querySelector('#iUdpIface').value;
            const udp_mtu = containerElem.querySelector('#iUdpMtu').value;
            const node_id = containerElem.querySelector('#iNodeId').value;
            let text = "";
            text += exportWord + " UAVCAN__UDP__IFACE=" + udp_iface + "\n";
            text += exportWord + " UAVCAN__UDP__MTU=" + udp_mtu + "\n";
            text += exportWord + " UAVCAN__NODE__ID=$(yakut accommodate)\n";
            navigator.clipboard.writeText(text);
        } else {
            console.log("CAN");
            let port = "";
            const useSocketCan = currentSelectedTransportType[1] == transports.CAN.SOCKETCAN;
            if (currentSelectedTransportType[1] != transports.CAN.MANUAL) {
                let port_type = "";
                if (useSocketCan) {
                    port_type = "socketcan";
                } else {
                    port_type = "slcan";
                }
                port = port_type + ":" + sTransport.value;
            } else {
                port = iTransport.value;
            }
            const data_rate = containerElem.querySelector('#iDataRate').value;
            const arb_rate = containerElem.querySelector('#iArbRate').value;
            const node_id = containerElem.querySelector('#iNodeId').value;
            const mtu = containerElem.querySelector('#iMtu').value;
            let text = "";
            text += exportWord + " UAVCAN__CAN__IFACE=" + port + "\n";
            text += exportWord + " UAVCAN__CAN__MTU=" + mtu + "\n";
            text += exportWord + ` UAVCAN__CAN__BITRATE="${arb_rate} ${data_rate}"\n`;
            text += exportWord + " UAVCAN__NODE__ID=$(yakut accommodate)\n";
            navigator.clipboard.writeText(text);
        }
    });
    // Toggle between showing divTypeTransport and divSelectTransport by clicking on the respective buttons
    const divTypeTransport = containerElem.querySelector('#divTypeTransport');
    const divSelectTransport = containerElem.querySelector('#divSelectTransport');
    const btnOpenCandumpFile = containerElem.querySelector('#btnOpenCandumpFile');


    InitTabStuff();

    divTypeTransport.style.display = "block";
    divSelectTransport.style.display = "none";
}