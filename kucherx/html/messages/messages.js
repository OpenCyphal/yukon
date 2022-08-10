function addLocalMessage(message) {
    pywebview.api.add_local_message(message)
}
window.addEventListener('pywebviewready', function () {
    var messagesList = document.querySelector("#messages-list");
    // On resize event
    addLocalMessage("Found messageList")
    // at interval of 3 seconds
    let messagesListWidth = messagesList.getBoundingClientRect().width

    setInterval(function() {
        let currentWidth = messagesList.getBoundingClientRect().width
        if(currentWidth != messagesListWidth) {
            messagesListWidth = currentWidth
            for (child of messagesList.children) {
                autosize.update(child);
            }
        }
    }, 500);
});
function update_messages() {
    pywebview.api.get_avatars().then(
        function (avatars) {
            var textOut = document.querySelector("#textOut");
            textOut.innerHTML = avatars;
        }
    );
    pywebview.api.get_messages().then(
        function (messages) {
            // Clear messages-list
            var messagesList = document.querySelector("#messages-list");
            if (document.getElementById("cDeleteOldMessages").checked) {
                for (child of messagesList.children) {
                    if (child && child.getAttribute("timestamp")) {
                        var timestamp = child.getAttribute("timestamp");
                        // if timestamp is older than 10 seconds, remove it
                        if (new Date().getTime() - timestamp > 10000) {
                            messagesList.removeChild(child);
                        }
                    }
                }
            }
            // Add messages to messages-list
            var d = JSON.parse(messages);
            // Make sure that type of d is array
            console.assert(d instanceof Array);
            for (el of d) {
                var li = document.createElement("textarea");
                li.innerHTML = el;
                // Set an attribute on the list element with current timestamp
                autosize(li);
                li.setAttribute("timestamp", new Date().getTime());
                // If el is the last in d
                if (d.indexOf(el) == d.length - 1) {
                    // Scroll to bottom of messages-list
                    var cbAutoscroll = document.getElementById("cbAutoscroll");
                    var iAutoscrollFilter = document.getElementById("iAutoscrollFilter");
                    if (cbAutoscroll.checked && (iAutoscrollFilter.value == "" || el.includes(iAutoscrollFilter.value))) {
                        messagesList.scrollTop = messagesList.scrollHeight;
                    }
                }
                messagesList.appendChild(li);
            }
        }
    );
}
// Call update_messages every second
setInterval(update_messages, 1000);