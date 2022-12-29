import { getDatatypesForPort, getKnownDatatypes } from "../../utilities.module.js";
async function fetch(specifier, pLatestMessage, inputLogToConsole, fetchIntervalId, lastCurrentMessagesLength, yukon_state) {
    const current_messages = yukon_state.subscriptions[specifier];
    const full_specifiers = [specifier + ":" + yukon_state.subscriptions[specifier].length];
    const result = await yukon_state.zubax_apij.fetch_messages_for_subscription_specifiers(JSON.stringify(full_specifiers));
    const messages = result[Object.keys(result)[0]]
    if (lastCurrentMessagesLength.value === current_messages.length + messages.length) {
        return;
    } else {
        lastCurrentMessagesLength.value = current_messages.length + messages.length;
    }
    if (!messages) {
        clearInterval(fetchIntervalId.value);
        header2.innerText = "This subscription has been terminated by the server";
        return;
    }
    for (const message of messages) {
        if (inputLogToConsole.checked) {
            yukon_state.zubax_apij.add_local_message(JSON.stringify(message.message), 20)
        }
        current_messages.push(message);
    }
    const lastMessageObject = current_messages[current_messages.length - 1];
    if (!lastMessageObject) {
        return;
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
    } else {
        pLatestMessage.innerHTML = yaml_text;
    }
}
async function fetchForSync(specifiersString, pLatestMessage, fetchIntervalId, lastCurrentMessagesLength, settings, yukon_state) {
    const result = await yukon_state.zubax_apij.fetch_synchronized_messages_for_specifiers(specifiersString, lastCurrentMessagesLength.value);
    if (!result || result.error) {
        clearInterval(fetchIntervalId.value);
        pLatestMessage.innerText = "This subscription has been terminated by the server";
        return;
    }
    let current_messages = yukon_state.subscriptions[specifiersString];
    let messages = result;
    if (lastCurrentMessagesLength.value === current_messages.length + messages.length) {
        return;
    } else {
        lastCurrentMessagesLength.value = current_messages.length + messages.length;
    }
    const json_object = result[result.length - 1];
    if (!json_object) {
        return;
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
    } else {
        pLatestMessage.innerHTML = yaml_text;
    }
}
function fillExistingDivs(existing_divs, existing_specifiers, subscriptionsDiv, yukon_state) {
    for (const child of subscriptionsDiv.children) {
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
        const datatype_full = response["fixed_id_messages"][id]["full_name"];
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
        option.value = datatype;
        option.innerHTML = datatype;
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
    pLatestMessage.style.marginBottom = "0";
    pLatestMessage.innerText = "Yet to receive messages...";
    subscriptionElement.appendChild(pLatestMessage);

    const divLogToConsole = document.createElement('div');
    divLogToConsole.classList.add('form-check');
    const inputLogToConsole = document.createElement('input');
    inputLogToConsole.classList.add('form-check-input');
    inputLogToConsole.classList.add('checkbox');
    inputLogToConsole.type = 'checkbox';
    inputLogToConsole.id = "inputLogToConsole" + subject_id + ":" + datatype;
    divLogToConsole.appendChild(inputLogToConsole);
    const labelLogToConsole = document.createElement('label');
    labelLogToConsole.classList.add('form-check-label');
    labelLogToConsole.htmlFor = inputLogToConsole.id;
    labelLogToConsole.innerHTML = "Log to console";
    divLogToConsole.appendChild(labelLogToConsole);
    subscriptionElement.appendChild(divLogToConsole);

    // Add a button for opening logs
    const openLogsButton = document.createElement("button");
    openLogsButton.innerText = "Open logs, when open CTRL+R to reload";
    const openLogsHandler = async () => {
        // Open a new tab at http://localhost:5000/api/get_all_subscription_messages?message_specifier=subject_id:datatype
        const url = "http://localhost:5000/api/get_all_subscription_messages?message_specifier=" + specifier;
        window.open(url, '_blank');
    };
    openLogsButton.addEventListener("click", openLogsHandler);
    subscriptionElement.appendChild(openLogsButton);

    // Add a button for opening logs
    const openLatestMessage = document.createElement("button");
    openLatestMessage.innerText = "Open latest message, when open CTRL+R to reload";
    const openLatestHandler = async () => {
        // Open a new tab at http://localhost:5000/api/get_all_subscription_messages?message_specifier=subject_id:datatype
        const url = "http://localhost:5000/api/get_latest_subscription_message?message_specifier=" + specifier;
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
            console.error("Failed to unsubscribe: " + response.error);
        }
    };

    // // Add a button for unsubscribing
    // const unsubscribeButton = document.createElement("button");
    // unsubscribeButton.innerText = "Unsubscribe";
    // unsubscribeButton.addEventListener("click", unsubscribeHandler);
    // subscriptionElement.appendChild(unsubscribeButton);

    subscriptionElement.style.position = "relative";

    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.style.borderWidth = "1";
    closeButton.style.position = "absolute";
    closeButton.style.right = "0.5em";
    closeButton.style.top = "0";
    closeButton.addEventListener("click", unsubscribeHandler);
    subscriptionElement.appendChild(closeButton);
    if (!yukon_state.subscriptions[specifier]) {
        yukon_state.subscriptions[specifier] = [];
    }
    const current_messages = yukon_state.subscriptions[specifier];
    let fetchIntervalId = { value: null };
    let lastCurrentMessagesLength = { value: 0 };
    fetchIntervalId.value = setInterval(() => fetch(specifier, pLatestMessage, inputLogToConsole, fetchIntervalId, lastCurrentMessagesLength, yukon_state), 300);
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
    pLatestMessage.style.marginBottom = "0";
    pLatestMessage.innerText = "Yet to receive messages...";
    subscriptionElement.appendChild(pLatestMessage);
    subscriptionsDiv.appendChild(subscriptionElement);
    let fetchIntervalId = { value: null };
    const unsubscribeHandler = async () => {
        const response = await yukon_state.zubax_apij.unsubscribe_synchronized(specifiersString);
        if (response.success) {
            const specifiers_length = yukon_state.sync_subscription_specifiers.specifiers.length;
            yukon_state.sync_subscription_specifiers.specifiers = yukon_state.sync_subscription_specifiers.specifiers.filter((specifier_) => { return specifier_ !== specifiersString; });
            // Make sure that something was actually removed
            console.assert(specifiers_length === yukon_state.sync_subscription_specifiers.specifiers.length + 1);
            clearInterval(fetchIntervalId.value);
            await drawSubscriptions(subscriptionsDiv, settings, yukon_state);
        } else {
            console.error("Failed to unsubscribe: " + response.error);
        }
    };
    // Add a button for unsubscribing
    // const unsubscribeButton = document.createElement("button");
    // unsubscribeButton.innerText = "Unsubscribe";
    // unsubscribeButton.addEventListener("click", unsubscribeHandler);
    // subscriptionElement.appendChild(unsubscribeButton);
    subscriptionElement.style.position = "relative";

    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.style.borderWidth = "1";
    closeButton.style.position = "absolute";
    closeButton.style.right = "0.5em";
    closeButton.style.top = "0";
    closeButton.addEventListener("click", unsubscribeHandler);
    subscriptionElement.appendChild(closeButton);
    if (!yukon_state.subscriptions[specifiersString]) {
        yukon_state.subscriptions[specifiersString] = [];
    }

    let lastCurrentMessagesLength = { value: 0 };
    fetchIntervalId.value = setInterval(() => fetchForSync(specifiersString, pLatestMessage, fetchIntervalId, lastCurrentMessagesLength, settings, yukon_state), 300);
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
            const subject_id_display = document.createElement("h3");
            subject_id_display.innerText = subject1Nr;
            subscriptionElement.appendChild(subject_id_display);
            const select = document.createElement("select");
            const datatypesOfPort = await getDatatypesForPort(subject1Nr, yukon_state);
            for (const datatype of datatypesOfPort) {
                const option = document.createElement("option");
                option.value = datatype;
                option.innerText = datatype;
                select.appendChild(option);
            }
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
            inputUseComplexSelection.id = "inputUseComplexSelection:" + subject1Nr;
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
            divComplexSelection.id = "divComplexSelection:" + subject1Nr;
            subscriptionElement.appendChild(divComplexSelection);

            let [rbUseManualDatatypeEntry, rbUseSelectAny, rbUseSelectFixedId, rbUseSelectAdvertised, iSelectDatatype, iSelectFixedIdMessageType,
                iSelectAny, iManualDatatypeEntry, btnRefresh1, btnRefresh2, btnRefresh3] = addComplexSelectionComponents({ subject1Nr }, divComplexSelection);


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
                    await refreshKnownDatatypes();
                });
            });


            setTimeout(() => refreshKnownDatatypes(iSelectFixedIdMessageType, iSelectAny, iSelectDatatype, btns, yukon_state), 3000);
            function getCurrentDesiredDatatypeAndSubjectId() {
                if (inputUseComplexSelection.checked === false) {
                    return { "subject_id": subject1Nr, "datatype": select.value };
                } else if (rbUseSelectAdvertised.checked) {
                    return { "subject_id": subject1Nr, "datatype": iSelectDatatype.value };
                } else if (rbUseSelectFixedId.checked) {
                    return { "subject_id": subject1Nr, "datatype": iSelectFixedIdMessageType.value };
                } else if (rbUseSelectAny.checked) {
                    return { "subject_id": subject1Nr, "datatype": iSelectAny.value };
                } else if (rbUseManualDatatypeEntry.checked) {
                    return {
                        "subject_id": subject1Nr, "datatype": iManualDatatypeEntry.value
                    };
                } else {
                    return null;
                }
            }
            list_of_subscription_getters.push(getCurrentDesiredDatatypeAndSubjectId);
        }

        const subscribeButton = document.createElement("button");
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
            console.error("Failed to subscribe: " + response.error);
        }
    }
}
function createSubscriptionElementCloseButton(subscriptionElement, subscription, yukon_state) {
    // Add a close button to the subscriptionElement, align it 0.5 em from the right and 0.5 em from the top
    // When clicked it should remove the subscriptionElement from the DOM and remove the subscription specifier from the yukon_state.subscriptions_being_set_up
    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.style.borderWidth = "1";
    closeButton.style.position = "absolute";
    closeButton.style.right = "0.5em";
    closeButton.style.top = "0";
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
    rbUseManualDatatypeEntry.name = "rbUseSelect";
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
    rbUseSelectAdvertised.name = "rbUseSelect";
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
    rbUseSelectFixedId.name = "rbUseSelect";
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
    rbUseSelectAny.name = "rbUseSelect";
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