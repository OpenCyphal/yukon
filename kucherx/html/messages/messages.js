localMessages = [];
function addLocalMessage(message) {
    localMessages.push(message.trim());
}
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
            d = d.concat(localMessages)
            localMessages = [];
            for (el of d) {
                var li = document.createElement("textarea");
                li.innerHTML = el;
                setTimeout(function () {
                    li.style.height = "1px";
                    li.style.height = (li.scrollHeight) + "px";
                }, 50);
                // Set an attribute on the list element with current timestamp
                li.setAttribute("timestamp", new Date().getTime());
                messagesList.appendChild(li);
            }
        }
    );
}