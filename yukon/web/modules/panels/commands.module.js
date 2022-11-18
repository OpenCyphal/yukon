export function setUpCommandsComponent(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const iNodeId = containerElement.querySelector("#iNodeId");
    const iCommandId = containerElement.querySelector("#iCommandId");
    const sCommands = containerElement.querySelector("#sCommands");
    const iCommandArgument = containerElement.querySelector("#iCommandArgument");
    const btnSendCommand = containerElement.querySelector("#btnSendCommand");
    const feedbackMessage = containerElement.querySelector(".feedback-message");
    sCommands.addEventListener("change", function (event) {
        // Get the selected option and take the attribute data-command-id from it
        const selectedOptionValue = sCommands.value;
        let selectedOptionElement = null;
        // For every child of sCommands that is an OPTION element
        for (let i = 0; i < sCommands.childNodes.length; i++) {
            const element = sCommands.childNodes[i];
            if (element.value == selectedOptionValue) {
                selectedOptionElement = element;
                break;
            }
        }
        if (selectedOptionElement) {
            if (selectedOptionElement.getAttribute("data-has-arguments") == "true") {
                iCommandArgument.removeAttribute("disabled")
            } else {
                iCommandArgument.setAttribute("disabled", "")
            }
            iCommandId.value = selectedOptionElement.getAttribute("data-command-id");
        } else {
            console.error("Didn't find the element for " + selectedOptionValue);
        }
    });

    function disableOrEnableArguments() {
        const children = sCommands.children;
        let matchedAny = false;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            // If the tag of the child element is option
            if (child.tagName == "OPTION") {
                if (child.getAttribute("data-command-id") === iCommandId.value) {
                    matchedAny = true;
                    if (child.getAttribute("data-has-arguments") == "true") {
                        iCommandArgument.removeAttribute("disabled")
                    } else {
                        iCommandArgument.setAttribute("disabled", "")
                    }
                    break;
                }
            }
        }
        if (!matchedAny) {
            iCommandArgument.removeAttribute("disabled");
        }
    }

    // When the input text in iCommandId is changed, see if the id corresponds to any of the command-ids specified in data-command-ids of any of the options in sCommand
    iCommandId.addEventListener("input", function (event) {
        // For all children of sCommands that are options
        disableOrEnableArguments();
    });
    btnSendCommand.addEventListener("click", async function (event) {
        const result = await yukon_state.zubax_apij.send_command(iNodeId.value, iCommandId.value, iCommandArgument.value);
        if (!result.success) {
            feedbackMessage.classList.remove("success");
            feedbackMessage.style.display = "block";
            if (result.message) {
                feedbackMessage.innerHTML = result.message;
            } else {
                feedbackMessage.innerHTML = "";
            }
        } else {
            feedbackMessage.classList.add("success");
            feedbackMessage.style.display = "block";
            if (result.message) {
                feedbackMessage.innerHTML = result.message;
            } else {
                feedbackMessage.innerHTML = "";
            }
        }

    });
}