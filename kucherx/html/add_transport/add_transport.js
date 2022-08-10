window.addEventListener('pywebviewready', function () {
    function addLocalMessage(message) {
        pywebview.api.add_local_message(message)
    }
    pywebview.api.get_ports_list().then(
        function (portsList) {
            var btnStart = document.getElementById('btnStart');
            addLocalMessage("Waiting to start...");
            var iTransport = document.getElementById('iTransport');
            var sTransport = document.getElementById("sTransport");
            var d = JSON.parse(portsList);
            if (d.length == 0) {
                addLocalMessage("No interfaces found");
            } else {
                for (el of d) {
                    if (el.length > 0) {
                        var option = document.createElement("option");
                        option.value = el;
                        option.text = el;
                        sTransport.appendChild(option);
                    }
                }
            }
        }
    );
    // Add a function to verify that valid values were entered into the field of the transport-selection-form
    function validateForm() {
        addLocalMessage("Validating form...");
        // save into variables all the values of the fields of the form
        var sTransportValue = document.getElementById("sTransport").value;
        var iTransportValue = document.getElementById("iTransport").value;
        var iMtuValue = document.getElementById("iMtu").value;
        var iArbRateValue = document.getElementById("iArbRate").value;
        var iDataRateValue = document.getElementById("iDataRate").value;
        var iNodeIdValue = document.getElementById("iNodeId").value;
        if (sTransportValue.length == 0) {
            if(iTransportValue == "") {
                addLocalMessage("Please select a transport");
                return false;
            } else if (!iTransportValue.includes(":")) {
                addLocalMessage("Please enter a valid transport");
                return false;
            }
        }
    }
    btnStart.addEventListener('click', function () {
//        if (!validateForm()) { return; }
        var port = "";
        if(!iTransport.value) {
            port = "slcan:" + sTransport.value.split(" ")[0];
        } else {
            port = iTransport.value;
        }
        var data_rate = document.getElementById('iDataRate').value;
        var arb_rate = document.getElementById('iArbRate').value;
        var node_id = document.getElementById('iNodeId').value;
        var mtu = document.getElementById('iMtu').value;
        pywebview.api.attach_transport(port, data_rate, arb_rate, node_id, mtu).then(
            function (result) {
                var resultObject = JSON.parse(result);
                if (resultObject.success) {
                    addLocalMessage("Now attached: " + resultObject.message);
                    pywebview.api.hide_transport_window();
                } else {
                    console.error("Error: " + resultObject.message);
                    addLocalMessage("Error: " + resultObject.message);
                }
            }
        );
    });
    // Toggle between showing divTypeTransport and divSelectTransport by clicking on the respective buttons
    var btnTypeTransport = document.getElementById('btnTypeTransport');
    var btnSelectTransport = document.getElementById('btnSelectTransport');
    var divTypeTransport = document.getElementById('divTypeTransport');
    var divSelectTransport = document.getElementById('divSelectTransport');
    var btnOpenCandumpFile = document.getElementById('btnOpenCandumpFile');
    btnOpenCandumpFile.addEventListener('click', function () {
        pywebview.api.open_file_dialog();
    });
});