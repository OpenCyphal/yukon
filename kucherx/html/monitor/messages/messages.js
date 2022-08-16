(function () {
    function addLocalMessage(message) {
        zubax_api.add_local_message(message)
    }
    
    function doStuffWhenReady() {
        console.log("Messages javascript is ready");
        var lastHash = "";
        var lastIndex = -1;
        var messagesList = document.querySelector("#messages-list");
        function showAllMessages() {
            // For each message in messagesList
            for (child of messagesList.children) {
                child.style.display = "block";
            }
        }
        function applyExcludingTextFilterToMessage() {
            var taExcludedKeywords = document.getElementById("taExcludedKeywords");
            var excludedKeywords = taExcludedKeywords.value.split("\n");
            for (child of messagesList.children) {
                // For every excluded keyword in the list, hide the message if it contains the keyword
                for (keyword of excludedKeywords) {
                    // If keyword is empty then continue
                    if (keyword == "") {
                        continue;
                    }
                    if (child.innerHTML.includes(keyword)) {
                        child.style.display = "none";
                        break;
                    }
                }
            }
        }
        function applyTextFilterToMessages() {
            // Get the filter text from iTextFilter and save it in a variable
            var iTextFilter = document.getElementById("iTextFilter");
            var messagesList = document.querySelector("#messages-list");
            var textFilter = iTextFilter.value;
            for (child of messagesList.children) {
                // Hide all messages that do not contain the filter text
                if (!child.innerHTML.includes(textFilter)) {
                    child.style.display = "none";
                }
            }
        }
        function timeSince(date) {
            var seconds = Math.floor(((new Date().getTime() / 1000) - date))

            var interval = seconds / 31536000;

            if (interval >= 1) {
                return Math.floor(interval) + " years";
            }
            interval = seconds / 2592000;
            if (interval >= 1) {
                return Math.floor(interval) + " months";
            }
            interval = seconds / 86400;
            if (interval >= 1) {
                return Math.floor(interval) + " days";
            }
            interval = seconds / 3600;
            if (interval >= 1) {
                return Math.floor(interval) + " hours";
            }
            interval = seconds / 60;
            if (interval >= 1) {
                return Math.floor(interval) + " minutes";
            }
            return Math.floor(seconds) + " seconds";
        }
        function update_messages() {
            console.log("update_messages");
            zubax_api.get_messages(lastIndex + 1).then(
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
                    var messagesObject = JSON.parse(messages);
                    // Make sure that type of d is array
                    console.assert(messagesObject instanceof Array);
                    for (el of messagesObject) {
                        var li = document.createElement("textarea");
                        li.innerHTML = el.message;
                        // Set an attribute on the list element with current timestamp
                        autosize(li);
                        li.setAttribute("timestamp", el.timestamp);
                        li.setAttribute("spellcheck", "false");
                        var date1 = new Date(el.timestamp);
                        li.setAttribute("timeStampReadable", date1.toLocaleTimeString() + " " + date1.getMilliseconds() + "ms");
                        // If el is the last in d
                        if (messagesObject.indexOf(el) == messagesObject.length - 1) {
                            // Scroll to bottom of messages-list
                            var cbAutoscroll = document.getElementById("cbAutoscroll");
                            var iAutoscrollFilter = document.getElementById("iAutoscrollFilter");
                            if (cbAutoscroll.checked && (iAutoscrollFilter.value == "" || el.includes(iAutoscrollFilter.value))) {
                                messagesList.scrollTop = messagesList.scrollHeight;
                            }
                            lastIndex = el.index;
                        }
                        messagesList.appendChild(li);
                    }
                    showAllMessages();
                    applyExcludingTextFilterToMessage();
                    applyTextFilterToMessages();
                }
            );
        }

        function updateTextOut() {
            zubax_api.get_avatars().then(
                function (avatars) {
                    var textOut = document.querySelector("#textOut");
                    var DTO = JSON.parse(avatars);
                    if (DTO.hash != lastHash) {
                        addLocalMessage("Hash changed");
                        lastHash = DTO.hash;
                        textOut.innerHTML = JSON.stringify(DTO.avatars, null, 4)
                    }
                    // Parse avatars as json
                }
            );
        }
        setInterval(updateTextOut, 500);
        // Call update_messages every second
        setInterval(update_messages, 1000);
        btnTextOutput.addEventListener('click', function () {
            var textOut = document.querySelector("#textOut");
            autosize.update(textOut);
        });
        var tabTextOut = document.querySelector("#tabTextOut");
        window.addEventListener('mouseup', function () {
            if (tabTextOut.classList.contains("is-active")) {
                var textOut = document.querySelector("#textOut");
                autosize.update(textOut);
            }
        });
        // Run applyTextFilterToMessages() when there is a change in the filter text after the input has
        // stopped for 0.5 seconds
        var iTextFilter = document.getElementById("iTextFilter");
        var taExcludedKeywords = document.getElementById("taExcludedKeywords");
        var timer = null;
        iTextFilter.addEventListener("input", function () {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                applyTextFilterToMessages();
            }, 500);
        });
        var timer2 = null;
        taExcludedKeywords.addEventListener("input", function () {
            if (timer2) {
                clearTimeout(timer2);
            }
            timer2 = setTimeout(function () {
                applyExcludingTextFilterToMessage();
            }, 1000);
        });

        var textOut = document.querySelector("#textOut");
        autosize(textOut);
        var messagesList = document.querySelector("#messages-list");
        // On resize event
        addLocalMessage("Found messageList")
        // at interval of 3 seconds
        let messagesListWidth = messagesList.getBoundingClientRect().width

        setInterval(function () {
            let currentWidth = messagesList.getBoundingClientRect().width
            if (currentWidth != messagesListWidth) {
                messagesListWidth = currentWidth
                for (child of messagesList.children) {
                    autosize.update(child);
                }
            }
        }, 500);
        
    }
    if (zubax_api_ready) {
        doStuffWhenReady();
    } else {
        window.addEventListener('zubax_api_ready', function () {
            doStuffWhenReady();
        });
    }
})();
