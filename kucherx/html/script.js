// Make a callback on the page load event
window.addEventListener('pywebviewready', function() {
    pywebview.api.get_ports_list().then(
    function(portsList)
    {
        var textOut = document.querySelector("#textOut");
        textOut.innerHTML = portsList;
    });
})