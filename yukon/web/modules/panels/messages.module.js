import { waitForElm } from "../utilities.module.js"
export async function setUpMessagesComponent(container, yukon_state) {
        const containerElement = container.getElement()[0];
        var messagesList = document.querySelector("#messages-list");
        const optionsPanel = await waitForElm(".options-panel");
        function setDisplayState() {
            if (containerElement.getAttribute("data-isexpanded")) {
                containerElement.scrollTop = 0;
                if (typeof cbAutoscroll !== "undefined") {
                    cbAutoscroll.checked = false;
                }
                optionsPanel.style.display = "block";
            } else {
                if (typeof cbAutoscroll !== "undefined") {
                    cbAutoscroll.checked = true;
                    containerElement.scrollTop = containerElement.scrollHeight;
                }
                optionsPanel.style.display = "none";
            }
        }
        setDisplayState();
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === "attributes") {
                    if (mutation.attributeName === "data-isexpanded") {
                        // Toggle visibility of options panel
                        setDisplayState();
                    }
                }
            });
        });

        observer.observe(containerElement, {
            attributes: true //configure it to listen to attribute changes
        });
        var cbShowTimestamp = await waitForElm('#cbShowTimestamp');
        const sLogLevel = document.querySelector("#sLogLevel");
        sLogLevel.addEventListener("change", async () => {
            await yukon_state.zubax_api.set_log_level(sLogLevel.value);
        });
        cbShowTimestamp.addEventListener('change', function () {
            if (cbShowTimestamp.checked) {
                // For every message, add a timestamp to the message, use a for each loop
                for (const message of messagesList.children) {
                    message.setAttribute("title", message.getAttribute("timeStampReadable"));
                }
            } else {
                // Remove the timestamp from every message
                for (const message of messagesList.children) {
                    message.removeAttribute("title");
                }
            }
        });
        var messagesList = document.querySelector("#messages-list");
        let messagesListWidth = messagesList.getBoundingClientRect().width
        console.log("Messages javascript is ready");
        var lastIndex = -1;
        var messagesList = await waitForElm("#messages-list");
        var cbAutoscroll = await waitForElm("#cbAutoscroll");
        function showAllMessages() {
            var messagesList = document.querySelector("#messages-list");
            if (!messagesList) { return; }
            // For each message in messagesList
            for (const child of messagesList.children) {
                child.style.display = "block";
            }
        }
        function applyExcludingTextFilterToMessage() {
            var messagesList = document.querySelector("#messages-list");
            var taExcludedKeywords = document.getElementById("taExcludedKeywords");
            var excludedKeywords = taExcludedKeywords.value.split("\n");
            for (const child of messagesList.children) {
                // For every excluded keyword in the list, hide the message if it contains the keyword
                for (const keyword of excludedKeywords) {
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
            for (const child of messagesList.children) {
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
            var messagesList = document.querySelector("#messages-list");
            var cbAutoscroll = document.querySelector("#cbAutoscroll");
            if (!messagesList || !cbAutoscroll) { return; }
            zubax_apij.get_messages(lastIndex + 1).then(
                function (messages) {
                    // Clear messages-list
                    if (document.getElementById("cDeleteOldMessages").checked) {
                        for (const child of messagesList.children) {
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
                    var messagesObject = messages;
                    // Make sure that type of d is array
                    console.assert(messagesObject instanceof Array);
                    for (const el of messagesObject) {
                        var li = document.createElement("textarea");
                        li.innerHTML = el.message;
                        if (el.severity_nr >= 50) {
                            // Is bad
                            li.style.color = "red";
                            li.style["background-color"] = "rgba(255, 0, 0, 0.1)";
                            li.style["font-weight"] = "bold";
                        } else if (el.severity_nr >= 40) { // Error
                            li.style.color = "red";
                        } else if (el.severity_nr == 30) {
                            li.style.color = "orange";
                        }
                        // Set an attribute on the list element with current timestamp

                        if (el.internal) {
                            li.style.backgroundColor = "lightgreen !important";
                        }
                        li.setAttribute("timestamp", el.timestamp);
                        li.setAttribute("spellcheck", "false");
                        var date1 = new Date(el.timestamp);
                        li.setAttribute("timeStampReadable", date1.toLocaleTimeString() + " " + date1.getMilliseconds() + "ms");
                        // If el is the last in d
                        if (messagesObject.indexOf(el) == messagesObject.length - 1) {
                            // Scroll to bottom of messages-list
                            setTimeout(function () {
                                var iAutoscrollFilter = document.getElementById("iAutoscrollFilter");
                                if (cbAutoscroll.checked && (iAutoscrollFilter.value == "" || el.includes(iAutoscrollFilter.value))) {
                                    containerElement.scrollTop = containerElement.scrollHeight;
                                }
                            }, 50);
                            lastIndex = el.index;
                        }
                        messagesList.appendChild(li);
                        yukon_state.autosize(li);
                        setTimeout(function() {
                            yukon_state.autosize.update(li);
                        }, 1000)
                    }
                    showAllMessages();
                    applyExcludingTextFilterToMessage();
                    applyTextFilterToMessages();
                }
            );
        }

        // Call update_messages every second
        setInterval(update_messages, 656);
        // btnTextOutput.addEventListener('click', function () {
        //     var textOut = document.querySelector("#textOut");
        //     autosize.update(textOut);
        // });
        // var tabTextOut = document.querySelector("#tabTextOut");
        // window.addEventListener('mouseup', function () {
        //     if (tabTextOut.classList.contains("is-active")) {
        //         var textOut = document.querySelector("#textOut");
        //         autosize.update(textOut);
        //     }
        // });

        // Run applyTextFilterToMessages() when there is a change in the filter text after the input has
        // stopped for 0.5 seconds
        var iTextFilter = document.getElementById("iTextFilter");
        var taExcludedKeywords = document.getElementById("taExcludedKeywords");
        var timer = null;
        cbAutoscroll.addEventListener('change', function () {
            if (cbAutoscroll.checked && (iAutoscrollFilter.value == "" || el.includes(iAutoscrollFilter.value))) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        });
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
        yukon_state.autosize(textOut);
        var messagesList = document.querySelector("#messages-list");
        // On resize event
        yukon_state.addLocalMessage("Found messageList", 10);
        // at interval of 3 seconds
        messagesListWidth = messagesList.getBoundingClientRect().width;

        setInterval(function () {
            var messagesList = document.querySelector("#messages-list");
            if (!messagesList) { return; }
            let currentWidth = messagesList.getBoundingClientRect().width;
            if (currentWidth != messagesListWidth) {
                messagesListWidth = currentWidth;
                for (const child of messagesList.children) {
                    yukon_state.autosize.update(child);
                }
            }
        }, 500);
    }