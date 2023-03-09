import { getDatatypesForPort, getKnownDatatypes } from "../../utilities.module.js";
function createCloseButton() {
    const closeButton = document.createElement("button");
    closeButton.classList.add("btn", "btn-sm", "btn-danger")
    closeButton.innerText = "x";
    closeButton.style.borderWidth = "0";
    closeButton.style.position = "absolute";
    closeButton.style.display = "flex";
    // Align text to the baseline
    closeButton.style.alignItems = "baseline";
    closeButton.style.justifyContent = "center";
    // closeButton.style.right = "1px";
    // closeButton.style.top = "1px";
    closeButton.style.right = -23 + "px";
    closeButton.style.top = 1 + "px";
    closeButton.style.marginTop = "0";
    // Make sure the button has a 1x1 aspect ratio and a width of 14px
    closeButton.style.width = "20px";
    closeButton.style.height = "20px";
    // closeButton.style.padding = "0px";
    return closeButton;
}
function addLatestMessageCopyActions(pLatestMessage) {
    pLatestMessage.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        console.log("Copied latest message to clipboard: " + pLatestMessage.innerText);
        navigator.clipboard.writeText(pLatestMessage.innerText);
    });
    pLatestMessage.addEventListener("click", (event) => {
        event.preventDefault();
        console.log("Copied latest message to clipboard: " + pLatestMessage.innerText);
        navigator.clipboard.writeText(pLatestMessage.innerText);
    });
}
async function fetch(specifier, pLatestMessage, inputLogToConsole, fetchTimeoutId, lastCurrentMessagesLength, yukon_state) {
    const current_messages = yukon_state.subscriptions[specifier];
    const full_specifiers = [specifier + ":" + yukon_state.subscriptions[specifier].length];
    const result = await yukon_state.zubax_apij.fetch_messages_for_subscription_specifiers(JSON.stringify(full_specifiers));
    const messages = result[Object.keys(result)[0]]
    if (!messages) {
        if (!yukon_state.missed_messages) {
            yukon_state.missed_messages = {};
        }
        if (yukon_state.missed_messages[specifier]) {
            yukon_state.missed_messages[specifier]++;
        } else {
            yukon_state.missed_messages[specifier] = 1;
        }
        if (yukon_state.missed_messages[specifier] > 10) {
            clearTimeout(fetchTimeoutId.value);
            if (typeof pLatestMessage !== undefined && pLatestMessage.parentElement) {
                pLatestMessage.innerText = "This subscription has been terminated by the server";
            }
        }
        return false;
    }
    if (lastCurrentMessagesLength.value === current_messages.length + messages.length) {
        return false;
    } else {
        lastCurrentMessagesLength.value = current_messages.length + messages.length;
    }
    if (!messages) {
        clearTimeout(fetchTimeoutId.value);
        header2.innerText = "This subscription has been terminated by the server";
        return false;
    }
    for (const message of messages) {
        if (inputLogToConsole.checked) {
            yukon_state.zubax_apij.add_local_message(JSON.stringify(message), 20)
        }
        current_messages.push(message);
    }
    const lastMessageObject = current_messages[current_messages.length - 1];
    if (!lastMessageObject) {
        return false;
    }
    const yaml_text = await yukon_state.zubax_api.json_to_yaml(JSON.stringify(lastMessageObject));
    // If yaml_text contains a newline, it will be split into multiple lines
    if (yaml_text.includes("\n")) {
        pLatestMessage.innerHTML = "";
        const lines_split = yaml_text.split("\n");
        for (const line of lines_split) {
            if (line.trim() === "") {
                continue;
            }
            const p = document.createElement("p");
            p.style.whiteSpace = "pre-wrap";
            p.style.marginBottom = "0";
            p.innerHTML = line;
            pLatestMessage.appendChild(p);
        }
        return true;
    } else {
        pLatestMessage.innerHTML = yaml_text;
        return true;
    }
}
async function fetchForSync(specifiersString, pLatestMessage, fetchTimeoutId, lastCurrentMessagesLength, settings, yukon_state) {
    const result = await yukon_state.zubax_apij.fetch_synchronized_messages_for_specifiers(specifiersString, lastCurrentMessagesLength.value);
    if (!result || result.error) {
        clearTimeout(fetchTimeoutId.value);
        pLatestMessage.innerText = "This subscription has been terminated by the server";
        return false;
    }
    let current_messages = yukon_state.subscriptions[specifiersString];
    let messages = result;
    if (lastCurrentMessagesLength.value === current_messages.length + messages.length) {
        return false;
    } else {
        lastCurrentMessagesLength.value = current_messages.length + messages.length;
    }
    const json_object = result[result.length - 1];
    if (!json_object) {
        return false;
    }
    const json_text = JSON.stringify(json_object);
    const yaml_text = await yukon_state.zubax_api.json_to_yaml(json_text);
    if (yaml_text.includes("\n")) {
        pLatestMessage.innerHTML = "";
        const lines_split = yaml_text.split("\n");
        for (const line of lines_split) {
            if (line.trim() === "") {
                continue;
            }
            const p = document.createElement("p");
            p.style.whiteSpace = "pre-wrap";
            p.style.marginBottom = "0";
            p.innerHTML = line;
            pLatestMessage.appendChild(p);
        }
        return true;
    } else {
        pLatestMessage.innerHTML = yaml_text;
        return true;
    }
}
function fillExistingDivs(existing_divs, existing_specifiers, subscriptionsDiv, yukon_state) {
    for (const child of subscriptionsDiv.children) {
        const isSubscriptionDiv = child.classList.contains("subscription");
        if (!isSubscriptionDiv) {
            continue;
        }
        const specifier = child.getAttribute("data-specifier");
        const isBeingSetup = child.getAttribute("data-is-being-setup");
        const isExisting = existing_specifiers[specifier];
        if (!isExisting && !isBeingSetup) {
            child.parentElement.removeChild(child);
        } else {
            existing_divs[specifier] = true;
        }
    }
}
async function refreshKnownDatatypes(iSelectFixedIdMessageType, iSelectAny, iSelectDatatype, btns, yukon_state) {
    // Flash all buttons btnRefresh1, btnRefresh2, btnRefresh3 with text "Refreshing..."

    btns.forEach(btn => {
        btn.innerHTML = 'Refreshing...';
        btn.disabled = true;
        // If the buttons are still disabled after 5 seconds, we assume that the refresh failed.
        setTimeout(() => {
            if (btn.disabled) {
                btn.innerHTML = 'Refresh failed';
                setTimeout(() => {
                    btn.innerHTML = 'Refresh';
                    btn.disabled = false;
                }, 1200);
            }
        }, 3000);
    });
    const knownDatatypes = getKnownDatatypes(yukon_state);
    // Alphabetically sort knownDatatypes
    knownDatatypes.sort();
    const response = await yukon_state.zubax_apij.get_known_datatypes_from_dsdl();
    iSelectDatatype.innerHTML = '';
    iSelectAny.innerHTML = '';
    iSelectFixedIdMessageType.innerHTML = '';
    for (const datatype of knownDatatypes) {
        // Add a new option to the select
        const option = document.createElement('option');
        option.value = datatype;
        option.innerHTML = datatype;
        iSelectDatatype.appendChild(option);
    }
    for (const id in response["fixed_id_messages"]) {
        const datatype_short = response["fixed_id_messages"][id]["short_name"];
        const datatype_full = response["fixed_id_messages"][id]["name"];
        // Add a new option to the select
        const option = document.createElement('option');
        option.innerHTML = datatype_full + "(" + id + ")";
        option.value = datatype_full;
        iSelectFixedIdMessageType.appendChild(option);
    }
    response["variable_id_messages"].sort();
    for (const datatype of response["variable_id_messages"]) {
        // Add a new option to the select
        const option = document.createElement('option');
        option.value = datatype.name;
        option.innerHTML = datatype.name;
        iSelectAny.appendChild(option);
    }
    btns.forEach(btn => {
        btn.innerHTML = 'Refreshed';
        btn.disabled = true;
    });
    setTimeout(() => {
        btns.forEach(btn => {
            btn.innerHTML = 'Refresh';
            btn.disabled = false;
        });
    }, 1200);
}
async function createSubscriptionElement(specifier, subscriptionsDiv, subscriptionElementsToBePlaced, settings, yukon_state) {
    const subject_id = specifier.split(":")[0];
    const datatype = specifier.split(":")[1];
    console.log("Drawing subscription specifier", specifier);
    const subscriptionElement = document.createElement("div");
    const header1 = document.createElement("h3");
    header1.innerText = specifier;
    yukon_state.monitor2.ports.find((port) => {
        return port.port === subject_id;
    });
    subscriptionElement.appendChild(header1);
    const header2 = document.createElement("h3");
    header2.innerText = "This is an active subscription";

    subscriptionElement.appendChild(header2);
    subscriptionElement.classList.add("subscription");
    subscriptionElement.setAttribute("data-specifier", specifier);
    const pLatestMessage = document.createElement("p");
    addLatestMessageCopyActions(pLatestMessage);
    pLatestMessage.style.marginBottom = "0";
    pLatestMessage.innerText = "Yet to receive messages...";
    subscriptionElement.appendChild(pLatestMessage);
    let inputLogToConsole = {"checked": false};
    if (settings.ShowLogToConsoleOption) {
        const divLogToConsole = document.createElement('div');
        divLogToConsole.classList.add('form-check');
        inputLogToConsole = document.createElement('input');
        inputLogToConsole.classList.add('form-check-input');
        inputLogToConsole.classList.add('checkbox');
        inputLogToConsole.type = 'checkbox';
        inputLogToConsole.id = "inputLogToConsole" + subject_id + ":" + datatype;
        divLogToConsole.appendChild(inputLogToConsole);
        labelLogToConsole = document.createElement('label');
        labelLogToConsole.classList.add('form-check-label');
        labelLogToConsole.htmlFor = inputLogToConsole.id;
        labelLogToConsole.innerHTML = "Log to console";
        divLogToConsole.appendChild(labelLogToConsole);
        subscriptionElement.appendChild(divLogToConsole);
    }

    if (settings.ShowStreamToPlotJugglerOption) {
        const divStreamToPlotJuggler = document.createElement('div');
        divStreamToPlotJuggler.classList.add('form-check');
        const streamToPlotJuggler = document.createElement('input');
        streamToPlotJuggler.classList.add('form-check-input');
        streamToPlotJuggler.classList.add('checkbox');
        streamToPlotJuggler.type = 'checkbox';
        streamToPlotJuggler.id = "streamToPlotJuggler" + subject_id + ":" + datatype;
        divStreamToPlotJuggler.appendChild(streamToPlotJuggler);
        const labelStreamToPlotJuggler = document.createElement('label');
        labelStreamToPlotJuggler.classList.add('form-check-label');
        labelStreamToPlotJuggler.htmlFor = streamToPlotJuggler.id;
        labelStreamToPlotJuggler.innerHTML = "Stream to PlotJuggler";
        divStreamToPlotJuggler.appendChild(labelStreamToPlotJuggler);
        subscriptionElement.appendChild(divStreamToPlotJuggler);

        streamToPlotJuggler.addEventListener('change', async (event) => {
            if (event.target.checked) {
                await yukon_state.zubax_apij.enable_udp_output_from(specifier);
            } else {
                await yukon_state.zubax_apij.disable_udp_output_from(specifier);
            }
        });
    }


    // Add an input number field for capacity of the stored messages
    // Also a label before it
    const divCapacity = document.createElement('div');
    divCapacity.classList.add('form-group');
    const labelCapacity = document.createElement('label');
    labelCapacity.htmlFor = "inputCapacity" + subject_id + ":" + datatype;
    labelCapacity.innerHTML = "Saved messages capacity";
    divCapacity.appendChild(labelCapacity);
    const inputCapacity = document.createElement('input');
    inputCapacity.classList.add('form-control');
    inputCapacity.type = 'number';
    inputCapacity.id = "inputCapacity" + subject_id + ":" + datatype;
    inputCapacity.value = settings.DefaultMessageCapacity;
    divCapacity.appendChild(inputCapacity);
    subscriptionElement.appendChild(divCapacity);
    setTimeout(async () => await yukon_state.zubax_apij.set_message_store_capacity(subject_id + ":" + datatype, inputCapacity.value), 1000);
    inputCapacity.addEventListener('change',
        async () =>
            await yukon_state.zubax_apij.set_message_store_capacity(subject_id + ":" + datatype, inputCapacity.value)
    );
    // Add an input element for the delay between every fetch of new subscription messages
    // Also a label before it
    const divFetchDelay = document.createElement('div');
    divFetchDelay.classList.add('form-group');
    const labelFetchDelay = document.createElement('label');
    labelFetchDelay.htmlFor = "inputFetchDelay" + subject_id + ":" + datatype;
    labelFetchDelay.innerHTML = "Fetch delay (ms)";
    divFetchDelay.appendChild(labelFetchDelay);
    const inputFetchDelay = document.createElement('input');
    inputFetchDelay.classList.add('form-control');
    inputFetchDelay.type = 'number';
    inputFetchDelay.id = "inputFetchDelay" + subject_id + ":" + datatype;
    inputFetchDelay.min = 5;
    inputFetchDelay.max = 400;
    divFetchDelay.appendChild(inputFetchDelay);
    subscriptionElement.appendChild(divFetchDelay);

    let fetchDelayValue = settings.DefaultFetchDelay;
    inputFetchDelay.value = fetchDelayValue;
    inputFetchDelay.addEventListener('change', () => {
        fetchDelayValue = inputFetchDelay.value;
    });


    // Add a button for opening logs
    const openLogsButton = document.createElement("button");
    openLogsButton.classList.add("btn", "btn-secondary", "btn-sm")
    openLogsButton.innerText = "Open logs, when open CTRL+R to reload";
    const openLogsHandler = async () => {
        // Open a new tab at http://localhost:5000/api/get_all_subscription_messages?message_specifier=subject_id:datatype
        const url = `http://127.0.0.1:${yukon_state.port}/api/get_all_subscription_messages?message_specifier=${specifier}`;
        window.open(url, '_blank');
    };
    openLogsButton.addEventListener("click", openLogsHandler);
    subscriptionElement.appendChild(openLogsButton);

    // Add a button for opening logs
    const openLatestMessage = document.createElement("button");
    openLatestMessage.classList.add("btn", "btn-secondary", "btn-sm")
    openLatestMessage.innerText = "Open latest message, when open CTRL+R to reload";
    const openLatestHandler = async () => {
        // Open a new tab at http://localhost:5000/api/get_all_subscription_messages?message_specifier=subject_id:datatype
        const url = `http://127.0.0.1:${yukon_state.port}/api/get_latest_subscription_message?message_specifier=${specifier}`;
        window.open(url, '_blank');
    };
    openLatestMessage.addEventListener("click", openLatestHandler);
    subscriptionElement.appendChild(openLatestMessage);
    const unsubscribeHandler = async () => {
        const response = await yukon_state.zubax_apij.unsubscribe(specifier);
        if (response.success) {
            yukon_state.subscription_specifiers.specifiers = yukon_state.subscription_specifiers.specifiers.filter((specifier_) => { return specifier_ !== specifier; });
            await drawSubscriptions(subscriptionsDiv, settings, yukon_state);
        } else {
            console.error("Failed to unsubscribe: " + response.message);
        }
    };

    // // Add a button for unsubscribing
    // const unsubscribeButton = document.createElement("button");
    // unsubscribeButton.innerText = "Unsubscribe";
    // unsubscribeButton.addEventListener("click", unsubscribeHandler);
    // subscriptionElement.appendChild(unsubscribeButton);

    subscriptionElement.style.position = "relative";

    const closeButton = createCloseButton();
    closeButton.addEventListener("click", unsubscribeHandler);
    subscriptionElement.appendChild(closeButton);
    if (!yukon_state.subscriptions[specifier]) {
        yukon_state.subscriptions[specifier] = [];
    }
    const current_messages = yukon_state.subscriptions[specifier];
    let lastCurrentMessagesLength = { value: 0 };
    let fetchTimeoutId = { value: null };
    let setTimeoutFunction = null;
    setTimeoutFunction = () => {
        // Flash the inputFetchDelay element with a yellow color for half of the fetchDelayValue
        setTimeout(() => inputFetchDelay.style.removeProperty("background-color"), fetchDelayValue / 2);
        let fetchHadNewMessages = fetch(specifier, pLatestMessage, inputLogToConsole, fetchTimeoutId, lastCurrentMessagesLength, yukon_state)
        if (settings.BlinkSubscriptionOption === "Blink at backend fetch rate" || settings.BlinkSubscriptionOption === "Blink at new received messages") {
            if (fetchHadNewMessages || settings.BlinkSubscriptionOption === "Blink at backend fetch rate") {
                inputFetchDelay.style.backgroundColor = "green";
            }
        }
        fetchTimeoutId.value = setTimeout(setTimeoutFunction, fetchDelayValue)
    }
    setTimeoutFunction();
    subscriptionElementsToBePlaced.push([subscriptionElement, specifier]);
    subscriptionsDiv.appendChild(subscriptionElement);
}

async function createSyncSubscriptionElement(specifiersString, subscriptionsDiv, settings, yukon_state) {
    const subscriptionElement = document.createElement("div");
    subscriptionElement.classList.add("subscription");
    subscriptionElement.setAttribute("data-specifier", specifiersString);
    const header1 = document.createElement("h3");
    header1.innerText = "Synchronous subscription";
    subscriptionElement.appendChild(header1);
    const header2 = document.createElement("h3");
    header2.innerText = specifiersString;
    subscriptionElement.appendChild(header2);
    const pLatestMessage = document.createElement("p");
    // If pLatestMessage is left or right clicked, then copy it's inner text to clipboard
    addLatestMessageCopyActions(pLatestMessage);
    pLatestMessage.style.marginBottom = "0";
    pLatestMessage.innerText = "Yet to receive messages...";
    subscriptionElement.appendChild(pLatestMessage);
    subscriptionsDiv.appendChild(subscriptionElement);
    let fetchTimeoutId = { value: null };
    const unsubscribeHandler = async () => {
        const response = await yukon_state.zubax_apij.unsubscribe_synchronized(specifiersString);
        if (response.success) {
            const specifiers_length = yukon_state.sync_subscription_specifiers.specifiers.length;
            yukon_state.sync_subscription_specifiers.specifiers = yukon_state.sync_subscription_specifiers.specifiers.filter((specifier_) => { return specifier_ !== specifiersString; });
            // Make sure that something was actually removed
            console.assert(specifiers_length === yukon_state.sync_subscription_specifiers.specifiers.length + 1);
            clearTimeout(fetchTimeoutId.value);
            await drawSubscriptions(subscriptionsDiv, settings, yukon_state);
        } else {
            console.error("Failed to unsubscribe: " + response.message);
        }
    };
    // Add a button for unsubscribing
    // const unsubscribeButton = document.createElement("button");
    // unsubscribeButton.innerText = "Unsubscribe";
    // unsubscribeButton.addEventListener("click", unsubscribeHandler);
    // subscriptionElement.appendChild(unsubscribeButton);
    subscriptionElement.style.position = "relative";

    // Add an input number field for capacity of the stored messages
    // Also a label before it
    const divCapacity = document.createElement('div');
    divCapacity.classList.add('form-group');
    const labelCapacity = document.createElement('label');
    labelCapacity.htmlFor = "inputCapacity" + specifiersString;
    labelCapacity.innerHTML = "Saved messages capacity";
    divCapacity.appendChild(labelCapacity);
    const inputCapacity = document.createElement('input');
    inputCapacity.classList.add('form-control');
    inputCapacity.type = 'number';
    inputCapacity.id = "inputCapacity" + specifiersString;
    inputCapacity.value = settings.DefaultMessageCapacity;
    divCapacity.appendChild(inputCapacity);
    subscriptionElement.appendChild(divCapacity);
    setTimeout(async () => await yukon_state.zubax_apij.set_sync_store_capacity(specifiersString, inputCapacity.value), 1000);
    inputCapacity.addEventListener('change',
        async () =>
            await yukon_state.zubax_apij.set_sync_store_capacity(specifiersString, inputCapacity.value)
    );
    // Add an input element for the delay between every fetch of new subscription messages
    // Also a label before it
    const divFetchDelay = document.createElement('div');
    divFetchDelay.classList.add('form-group');
    const labelFetchDelay = document.createElement('label');
    labelFetchDelay.innerHTML = "Fetch delay (ms)";
    divFetchDelay.appendChild(labelFetchDelay);
    const inputFetchDelay = document.createElement('input');
    inputFetchDelay.classList.add('form-control');
    inputFetchDelay.type = 'number';
    inputFetchDelay.value = 300;
    inputFetchDelay.min = 5;
    inputFetchDelay.max = 400;
    divFetchDelay.appendChild(inputFetchDelay);
    subscriptionElement.appendChild(divFetchDelay);

    let fetchDelayValue = 300;
    inputFetchDelay.value = fetchDelayValue;
    inputFetchDelay.addEventListener('change', () => {
        fetchDelayValue = inputFetchDelay.value;
    });

    const closeButton = createCloseButton();
    closeButton.addEventListener("click", unsubscribeHandler);
    subscriptionElement.appendChild(closeButton);
    if (!yukon_state.subscriptions[specifiersString]) {
        yukon_state.subscriptions[specifiersString] = [];
    }

    let lastCurrentMessagesLength = { value: 0 };
    let setTimeoutFunction = null;
    setTimeoutFunction = () => {
        inputFetchDelay.style.backgroundColor = "yellow";
        setTimeout(() => inputFetchDelay.style.removeProperty("background-color"), fetchDelayValue / 2);
        let wasFetchSuccess = fetchForSync(specifiersString, pLatestMessage, fetchTimeoutId, lastCurrentMessagesLength, settings, yukon_state)
        if (wasFetchSuccess) {
            inputFetchDelay.style.backgroundColor = "green";
        }
        fetchTimeoutId.value = setTimeout(setTimeoutFunction, fetchDelayValue)
    }
    setTimeoutFunction();
}
export async function drawSubscriptions(subscriptionsDiv, settings, yukon_state) {
    if (settings.SubscriptionsOffset === null) {
        // Subscriptions cannot be drawn currently before any nodes and ports have been drawn
        return;
    }
    const existing_specifiers = {};
    const existing_divs = {};

    if (!yukon_state.subscription_specifiers) {
        return;
    }
    // Fill existing specifiers
    for (const specifier of yukon_state.subscription_specifiers.specifiers) {
        existing_specifiers[specifier] = true;
    }
    for (const specifier of yukon_state.sync_subscription_specifiers.specifiers) {
        existing_specifiers[specifier] = true;
    }

    fillExistingDivs(existing_divs, existing_specifiers, subscriptionsDiv, yukon_state);

    const subscriptionElementsToBePlaced = [];
    for (const specifier of yukon_state.subscription_specifiers.specifiers) {
        if (existing_divs[specifier]) {
            continue;
        }
        createSubscriptionElement(specifier, subscriptionsDiv, subscriptionElementsToBePlaced, settings, yukon_state);
    }

    for (const specifiersString of yukon_state.sync_subscription_specifiers.specifiers) {
        if (existing_divs[specifiersString]) {
            continue;
        }
        createSyncSubscriptionElement(specifiersString, subscriptionsDiv, settings, yukon_state);
    }
    let list_of_subscription_getters = [];
    // Subscriptions that are not ready yet, preparing subscriptions
    // This includes preparing synchronized subscriptions
    for (const subscription of yukon_state.subscriptions_being_set_up) {
        if (subscription.element) {
            continue;
        }
        // Add a div with a select input for the datatype and a button for subscribing
        const subscriptionElement = document.createElement("div");
        subscription.element = subscriptionElement;
        const header = document.createElement("h3");
        header.innerText = "This is a pending subscription, confirm it by selecting a datatype and clicking the button below";
        subscriptionElement.appendChild(header);
        subscriptionElement.classList.add("subscription");
        subscriptionElement.style.position = "relative";
        subscriptionElement.setAttribute("data-is-being-setup", "true");
        let subjectsForSubscription = [];
        let isSynchronous = false;
        if (subscription.subject_id !== undefined) {
            subjectsForSubscription = [subscription.subject_id]
            isSynchronous = false;
        } else if (subscription.subject_ids !== undefined && Array.isArray(subscription.subject_ids)) {
            subjectsForSubscription = subscription.subject_ids
            isSynchronous = true;
        }
        for (const subject1Nr of subjectsForSubscription) {
            // Create a h3 for subject1Nr
            const subject_id_display = document.createElement("input");
            subject_id_display.placeholder = "Subject ID";
            subject_id_display.value = subject1Nr;
            subscriptionElement.appendChild(subject_id_display);
            const select = document.createElement("select");
            async function updateSelectElements() {
                select.innerHTML = "";
                const datatypesOfPort = await getDatatypesForPort(subject_id_display.value, yukon_state);
                for (const datatype of datatypesOfPort) {
                    const option = document.createElement("option");
                    option.value = datatype;
                    option.innerText = datatype;
                    select.appendChild(option);
                }
            }
            if (subject_id_display.value && parseInt(subject_id_display.value) !== 0) {
                await updateSelectElements();
            }
            // When the subject_id_display changes, update the select, only 1.5 seconds after typing has ended
            let timeoutId = null;
            subject_id_display.addEventListener("input", async () => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }
                timeoutId = setTimeout(async () => {
                    await updateSelectElements();
                }, 1500);
            });
            subscriptionElement.appendChild(select);

            // A checkbox on whether to use complex selection for datatypes
            const divUseComplexSelection = document.createElement('div');
            divUseComplexSelection.classList.add('form-check');
            const inputUseComplexSelection = document.createElement('input');
            inputUseComplexSelection.classList.add('form-check-input');
            inputUseComplexSelection.classList.add('checkbox');
            inputUseComplexSelection.type = 'checkbox';
            inputUseComplexSelection.checked = false;
            // I hope the ID isn't too long if I ever need to use it
            inputUseComplexSelection.id = "inputUseComplexSelection:" + subject_id_display.value;
            divUseComplexSelection.appendChild(inputUseComplexSelection);
            const labelUseComplexSelection = document.createElement('label');
            labelUseComplexSelection.classList.add('form-check-label');
            labelUseComplexSelection.htmlFor = inputUseComplexSelection.id;
            labelUseComplexSelection.innerHTML = "Use complex datatype selection";
            divUseComplexSelection.appendChild(labelUseComplexSelection);
            subscriptionElement.appendChild(divUseComplexSelection);

            const divComplexSelection = document.createElement('div');
            divComplexSelection.classList.add('complex-selection');
            divComplexSelection.style.display = 'none';
            divComplexSelection.id = "divComplexSelection:" + subject_id_display.value;
            subscriptionElement.appendChild(divComplexSelection);

            // The subject_id that is sent to addComplexSelectionComponents is only used for the IDs of different HTML elements, it should perhaps be replaced with a guid
            let [rbUseManualDatatypeEntry, rbUseSelectAny, rbUseSelectFixedId, rbUseSelectAdvertised, iSelectDatatype, iSelectFixedIdMessageType,
                iSelectAny, iManualDatatypeEntry, btnRefresh1, btnRefresh2, btnRefresh3] = addComplexSelectionComponents({ subject_id: subject_id_display.value }, divComplexSelection);


            inputUseComplexSelection.addEventListener('change', () => {
                if (inputUseComplexSelection.checked) {
                    divComplexSelection.style.display = 'block';
                    select.style.display = 'none';
                } else {
                    divComplexSelection.style.display = 'none';
                    select.style.display = 'block';
                }
            });

            const btns = [btnRefresh1, btnRefresh2, btnRefresh3];
            btns.forEach(btn => {
                btn.addEventListener('click', async () => {
                    await refreshKnownDatatypes(iSelectFixedIdMessageType, iSelectAny, iSelectDatatype, btns, yukon_state);
                });
            });


            setTimeout(() => refreshKnownDatatypes(iSelectFixedIdMessageType, iSelectAny, iSelectDatatype, btns, yukon_state), 3000);
            function getCurrentDesiredDatatypeAndSubjectId() {
                if (inputUseComplexSelection.checked === false) {
                    return { "subject_id": subject_id_display.value, "datatype": select.value };
                } else if (rbUseSelectAdvertised.checked) {
                    return { "subject_id": subject_id_display.value, "datatype": iSelectDatatype.value };
                } else if (rbUseSelectFixedId.checked) {
                    return { "subject_id": subject_id_display.value, "datatype": iSelectFixedIdMessageType.value };
                } else if (rbUseSelectAny.checked) {
                    return { "subject_id": subject_id_display.value, "datatype": iSelectAny.value };
                } else if (rbUseManualDatatypeEntry.checked) {
                    return {
                        "subject_id": subject_id_display.value, "datatype": iManualDatatypeEntry.value
                    };
                } else {
                    return null;
                }
            }
            list_of_subscription_getters.push(getCurrentDesiredDatatypeAndSubjectId);
        }

        const subscribeButton = document.createElement("button");
        subscribeButton.classList.add("btn", "btn-primary", "btn-sm");
        subscribeButton.innerText = "Subscribe";
        subscribeButton.addEventListener("click", async () => {
            subscribeCallback(isSynchronous, subscriptionElement, list_of_subscription_getters, settings, subscriptionsDiv, yukon_state);
        });
        createSubscriptionElementCloseButton(subscriptionElement, subscription, yukon_state);
        subscriptionElement.appendChild(subscribeButton);
        subscriptionsDiv.appendChild(subscriptionElement);
        setTimeout(() => {
            if (yukon_state.monitor2shouldScrollWhenNewSubscribeFrame) {
                yukon_state.monitor2ContainerElement.scrollLeft = yukon_state.monitor2ContainerElement.scrollWidth;
                yukon_state.monitor2ContainerElement.scrollTop = 0;
                yukon_state.monitor2shouldScrollWhenNewSubscribeFrame = false;
            }
        }, 100)
    }
}
// This function is called when the user clicks the "Subscribe" button
async function subscribeCallback(isSynchronous, subscriptionElement, list_of_subscription_getters, settings, subscriptionsDiv, yukon_state) {
    if (isSynchronous) {
        let specifiers = [];
        for (const getter of list_of_subscription_getters) {
            const infoObject = getter();
            const subject_id = infoObject.subject_id;
            const datatype = infoObject.datatype;
            specifiers.push(subject_id + ":" + datatype);
        }
        const response = await yukon_state.zubax_apij.subscribe_synchronized(JSON.stringify(specifiers));
        if (response.success) {
            if (response.message && response.message.length > 0) {
                console.log("A message was returned as a response to the subscription request: " + response.message);
            }
            // Remove subscriptionElement
            subscriptionElement.parentElement.removeChild(subscriptionElement);
            console.log("Subscribed to " + response.specifiers);
            console.log("Used tolerance: " + response.tolerance);
        } else {
            console.log("The sync subscription request failed")
            if (response.message && response.message.length > 0) {
                console.error("A message was returned as a response to the subscription request: " + response.message);
            }
        }
    } else {
        const infoObject = list_of_subscription_getters[0]();
        const subject_id = infoObject.subject_id;
        const datatype = infoObject.datatype;
        if (!datatype) {
            console.error("No datatype selected");
            return;
        }

        const response = await yukon_state.zubax_apij.subscribe(subject_id, datatype);
        if (response.success) {
            yukon_state.subscription_specifiers.specifiers.push(subject_id + ":" + datatype);
            // Remove subscriptionElement
            subscriptionElement.parentElement.removeChild(subscriptionElement);
            await drawSubscriptions(subscriptionsDiv, settings, yukon_state);
        } else {
            console.error("Failed to subscribe: " + response.message);
        }
    }
}
function createSubscriptionElementCloseButton(subscriptionElement, subscription, yukon_state) {
    // Add a close button to the subscriptionElement, align it 0.5 em from the right and 0.5 em from the top
    // When clicked it should remove the subscriptionElement from the DOM and remove the subscription specifier from the yukon_state.subscriptions_being_set_up
    const closeButton = createCloseButton();
    closeButton.addEventListener("click", () => {
        subscriptionElement.parentElement.removeChild(subscriptionElement);
        if (subscription) {
            yukon_state.subscriptions_being_set_up = yukon_state.subscriptions_being_set_up.filter(subscription2 => subscription2 !== subscription);
        }
        // Add a header saying "This is a pending subscription, confirm it by selecting a datatype and clicking the button below"
    });
    subscriptionElement.appendChild(closeButton);
}
function addComplexSelectionComponents(subscription, divComplexSelection) {
    const labelUseManualDatatypeEntry = document.createElement('label');
    labelUseManualDatatypeEntry.innerHTML = "Type any datatype";
    divComplexSelection.appendChild(labelUseManualDatatypeEntry);
    const divUseManualDatatypeEntry = document.createElement('div');
    divUseManualDatatypeEntry.classList.add('mb-3');
    divUseManualDatatypeEntry.classList.add('input-group');
    const divUseManualDatatypeEntryText = document.createElement('div');
    divUseManualDatatypeEntryText.classList.add('input-group-text');

    const rbUseManualDatatypeEntry = document.createElement('input');
    rbUseManualDatatypeEntry.classList.add('form-check-input');
    rbUseManualDatatypeEntry.classList.add('mt-0');
    rbUseManualDatatypeEntry.type = 'radio';
    rbUseManualDatatypeEntry.value = '';
    rbUseManualDatatypeEntry.id = "rbUseManualDatatypeEntry:" + subscription.subject_id;
    rbUseManualDatatypeEntry.name = "rbUseSelect" + subscription.subject_id;
    divUseManualDatatypeEntryText.appendChild(rbUseManualDatatypeEntry);
    divUseManualDatatypeEntry.appendChild(divUseManualDatatypeEntryText);

    const iManualDatatypeEntry = document.createElement('input');
    iManualDatatypeEntry.classList.add('form-control');
    iManualDatatypeEntry.type = 'text';
    iManualDatatypeEntry.id = "iManualDatatypeEntry:" + subscription.subject_id;
    divUseManualDatatypeEntry.appendChild(iManualDatatypeEntry);
    divComplexSelection.appendChild(divUseManualDatatypeEntry);
    labelUseManualDatatypeEntry.htmlFor = rbUseManualDatatypeEntry.id;

    const labelUseSelectAdvertised = document.createElement('label');
    labelUseSelectAdvertised.innerHTML = "Select a datatype from the list of advertised datatypes";
    divComplexSelection.appendChild(labelUseSelectAdvertised);
    const divUseSelectAdvertised = document.createElement('div');
    divUseSelectAdvertised.classList.add('mb-3');
    divUseSelectAdvertised.classList.add('input-group');
    const divUseSelectAdvertisedText = document.createElement('div');
    divUseSelectAdvertisedText.classList.add('input-group-text');

    const rbUseSelectAdvertised = document.createElement('input');
    rbUseSelectAdvertised.classList.add('form-check-input');
    rbUseSelectAdvertised.classList.add('mt-0');
    rbUseSelectAdvertised.type = 'radio';
    rbUseSelectAdvertised.value = '';
    rbUseSelectAdvertised.id = "rbUseSelectAdvertised:" + subscription.subject_id;
    rbUseSelectAdvertised.name = "rbUseSelect" + subscription.subject_id;
    divUseSelectAdvertisedText.appendChild(rbUseSelectAdvertised);
    divUseSelectAdvertised.appendChild(divUseSelectAdvertisedText);

    const iSelectDatatype = document.createElement('select');
    iSelectDatatype.id = "iSelectAdvertised:" + subscription.subject_id;
    iSelectDatatype.classList.add('form-select');
    divUseSelectAdvertised.appendChild(iSelectDatatype);

    const btnRefresh1 = document.createElement('button');
    btnRefresh1.classList.add('btn');
    btnRefresh1.classList.add('btn-outline-secondary');
    btnRefresh1.type = 'button';
    btnRefresh1.id = "btnRefresh1:" + subscription.subject_id;
    btnRefresh1.innerHTML = "Refresh";
    divUseSelectAdvertised.appendChild(btnRefresh1);
    divComplexSelection.appendChild(divUseSelectAdvertised);
    labelUseSelectAdvertised.htmlFor = rbUseSelectAdvertised.id;

    const labelUseSelectFixedId = document.createElement('label');
    labelUseSelectFixedId.innerHTML = "Select a datatype from the list of fixed IDs";
    divComplexSelection.appendChild(labelUseSelectFixedId);
    const divUseSelectFixedId = document.createElement('div');
    divUseSelectFixedId.classList.add('mb-3');
    divUseSelectFixedId.classList.add('input-group');
    const divUseSelectFixedIdText = document.createElement('div');
    divUseSelectFixedIdText.classList.add('input-group-text');

    const rbUseSelectFixedId = document.createElement('input');
    rbUseSelectFixedId.classList.add('form-check-input');
    rbUseSelectFixedId.classList.add('mt-0');
    rbUseSelectFixedId.type = 'radio';
    rbUseSelectFixedId.value = '';
    rbUseSelectFixedId.id = "rbUseSelectFixedId:" + subscription.subject_id;
    rbUseSelectFixedId.name = "rbUseSelect" + subscription.subject_id;
    divUseSelectFixedIdText.appendChild(rbUseSelectFixedId);
    divUseSelectFixedId.appendChild(divUseSelectFixedIdText);

    const iSelectFixedIdMessageType = document.createElement('select');
    iSelectFixedIdMessageType.id = "iSelectFixedId:" + subscription.subject_id;
    iSelectFixedIdMessageType.classList.add('form-select');
    divUseSelectFixedId.appendChild(iSelectFixedIdMessageType);

    const btnRefresh2 = document.createElement('button');
    btnRefresh2.classList.add('btn');
    btnRefresh2.classList.add('btn-outline-secondary');
    btnRefresh2.type = 'button';
    btnRefresh2.id = "btnRefresh2:" + subscription.subject_id;
    btnRefresh2.innerHTML = "Refresh";
    divUseSelectFixedId.appendChild(btnRefresh2);
    labelUseSelectFixedId.htmlFor = rbUseSelectFixedId.id;
    divComplexSelection.appendChild(divUseSelectFixedId);

    const divUseSelectAny = document.createElement('div');
    divUseSelectAny.classList.add('mb-3');
    divUseSelectAny.classList.add('input-group');
    const divUseSelectAnyText = document.createElement('div');
    divUseSelectAnyText.classList.add('input-group-text');

    const rbUseSelectAny = document.createElement('input');
    rbUseSelectAny.classList.add('form-check-input');
    rbUseSelectAny.classList.add('mt-0');
    rbUseSelectAny.type = 'radio';
    rbUseSelectAny.value = '';
    rbUseSelectAny.id = "rbUseSelectAny:" + subscription.subject_id;
    rbUseSelectAny.name = "rbUseSelect" + subscription.subject_id;
    divUseSelectAnyText.appendChild(rbUseSelectAny);
    divUseSelectAny.appendChild(divUseSelectAnyText);

    const iSelectAny = document.createElement('select');
    iSelectAny.id = "iSelectAny:" + subscription.subject_id;
    iSelectAny.classList.add('form-select');
    divUseSelectAny.appendChild(iSelectAny);

    const btnRefresh3 = document.createElement('button');
    btnRefresh3.classList.add('btn');
    btnRefresh3.classList.add('btn-outline-secondary');
    btnRefresh3.type = 'button';
    btnRefresh3.id = "btnRefresh3:" + subscription.subject_id;
    btnRefresh3.innerHTML = "Refresh";
    divUseSelectAny.appendChild(btnRefresh3);
    divComplexSelection.appendChild(divUseSelectAny);
    const labelUseSelectAny = document.createElement('label');
    labelUseSelectAny.htmlFor = rbUseSelectAny.id;
    labelUseSelectAny.innerHTML = "Select any found DSDL datatype";
    divComplexSelection.appendChild(labelUseSelectAny);
    return [rbUseManualDatatypeEntry, rbUseSelectAny, rbUseSelectFixedId, rbUseSelectAdvertised, iSelectDatatype, iSelectFixedIdMessageType, iSelectAny, iManualDatatypeEntry, btnRefresh1, btnRefresh2, btnRefresh3]
}