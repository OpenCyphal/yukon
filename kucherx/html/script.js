// Make a callback on the page load event
window.addEventListener('pywebviewready', function() {
    pywebview.api.get_ports_list().then(
    function(portsList)
    {
        var btnStart = document.getElementById('btnStart');
        var textOut = document.querySelector("#textOut");
        textOut.innerHTML = "Waiting to start...";
        var selector = document.querySelector("#sInterfaces");
        var d = JSON.parse(portsList);
        for(el of d) {
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
        btnStart.addEventListener('click', function() {
            var port = selector.value;
            pywebview.api.attach_transport(port, data_rate, arb_rate, node_id, mtu).then(
            function(result)
            {
                textOut.innerHTML = "Now attached: " + result
            }
            );
        });
    });
})