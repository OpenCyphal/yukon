import { areThereAnyNewOrMissingHashes, updateLastHashes } from "../hash_checks.module.js";
import { getRelatedLinks } from "../meanings.module.js";
import { waitForElm, getKnownDatatypes } from "../utilities.module.js";
import {
    getHoveredContainerElementAndContainerObject,
    secondsToColonSeparatedString,
    getDatatypesForPort
} from "../utilities.module.js";

const settings = {};
function fillSettings(yukon_state) {
    settings.VerticalLineMarginTop = 3;
    settings.PageMarginTop = 20;
    settings.NodeXOffset = 20;
    settings.DistancePerHorizontalConnection = yukon_state.all_settings["Monitor view"]["Distance per horizontal connection"];
    settings.DistanceBetweenNodes = 2;
    settings.NodeWidth = yukon_state.all_settings["Monitor view"]["Node width"];
    settings.AvatarMinHeight = 50;
    settings.AvatarConnectionPadding = 20;
    settings.LinkInfoWidth = yukon_state.all_settings["Monitor view"]["Link info width"];
    settings.PubLineXOffset = settings.NodeXOffset + settings.NodeWidth + settings.LinkInfoWidth + 20;
    settings.DistanceBetweenLines = yukon_state.all_settings["Monitor view"]["Distance between vertical lines"];
    settings.HorizontalColliderHeight = 17;
    settings.HorizontalColliderOffsetY = (settings.HorizontalColliderHeight - 1) / 2
    settings.HorizontalLabelOffsetY = 20;
    settings.HorizontalPortLabelOffsetY = 10;
    settings.HorizontalLineWidth = yukon_state.all_settings["Monitor view"]["Horizontal line width"];
    settings.VerticalLineWidth = yukon_state.all_settings["Monitor view"]["Vertical line width"];
    settings.LabelLeftMargin = 12;
    settings.VerticalColliderWidth = 9;
    settings.LinkLabelColor = "transparent";
    settings.LinkLabelTextColor = "black";
    settings.LinkLabelHighlightColor = "black";
    settings.LinkLabelHighlightTextColor = "white";
    settings.ServicePortLabelBgColor = "lightblue";
    settings.ServicePortLabelColor = "black";
    // Add random shades of orange to the list
    settings.HighlightColorsRaw = yukon_state.all_settings["Monitor view"]["Highlight colors"];
    settings.HighlightColors = [];
    settings.SubscriptionsOffset = null;
    settings.SubscriptionsVerticalOffset = settings.PageMarginTop;
    settings.SubscriptionsVerticalSpacing = 20;
    settings.ShowLinkNameOnSeparateLine = yukon_state.all_settings["Monitor view"]["Show link name below horizontal lines"]
    if (settings.ShowLinkNameOnSeparateLine) {
        settings.DistancePerHorizontalConnection = settings.DistancePerHorizontalConnection * 2;
        settings.LinkNameOffset = -3;
        if (yukon_state.all_settings["Monitor view"]["Show name above datatype"]) {
            settings.ShowNameAboveDatatype = true;
        }
    }
    // Use a for loop to generate the structure
    for (const color of settings.HighlightColorsRaw) {
        settings.HighlightColors.push({ color: color, taken: false });
    }
}


let linesByPortAndPortType = [];
function pickHighlightColor(objects) {
    for (const color of settings.HighlightColors) {
        if (color.taken === false) {
            color.taken = true;
            for (const object of objects) {
                object.takenColor = color;
            }
            return color.color;
        }
    }
    return "red";
}
function highlightElement(element, color) {
    if (element.classList.contains("arrowhead")) {
        element.style.setProperty("border-top", "7px solid " + color);
    } else if (element.classList.contains("horizontal_line_label") && element.tagName === "LABEL") {
        element.style.setProperty("background-color", settings.LinkLabelHighlightColor);
        element.style.setProperty("color", settings.LinkLabelHighlightTextColor);
    } else if (element.classList.contains("horizontal_line") || element.classList.contains("line")) {
        element.style.setProperty("background-color", color);
    }
}
function highlightElements(objects) {
    const pickedHighlightColor = pickHighlightColor(objects);
    for (const object of objects) {
        highlightElement(object.element, pickedHighlightColor);
    }
}
function removeHighlightsFromObjects(objects) {
    for (const object of objects) {
        object.toggledOn.value = false;
        if (object.takenColor) {
            const takenColor = settings.HighlightColors.find((color) => { return color.color === object.takenColor.color; });
            takenColor.taken = false;
        }
        removeHighlightFromElement(object.element);
    }
}
function removeHighlightFromElement(element) {
    if (element.classList.contains("arrowhead")) {
        element.style.setProperty("border-top", "7px solid pink");
    } else if (element.classList.contains("horizontal_line_label") && element.tagName === "LABEL") {
        element.style.setProperty("background-color", settings.LinkLabelColor);
        element.style.setProperty("color", settings.LinkLabelTextColor);
    } else if (element.classList.contains("horizontal_line") || element.classList.contains("line")) {
        element.style.removeProperty("background-color");
    }
}
function unhighlightAll() {
    for (const object of linesByPortAndPortType) {
        object.toggledOn.value = false;
        if (object.takenColor) {
            const takenColor = settings.HighlightColors.find((color) => { return color.color === object.takenColor.color; });
            takenColor.taken = false;
        }
        removeHighlightFromElement(object.element);
    }
}
export function makeSimpleSubscriptionFrame(port_nr, yukon_state) {
    const frame = document.createElement("div");
    frame.classList.add("simple_subscription_frame");
    // Look through publishers on this port and see what the most common published datatype is, then use that to fill in a select input
    // Also take the `const response = await yukon_state.zubax_apij.get_known_datatypes_from_dsdl();` and use it to fill in the select input

    return frame;
}
async function drawSubscriptions(subscriptionsDiv, yukon_state) {
    if (settings.SubscriptionsOffset === null) {
        // Subscriptions cannot be drawn currently before any nodes and ports have been drawn
        return;
    }
    const existing_specifiers = {};
    for (const specifier of yukon_state.subscription_specifiers.specifiers) {
        existing_specifiers[specifier] = true;
    }
    const existing_divs = {};
    let height_of_existing_divs = settings.PageMarginTop;
    for (const child of subscriptionsDiv.children) {
        const specifier = child.getAttribute("data-specifier");
        const isBeingSetup = child.getAttribute("data-is-being-setup");
        const isExisting = existing_specifiers[specifier];
        if (!isExisting && !isBeingSetup) {
            child.parentElement.removeChild(child);
        } else {
            existing_divs[specifier] = true;
            height_of_existing_divs += child.scrollHeight + settings.SubscriptionsVerticalSpacing;
        }
    }
    let vertical_offset_counter = height_of_existing_divs || settings.SubscriptionsVerticalOffset;
    if (!yukon_state.subscription_specifiers) {
        return;
    }
    const subscriptionElementsToBePlaced = [];
    for (const specifier of yukon_state.subscription_specifiers.specifiers) {
        if (existing_divs[specifier]) {
            continue;
        }
        const subject_id = specifier.split(":")[0];
        const datatype = specifier.split(":")[1];
        console.log("Drawing subscription specifier", specifier);
        const subscriptionElement = document.createElement("div");
        const header1 = document.createElement("h3");
        header1.innerText = specifier;
        subscriptionElement.appendChild(header1);
        const header2 = document.createElement("h3");
        header2.innerText = "This is an active subscription";
        subscriptionElement.appendChild(header2);
        subscriptionElement.classList.add("subscription");
        subscriptionElement.setAttribute("data-specifier", specifier);
        const pLatestMessage = document.createElement("p");
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

        // Add a button for unsubscribing
        const unsubscribeButton = document.createElement("button");
        unsubscribeButton.innerText = "Unsubscribe";
        unsubscribeButton.addEventListener("click", async () => {
            const response = await yukon_state.zubax_apij.unsubscribe(specifier);
            if (response.success) {
                yukon_state.subscription_specifiers.specifiers = yukon_state.subscription_specifiers.specifiers.filter((specifier_) => { return specifier_ !== specifier; });
                await drawSubscriptions(subscriptionsDiv, yukon_state);
            } else {
                console.error("Failed to unsubscribe: " + response.error);
            }
        });
        if (!yukon_state.subscriptions[specifier]) {
            yukon_state.subscriptions[specifier] = [];
        }
        const current_messages = yukon_state.subscriptions[specifier];
        let fetchIntervalId = null;
        async function fetch() {
            const full_specifiers = [specifier + ":" + current_messages.length];
            const result = await yukon_state.zubax_apij.fetch_messages_for_subscription_specifiers(JSON.stringify(full_specifiers));
            const messages = result[Object.keys(result)[0]]
            if (!messages) {
                clearInterval(fetchIntervalId);
                header2.innerText = "This subscription has been terminated by the server";
                return;
            }
            for (const message of messages) {
                if (inputLogToConsole.checked) {
                    yukon_state.zubax_apij.add_local_message(JSON.stringify(message.message), 20)
                }
                current_messages.push(message);
            }
            pLatestMessage.innerHTML = JSON.stringify(current_messages[current_messages.length - 1]);
        }

        fetchIntervalId = setInterval(fetch, 300);
        subscriptionElement.appendChild(unsubscribeButton);
        subscriptionElementsToBePlaced.push([subscriptionElement, specifier]);
        subscriptionsDiv.appendChild(subscriptionElement);
    }
    for (const [subscriptionElement, specifier] of subscriptionElementsToBePlaced) {
        subscriptionElement.style.top = vertical_offset_counter + "px";
        vertical_offset_counter += subscriptionElement.scrollHeight + settings.SubscriptionsVerticalSpacing;
    }
    for (const subscription of yukon_state.subscriptions_being_set_up) {
        if (subscription.element) {
            continue;
        }
        // Add a div with a select input for the datatype and a button for subscribing
        const subscriptionElement = document.createElement("div");
        subscription.element = subscriptionElement;
        // Create a h3 for subscription.subject_id
        const subject_id_display = document.createElement("h3");
        subject_id_display.innerText = subscription.subject_id;
        subscriptionElement.appendChild(subject_id_display);
        const header = document.createElement("h3");
        header.innerText = "This is a pending subscription, confirm it by selecting a datatype and clicking the button below";
        subscriptionElement.appendChild(header);
        subscriptionElement.classList.add("subscription");
        subscriptionElement.setAttribute("data-is-being-setup", "true");
        const select = document.createElement("select");
        const datatypesOfPort = await getDatatypesForPort(subscription.subject_id, yukon_state);
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
        inputUseComplexSelection.id = "inputUseComplexSelection:" + subscription.subject_id + ":" + subscription.datatype;
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
        divComplexSelection.id = "divComplexSelection:" + subscription.subject_id + ":" + subscription.datatype;
        subscriptionElement.appendChild(divComplexSelection);


        /* Create this structure in subscriptionElement:
        <label for="rbUseManualDatatypeEntry">Type any datatype</label>
    <div class="mb-3 input-group">
        <div class="input-group-text">
            <input class="form-check-input mt-0" type="radio" value=""
                aria-label="Radio button for following text input" id="rbUseManualDatatypeEntry" name="rbUseSelect">
        </div>
        <input id="iManualDatatypeEntry" class="form-control" type="text">
    </div>
    <label for="rbUseSelectAdvertised">Select any datatype advertised in .type registers</label>
    <div class="mb-3 input-group">
        <div class="input-group-text">
            <input class="form-check-input mt-0" type="radio" value=""
                aria-label="Radio button for following text input" id="rbUseSelectAdvertised" name="rbUseSelect">
        </div>
        <select id="iSelectDatatype" class="form-select"></select>
        <button class="btn btn-outline-secondary" type="button" id="btnRefresh1">Refresh</button>
    </div>
    <label for="rbUseSelectFixedId">Select a fixed ID message type</label>
    <div class="mb-3 input-group">
        <div class="input-group-text">
            <input class="form-check-input mt-0" type="radio" value=""
                aria-label="Radio button for following text input" id="rbUseSelectFixedId" name="rbUseSelect">
        </div>
        <input type="text" class="form-control" placeholder="Optional nid filter"
            title="Optional filter that will only show messages from this node id, this filter can be modified and doesn't affect the subscription"
            aria-label="Node id" id="iFixedIdSubscriptionNodeId">
        <select id="iSelectFixedIdMessageType" class="form-select"></select>
        <button class="btn btn-outline-secondary" type="button" id="btnRefresh2">Refresh</button>
    </div>

        */
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
        rbUseManualDatatypeEntry.id = "rbUseManualDatatypeEntry:" + subscription.subject_id + ":" + subscription.datatype;
        rbUseManualDatatypeEntry.name = "rbUseSelect";
        divUseManualDatatypeEntryText.appendChild(rbUseManualDatatypeEntry);
        divUseManualDatatypeEntry.appendChild(divUseManualDatatypeEntryText);
        const iManualDatatypeEntry = document.createElement('input');
        iManualDatatypeEntry.classList.add('form-control');
        iManualDatatypeEntry.type = 'text';
        iManualDatatypeEntry.id = "iManualDatatypeEntry:" + subscription.subject_id + ":" + subscription.datatype;
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
        rbUseSelectAdvertised.id = "rbUseSelectAdvertised:" + subscription.subject_id + ":" + subscription.datatype;
        rbUseSelectAdvertised.name = "rbUseSelect";
        divUseSelectAdvertisedText.appendChild(rbUseSelectAdvertised);
        divUseSelectAdvertised.appendChild(divUseSelectAdvertisedText);
        const iSelectDatatype = document.createElement('select');
        iSelectDatatype.id = "iSelectAdvertised:" + subscription.subject_id + ":" + subscription.datatype;
        iSelectDatatype.classList.add('form-select');
        divUseSelectAdvertised.appendChild(iSelectDatatype);
        const btnRefresh1 = document.createElement('button');
        btnRefresh1.classList.add('btn');
        btnRefresh1.classList.add('btn-outline-secondary');
        btnRefresh1.type = 'button';
        btnRefresh1.id = "btnRefresh1:" + subscription.subject_id + ":" + subscription.datatype;
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
        rbUseSelectFixedId.id = "rbUseSelectFixedId:" + subscription.subject_id + ":" + subscription.datatype;
        rbUseSelectFixedId.name = "rbUseSelect";
        divUseSelectFixedIdText.appendChild(rbUseSelectFixedId);
        divUseSelectFixedId.appendChild(divUseSelectFixedIdText);
        const iSelectFixedIdMessageType = document.createElement('select');
        iSelectFixedIdMessageType.id = "iSelectFixedId:" + subscription.subject_id + ":" + subscription.datatype;
        iSelectFixedIdMessageType.classList.add('form-select');
        divUseSelectFixedId.appendChild(iSelectFixedIdMessageType);
        const btnRefresh2 = document.createElement('button');
        btnRefresh2.classList.add('btn');
        btnRefresh2.classList.add('btn-outline-secondary');
        btnRefresh2.type = 'button';
        btnRefresh2.id = "btnRefresh2:" + subscription.subject_id + ":" + subscription.datatype;
        btnRefresh2.innerHTML = "Refresh";
        divUseSelectFixedId.appendChild(btnRefresh2);
        labelUseSelectFixedId.htmlFor = rbUseSelectFixedId.id;
        divComplexSelection.appendChild(divUseSelectFixedId);


        // Create this HTML structure
        /* 
        <label for="rbUseSelectAny">Select any found DSDL datatype</label>
    <div class="mb-3 input-group">
        <div class="input-group-text">
            <input class="form-check-input mt-0" type="radio" value=""
                aria-label="Radio button for following text input" id="rbUseSelectAny" name="rbUseSelect">
        </div>
        <select id="iSelectAny" class="form-select"></select>
        <button class="btn btn-outline-secondary" type="button" id="btnRefresh3">Refresh</button>
    </div>*/
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
        rbUseSelectAny.id = "rbUseSelectAny:" + subscription.subject_id + ":" + subscription.datatype;
        rbUseSelectAny.name = "rbUseSelect";
        divUseSelectAnyText.appendChild(rbUseSelectAny);
        divUseSelectAny.appendChild(divUseSelectAnyText);
        const iSelectAny = document.createElement('select');
        iSelectAny.id = "iSelectAny:" + subscription.subject_id + ":" + subscription.datatype;
        iSelectAny.classList.add('form-select');
        divUseSelectAny.appendChild(iSelectAny);
        const btnRefresh3 = document.createElement('button');
        btnRefresh3.classList.add('btn');
        btnRefresh3.classList.add('btn-outline-secondary');
        btnRefresh3.type = 'button';
        btnRefresh3.id = "btnRefresh3:" + subscription.subject_id + ":" + subscription.datatype;
        btnRefresh3.innerHTML = "Refresh";
        divUseSelectAny.appendChild(btnRefresh3);
        divComplexSelection.appendChild(divUseSelectAny);
        const labelUseSelectAny = document.createElement('label');
        labelUseSelectAny.htmlFor = rbUseSelectAny.id;
        labelUseSelectAny.innerHTML = "Select any found DSDL datatype";
        divComplexSelection.appendChild(labelUseSelectAny);

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

        async function refreshKnownDatatypes() {
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
        setTimeout(refreshKnownDatatypes, 3000);

        function getCurrentDesiredDatatype() {
            if (rbUseSelectAdvertised.checked) {
                return iSelectDatatype.value;
            } else if (rbUseSelectFixedId.checked) {
                return iSelectFixedIdMessageType.value;
            } else if (rbUseSelectAny.checked) {
                return iSelectAny.value;
            } else if (rbUseManualDatatypeEntry.checked) {
                return iManualDatatypeEntry.value;
            } else {
                return null;
            }
        }

        const subscribeButton = document.createElement("button");
        subscribeButton.innerText = "Subscribe";
        subscribeButton.addEventListener("click", async () => {
            if (inputUseComplexSelection.checked) {
                const desiredDatatype = getCurrentDesiredDatatype();
                if (!desiredDatatype) {
                    console.error("No datatype selected");
                    return;
                }
                subscription.datatype = desiredDatatype;
            } else {
                subscription.datatype = select.value;
            }

            const response = await yukon_state.zubax_apij.subscribe(subscription.subject_id, subscription.datatype);
            if (response.success) {
                yukon_state.subscription_specifiers.specifiers.push(subscription.subject_id + ":" + subscription.datatype);
                // Remove subscriptionElement
                subscriptionElement.parentElement.removeChild(subscriptionElement);
                await drawSubscriptions(subscriptionsDiv, yukon_state);
            } else {
                console.error("Failed to subscribe: " + response.error);
            }
        });
        // Add a header saying "This is a pending subscription, confirm it by selecting a datatype and clicking the button below"

        subscriptionElement.appendChild(subscribeButton);
        subscriptionsDiv.appendChild(subscriptionElement);
        vertical_offset_counter += subscriptionElement.scrollHeight + settings.SubscriptionsVerticalSpacing;
    }
}
export async function setUpMonitor2Component(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const monitor2Div = await waitForElm("#monitor2", 7000);
    fillSettings(yukon_state);
    const subscriptionsOuterArea = containerElement.querySelector("#subscriptions-outer-area");
    const subscriptionsInnerArea = document.createElement("div");
    subscriptionsInnerArea.id = "subscriptions-inner-area";
    subscriptionsInnerArea.style.position = "absolute";
    subscriptionsOuterArea.appendChild(subscriptionsInnerArea);
    setInterval(async () => {
        if (settings.SubscriptionsOffset) {
            subscriptionsInnerArea.style.left = settings.SubscriptionsOffset + "px";
            subscriptionsInnerArea.style.top = settings.SubscriptionsVerticalOffset + "px";
            yukon_state.subscription_specifiers = await yukon_state.zubax_apij.get_current_available_subscription_specifiers();
            if (typeof yukon_state.subscription_specifiers_previous_hash === "undefined" || yukon_state.subscription_specifiers_previous_hash !== yukon_state.subscription_specifiers.hash) {
                await drawSubscriptions(subscriptionsInnerArea, yukon_state);
            }
            yukon_state.subscription_specifiers_previous_hash = yukon_state.subscription_specifiers_hash;
        } else {
            console.warn("Subscriptions offset is not set");
        }

    }, 1500);
    setInterval(async () => {
        await update_monitor2(containerElement, monitor2Div, yukon_state);
    }, 1000);
    let escape_timer = null;
    document.addEventListener('keydown', function (e) {
        if (e.code === "Escape") {
            const returnArray = getHoveredContainerElementAndContainerObject(yukon_state);
            const hoveredContainerObject = returnArray[1];
            if (!hoveredContainerObject || hoveredContainerObject.title !== "monitor2Component") {
                return;
            }
            if (escape_timer) {
                clearTimeout(escape_timer);
                escape_timer = null;
                unhighlightAll();
            } else {
                escape_timer = setTimeout(function () {
                    escape_timer = null;
                }, 400);
            }
        }
    });
    let posObject = { top: 0, left: 0, x: 0, y: 0 };
    const mouseDownHandler = function (e) {
        if (e.which !== 2) {
            return;
        }
        yukon_state.grabbing_in_monitor_view = true;
        e.preventDefault();
        containerElement.style.userSelect = 'none';
        containerElement.style.cursor = 'grabbing';
        posObject = {
            // The current scroll
            left: containerElement.scrollLeft,
            top: containerElement.scrollTop,
            // Get the current mouse position
            x: e.clientX,
            y: e.clientY,
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };
    const mouseMoveHandler = function (e) {
        // How far the mouse has been moved
        const dx = e.clientX - posObject.x;
        const dy = e.clientY - posObject.y;

        // Scroll the element
        containerElement.scrollTop = posObject.top - dy;
        containerElement.scrollLeft = posObject.left - dx;
    };
    const mouseUpHandler = function (e) {
        if (e.which !== 2) {
            return;
        }
        e.preventDefault();
        yukon_state.grabbing_in_monitor_view = false;
        containerElement.style.cursor = 'default';
        containerElement.style.removeProperty('user-select');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };
    document.addEventListener('mousedown', mouseDownHandler);
}
function isContainerPopulated(containerElement) {
    return containerElement.querySelectorAll(".node").length > 0;
}

function findRelatedObjects(port) {
    return linesByPortAndPortType.filter((line) => {
        return line.port === port;
    });
}

function compareAvatar(a, b) {
    if (a.node_id < b.node_id) {
        return -1;
    }
    if (a.node_id > b.node_id) {
        return 1;
    }
    return 0;
}
async function update_monitor2(containerElement, monitor2Div, yukon_state) {
    if (!areThereAnyNewOrMissingHashes("monitor2_hash", yukon_state)) {
        updateLastHashes("monitor2_hash", yukon_state);
        // If there are any elements in my_graph.elements() then we can return, otherwise we need to make a graph (below)
        if (isContainerPopulated(monitor2Div)) {
            return;
        }
    }
    updateLastHashes("monitor2_hash", yukon_state);
    // Clear the container
    monitor2Div.innerHTML = "";
    // Add all nodes
    let y_counter = settings["PageMarginTop"];
    let ports = [];
    for (const avatar of yukon_state.current_avatars) {
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                if (port === "") {
                    continue;
                }
                let alreadyExistingPorts = ports.filter(p => p.port === port && p.type === port_type);
                if (alreadyExistingPorts.length === 0) {
                    ports.push({ "type": port_type, "port": port, "x_offset": 0 });
                }
            }
        }
    }
    function comparePorts(a, b) {
        // Compare ports by type and port number (port) for sorting
        if (a.type < b.type) {
            return -1;
        }
        if (a.type > b.type) {
            return 1;
        }
        if (a.port < b.port) {
            return 1;
        }
        if (a.port > b.port) {
            return -1;
        }
        return 0;
    }
    ports.sort(comparePorts);
    let x_counter = settings["PubLineXOffset"];
    for (const port of ports) {
        if (port.type === "pub") {
            port.x_offset = x_counter;
            x_counter += settings["DistanceBetweenLines"];
        } else if (port.type === "srv") {
            port.x_offset = x_counter;
            x_counter += settings["DistanceBetweenLines"];
        } else if (port.type === "sub" && !ports.find(p => p.type === "pub" && p.port === port.port)) {
            port.x_offset = x_counter;
            x_counter += settings["DistanceBetweenLines"];
        }
    }
    for (const port of ports) {
        if (port.type === "sub") {
            let pub_port = ports.find(p => p.type === "pub" && p.port === port.port);
            if (pub_port !== undefined) {
                port.x_offset = pub_port.x_offset;
                port.auxiliary = true;
            }
        } else if (port.type === "cln") {
            let srv_port = ports.find(p => p.type === "srv" && p.port === port.port);
            if (srv_port !== undefined) {
                port.x_offset = srv_port.x_offset;
                port.auxiliary = true;
            }
        }
    }
    const datatypes_response = await yukon_state.zubax_apij.get_known_datatypes_from_dsdl();
    const avatars_copy = Array.from(yukon_state.current_avatars)
    avatars_copy.sort(compareAvatar);
    let nodesToBePositioned = [];
    for (const avatar of avatars_copy) {
        const node_id = avatar.node_id;
        const get_up_to_date_avatar = () => { return yukon_state.current_avatars.find(a => a.node_id === node_id); };
        // Add the sizes of ports.cln, ports.srv, ports.pub, ports.sub
        const node = addNode(avatar, "", monitor2Div, yukon_state);
        const fieldsObject = {
            "Name": avatar.name, "Health": avatar.last_heartbeat.health_text,
            "Software Version": avatar.versions.software_version,
            "Hardware Version": avatar.versions.hardware_version,
            "Uptime": secondsToColonSeparatedString(avatar.last_heartbeat.uptime),
            "Node ID": avatar.node_id
        };
        // Make a div for each: health, software_version, hardware_version, uptime
        for (const field of Object.keys(fieldsObject)) {
            const fieldDiv = document.createElement("div");
            fieldDiv.classList.add("field");
            fieldDiv.innerHTML = field;
            fieldDiv.style.fontWeight = "bold";
            node.appendChild(fieldDiv);
            const valueDiv = document.createElement("div");
            valueDiv.classList.add("value");
            valueDiv.innerHTML = fieldsObject[field];
            if (field === "Uptime") {
                let intervalId = null;
                intervalId = setInterval(() => {
                    valueDiv.innerHTML = secondsToColonSeparatedString(get_up_to_date_avatar().last_heartbeat.uptime);
                    if (!valueDiv.parentElement) {
                        clearInterval(intervalId);
                    }
                }, 1000);
            }
            node.appendChild(valueDiv);
        }
        /*
            health_cell.innerHTML = yukon_state.current_avatars[i].last_heartbeat.health_text;
            software_version_cell.innerHTML = yukon_state.current_avatars[i].versions.software_version;
            hardware_version_cell.innerHTML = yukon_state.current_avatars[i].versions.hardware_version;
            uptime_cell.innerHTML = secondsToString(yukon_state.current_avatars[i].last_heartbeat.uptime);
         */
        nodesToBePositioned.push([node, avatar]);
    }
    for (const [node, avatar] of nodesToBePositioned) {
        const total_ports = avatar.ports.cln.length + avatar.ports.srv.length + avatar.ports.pub.length + avatar.ports.sub.length;
        console.assert(total_ports >= 0);
        const avatar_height = Math.max(total_ports * settings["DistancePerHorizontalConnection"] + settings["AvatarConnectionPadding"], node.scrollHeight);
        node.style.height = avatar_height + "px";
        node.style.top = y_counter + "px";
        let avatar_y_counter = settings["AvatarConnectionPadding"];
        for (const port_type of Object.keys(avatar.ports)) {
            for (const port of avatar.ports[port_type]) {
                const matchingPort = ports.find(p => p.port === port && p.type === port_type);
                if (matchingPort === undefined || (matchingPort && matchingPort.x_offset === 0)) {
                    continue;
                }
                // Getting info about more links than necessary for later highlighting purposes
                const relatedLinks = getRelatedLinks(port, yukon_state);
                const currentLinkObject = relatedLinks.find(link => link.port === port && link.type === port_type);
                let toggledOn = { value: false };
                let currentLinkDsdlDatatype = null;
                let fixed_datatype_short = null;
                let fixed_datatype_full = null;
                if (datatypes_response["fixed_id_messages"][port] !== undefined) {
                    fixed_datatype_short = datatypes_response["fixed_id_messages"][port]["short_name"];
                    fixed_datatype_full = datatypes_response["fixed_id_messages"][port]["full_name"];
                }
                if (currentLinkObject !== undefined) {
                    currentLinkDsdlDatatype = currentLinkObject.datatype || "";
                    if (currentLinkObject.name && !settings.ShowLinkNameOnSeparateLine) {
                        currentLinkDsdlDatatype = currentLinkObject.name + ":" + currentLinkDsdlDatatype;
                    }
                } else {
                    currentLinkDsdlDatatype = fixed_datatype_full || "There is no info about this link";
                }
                let horizontal_line = null;
                let arrowhead = null;
                horizontal_line = document.createElement("div");
                horizontal_line.classList.add("horizontal_line");
                horizontal_line.style.top = y_counter + avatar_y_counter + "px";
                horizontal_line.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + "px";
                horizontal_line.style.width = matchingPort.x_offset - settings["NodeXOffset"] - settings["NodeWidth"] + "px";
                horizontal_line.style.height = settings.HorizontalLineWidth + "px";
                monitor2Div.appendChild(horizontal_line);
                // Create an invisible collider div for horizontal_line, it should have a height of 10px
                const horizontal_line_collider = document.createElement("div");
                horizontal_line_collider.classList.add("horizontal_line_collider");
                horizontal_line_collider.style.top = y_counter + avatar_y_counter - settings["HorizontalColliderOffsetY"] + "px";
                horizontal_line_collider.style.left = horizontal_line.style.left;
                horizontal_line_collider.style.width = horizontal_line.style.width;
                horizontal_line_collider.style.height = settings["HorizontalColliderHeight"] + "px";
                horizontal_line_collider.style.zIndex = "1";
                horizontal_line_collider.style.position = "absolute";
                horizontal_line_collider.style.backgroundColor = "transparent";
                horizontal_line_collider.style.cursor = "pointer";
                monitor2Div.appendChild(horizontal_line_collider);
                let link_name_label = null;
                if (settings.ShowLinkNameOnSeparateLine && typeof currentLinkObject === "object" && currentLinkObject.name) {
                    link_name_label = document.createElement("label");
                    link_name_label.classList.add("link_name_label");
                    link_name_label.style.top = y_counter + avatar_y_counter - settings.LinkNameOffset + "px";
                    link_name_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
                    link_name_label.style.width = "fit-content";
                    link_name_label.style.zIndex = "0";
                    link_name_label.style.position = "absolute";
                    link_name_label.style.backgroundColor = "transparent";
                    link_name_label.style.cursor = "pointer";
                    link_name_label.innerHTML = currentLinkObject.name || "";
                    monitor2Div.appendChild(link_name_label);
                }
                // Place a label above the horizontal line at the left side
                const horizontal_line_label = document.createElement("label");
                horizontal_line_label.classList.add("horizontal_line_label");
                horizontal_line_label.style.top = y_counter + avatar_y_counter - settings["HorizontalLabelOffsetY"] + "px";
                horizontal_line_label.style.left = settings["NodeXOffset"] + settings["NodeWidth"] + settings.LabelLeftMargin + "px";
                horizontal_line_label.style.width = "fit-content"; // settings.LinkInfoWidth  - settings.LabelLeftMargin + "px";
                horizontal_line_label.style.height = "fit-content";
                horizontal_line_label.style.position = "absolute";
                if (currentLinkDsdlDatatype.endsWith(".Response")) {
                    currentLinkDsdlDatatype = currentLinkDsdlDatatype.replace(".Response", "");
                }
                horizontal_line_label.innerHTML = currentLinkDsdlDatatype;
                horizontal_line_label.style.zIndex = "0";
                horizontal_line_label.style.backgroundColor = settings["LinkLabelColor"];
                horizontal_line_label.style.color = settings["LinkLabelTextColor"];
                horizontal_line_label.addEventListener("mouseover", () => {
                    horizontal_line_label.style.backgroundColor = settings["LinkLabelHighlightColor"];
                    horizontal_line_label.style.color = settings["LinkLabelHighlightTextColor"];
                });
                horizontal_line_label.addEventListener("mouseout", () => {
                    if (!toggledOn.value) {
                        horizontal_line_label.style.backgroundColor = settings["LinkLabelColor"];
                        horizontal_line_label.style.color = settings["LinkLabelTextColor"];
                    }
                });
                if (settings.ShowLinkNameOnSeparateLine && settings.ShowNameAboveDatatype && link_name_label) {
                    // Swap the top of horizontal_line_label and link_name_label
                    const temp_value = horizontal_line_label.style.top;
                    horizontal_line_label.style.top = link_name_label.style.top;
                    link_name_label.style.top = temp_value;
                }
                // Create a label for the port number on the left side of the horizontal line
                const port_number_label = document.createElement("label");
                port_number_label.classList.add("port_number_label");
                port_number_label.style.top = y_counter + avatar_y_counter - settings.HorizontalPortLabelOffsetY + "px";
                // align it 50px to the left from the left side of the horizontal line
                port_number_label.style.setProperty("left", settings["NodeXOffset"] + settings["NodeWidth"] - 50 + "px");
                port_number_label.style.width = "45px";
                port_number_label.style.height = settings.DistancePerHorizontalConnection + "px";
                port_number_label.style.position = "absolute";
                port_number_label.innerHTML = port;
                port_number_label.style.zIndex = "4";
                if (port_type === "srv") {
                    port_number_label.style.backgroundColor = settings["ServicePortLabelBgColor"];
                    port_number_label.style.setProperty("color", settings["ServicePortLabelColor"], "important");
                } else {
                    port_number_label.style.backgroundColor = settings["LinkLabelHighlightColor"];
                    port_number_label.style.color = settings["LinkLabelHighlightTextColor"];
                }
                // Align text right
                port_number_label.style.textAlign = "right";
                monitor2Div.appendChild(port_number_label);

                monitor2Div.appendChild(horizontal_line_label);


                arrowhead = document.createElement("div");
                arrowhead.classList.add("arrowhead");
                arrowhead.style.position = "absolute";
                arrowhead.style.top = y_counter + avatar_y_counter - 3 + "px";
                arrowhead.style.left = matchingPort.x_offset - 12 + "px";
                arrowhead.style.width = "0px";
                arrowhead.style.height = "0px";
                arrowhead.style.borderLeft = "7px solid transparent";
                arrowhead.style.borderRight = "7px solid transparent";
                arrowhead.style.borderTop = "7px solid pink";
                monitor2Div.appendChild(arrowhead);
                linesByPortAndPortType.push({ "element": horizontal_line, "port": port, "type": port_type, "toggledOn": toggledOn });
                linesByPortAndPortType.push({ "element": arrowhead, "port": port, "type": port_type, "toggledOn": toggledOn });
                linesByPortAndPortType.push({ "element": horizontal_line_label, "port": port, "type": port_type, "toggledOn": toggledOn });
                horizontal_line_collider.addEventListener("mouseover", () => {
                    if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
                        highlightElement(horizontal_line, "red");
                        highlightElement(arrowhead, "red");
                        highlightElement(horizontal_line_label, "none");
                    }
                });
                horizontal_line_collider.addEventListener("mouseout", () => {
                    if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
                        removeHighlightFromElement(horizontal_line);
                        removeHighlightFromElement(arrowhead);
                        removeHighlightFromElement(horizontal_line_label);
                    }
                });
                horizontal_line_collider.addEventListener("click", () => {
                    toggledOn.value = !toggledOn.value;
                    if (toggledOn.value) {
                        horizontal_line.style.setProperty("background-color", "red");
                        arrowhead.style.setProperty("border-top", "7px solid red");
                        const relatedObjects = findRelatedObjects(port);
                        highlightElements(relatedObjects)
                        relatedObjects.forEach(object => {
                            object["toggledOn"].value = true;
                        })
                    } else {
                        horizontal_line.style.removeProperty("background-color");
                        arrowhead.style.setProperty("border-top", "7px solid pink");
                        const relatedObjects = findRelatedObjects(port);
                        removeHighlightsFromObjects(relatedObjects);
                        relatedObjects.forEach(object => {
                            object["toggledOn"].value = false;
                        })
                    }
                    // ports.find(p => p.port === port && p.type === "pub" || p.type === "srv");
                });

                if (matchingPort.type === "pub" || matchingPort.type === "srv") {
                    // Arrowhead for the line
                    arrowhead.style.transform = "rotate(270deg)";
                    arrowhead.style.left = matchingPort.x_offset - 10 + "px";
                } else if (matchingPort.type === "sub" || matchingPort.type === "cln") {
                    arrowhead.style.transform = "rotate(90deg)";
                    arrowhead.style.left = settings["NodeXOffset"] + settings["NodeWidth"] - 3 + "px";
                }
                avatar_y_counter += settings["DistancePerHorizontalConnection"];
            }
        }
        y_counter += avatar_height + settings["DistanceBetweenNodes"];
    }
    const publishers_and_services = ports.filter(p => p.x_offset !== 0 && !p.auxiliary);
    for (const port of publishers_and_services) {
        // Create a line like <div class="line" style="width: 4px; position: absolute; top:20px; left: 140px">-42</div>-->
        let line = document.createElement("div");
        line.classList.add("line");
        line.style.width = settings.VerticalLineWidth + "px";
        line.style.position = "absolute";
        line.style.height = y_counter + "px";
        line.style.top = settings["VerticalLineMarginTop"] + "px";
        line.style.left = port.x_offset + "px";
        // Make a label for the line, positioned 2 pixels to the right of the line, positioned sticky
        let port_label = document.createElement("label");
        port_label.classList.add("port_label");
        port_label.style.position = "absolute";

        function update_port_label_position() {
            if (port_label) {
                port_label.style.top = containerElement.scrollTop + settings["VerticalLineMarginTop"] + "px";
                window.requestAnimationFrame(update_port_label_position);
            }
        }
        window.requestAnimationFrame(update_port_label_position);
        port_label.style.top = settings["VerticalLineMarginTop"] + "px";
        port_label.style.left = port.x_offset + 5 + "px";
        port_label.innerText = port.port;
        monitor2Div.appendChild(port_label);
        let toggledOn = { value: false };
        linesByPortAndPortType.push({ "element": line, "port": port.port, "type": "vertical", "toggledOn": toggledOn });
        // Create a collider for the line
        const line_collider = document.createElement("div");
        line_collider.setAttribute("data-port", port.port);
        line_collider.setAttribute("data-port-type", port.type);
        line_collider.classList.add("line_collider");
        line_collider.style.width = settings["VerticalColliderWidth"] + "px";
        line_collider.style.position = "absolute";
        line_collider.style.height = line.style.height;
        line_collider.style.top = line.style.top;
        line_collider.style.left = port.x_offset - ((settings["VerticalColliderWidth"] - 1) / 2) + "px";
        line_collider.style.zIndex = "2";
        line_collider.style.backgroundColor = "transparent";
        line_collider.style.cursor = "pointer";
        line_collider.addEventListener("mouseover", () => {
            if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
                line.style.setProperty("background-color", "red");
            }
        });
        line_collider.addEventListener("mouseout", () => {
            if (!toggledOn.value && !yukon_state.grabbing_in_monitor_view) {
                line.style.removeProperty("background-color");
            }
        });
        line_collider.addEventListener("click", () => {
            toggledOn.value = !toggledOn.value;
            if (toggledOn.value) {
                line.style.setProperty("background-color", "red");
                const relatedObjects = findRelatedObjects(port.port);
                highlightElements(relatedObjects);
                relatedObjects.forEach(object => {
                    object["toggledOn"].value = true;
                })
            } else {
                line.style.removeProperty("background-color");
                const relatedObjects = findRelatedObjects(port.port);
                removeHighlightsFromObjects(relatedObjects);
                relatedObjects.forEach(object => {
                    object["toggledOn"].value = false;
                });
            }
        });
        monitor2Div.appendChild(line_collider);
        monitor2Div.appendChild(line);
    }
    if (publishers_and_services.length > 0) {
        settings.SubscriptionsOffset = publishers_and_services[publishers_and_services.length - 1].x_offset + settings.DistanceBetweenLines + 10;
    }
}
function addNode(avatar, text, container, yukon_state) {
    // Verify that the avatar is not undefined
    console.assert(avatar !== undefined);
    let node = document.createElement("div");
    node.classList.add("node");
    node.style.left = settings.NodeXOffset + "px";
    // Delay the setting of height until its contents are loaded
    node.style.setProperty("border-sizing", "border-box");
    node.style.width = settings.NodeWidth + "px";
    // node.style.backgroundColor = avatar.color;
    node.innerText = text;
    container.appendChild(node);
    return node;
}