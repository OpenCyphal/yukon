import {getKnownDatatypes} from "../utilities.module.js";

export async function setUpSubscriptionsComponent(container, yukon_state) {
    const containerElement = container.getElement()[0];
    const iSelectDatatype = containerElement.querySelector('#iSelectDatatype');
    const iSubjectId = containerElement.querySelector('#iSubjectId');
    const btnSubscribeToSubject = containerElement.querySelector('#btnSubscribeToSubject');
    const iSelectAny = containerElement.querySelector('#iSelectAny');
    const iSelectFixedIdMessageType = containerElement.querySelector('#iSelectFixedIdMessageType');
    const iFixedIdSubscriptionNodeId = containerElement.querySelector('#iFixedIdSubscriptionNodeId');
    const divMessagesHere = containerElement.querySelector('#divMessagesHere');
    const btnRefresh1 = containerElement.querySelector('#btnRefresh1');
    const btnRefresh2 = containerElement.querySelector('#btnRefresh2');
    const btnRefresh3 = containerElement.querySelector('#btnRefresh3');
    const rbUseSelectAdvertised = containerElement.querySelector('#rbUseSelectAdvertised');
    const rbUseSelectFixedId = containerElement.querySelector('#rbUseSelectFixedId');
    const rbUseSelectAny = containerElement.querySelector('#rbUseSelectAny');
    const rbUseManualDatatypeEntry = containerElement.querySelector('#rbUseManualDatatypeEntry');
    const iManualDatatypeEntry = containerElement.querySelector('#iManualDatatypeEntry');

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

    // If any of the rbUseSelect* radio buttons is clicked, we need to disable the other two
    // and enable the one that was clicked.
    const rbUseSelectAdvertisedClickHandler = () => {
        iSelectDatatype.disabled = false;
        iSubjectId.disabled = false;
        iSelectAny.disabled = true;
        iSelectFixedIdMessageType.disabled = true;
        iFixedIdSubscriptionNodeId.disabled = true;
    };
    const rbUseSelectFixedIdClickHandler = () => {
        iSelectDatatype.disabled = true;
        iSubjectId.disabled = true;
        iSelectAny.disabled = true;
        iSelectFixedIdMessageType.disabled = false;
        iFixedIdSubscriptionNodeId.disabled = false;
    };
    const rbUseSelectAnyClickHandler = () => {
        iSelectDatatype.disabled = true;
        iSubjectId.disabled = false;
        iSelectAny.disabled = false;
        iSelectFixedIdMessageType.disabled = true;
        iFixedIdSubscriptionNodeId.disabled = true;
    };
    rbUseSelectAdvertised.addEventListener('click', rbUseSelectAdvertisedClickHandler);
    rbUseSelectFixedId.addEventListener('click', rbUseSelectFixedIdClickHandler);
    rbUseSelectAny.addEventListener('click', rbUseSelectAnyClickHandler);
    rbUseSelectAdvertised.click();

    // When the rbUseSelectFixedId radio button is clicked, we need to unhide 

    btnRefresh1.addEventListener('click', refreshKnownDatatypes);
    btnRefresh2.addEventListener('click', refreshKnownDatatypes);
    btnRefresh3.addEventListener('click', refreshKnownDatatypes);

    async function refreshKnownDatatypes() {
        // Flash all buttons btnRefresh1, btnRefresh2, btnRefresh3 with text "Refreshing..."
        const btns = [btnRefresh1, btnRefresh2, btnRefresh3];
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
            option.innerHTML = datatype_short + "(" + id + ")";
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
    btnSubscribeToSubject.addEventListener('click', async () => {
        const selectedDatatype = getCurrentDesiredDatatype();
        if (!selectedDatatype) {
            // Flash the btnSubscribeToSubject red without using bootstrap
            btnSubscribeToSubject.style.backgroundColor = "red";
            setTimeout(() => {
                btnSubscribeToSubject.style.backgroundColor = "";
            }, 1000);
            return;
        }
        let desiredSubjectIdValue = iSubjectId.value;
        if (desiredSubjectIdValue == "") {
            desiredSubjectIdValue = null;
        }
        const subscription = await zubax_apij.subscribe(desiredSubjectIdValue, selectedDatatype);
        if (!subscription || !subscription.success) {
            // Flash the btnSubscribeToSubject red without using bootstrap
            btnSubscribeToSubject.style.backgroundColor = "red";
            setTimeout(() => {
                btnSubscribeToSubject.style.backgroundColor = "";
            }, 1000);
            return;
        }
        yukon_state.subscriptions[subscription.subject_id + ":" + subscription.datatype] = [];
        const current_messages = yukon_state.subscriptions[subscription.subject_id + ":" + subscription.datatype];
        // Add a div to the parent of btnSubscribeToSubject
        const div = document.createElement('div');
        div.classList.add('card');
        div.classList.add('m-1');
        div.id = "divSubscription" + subscription.subject_id + ":" + subscription.datatype;
        divMessagesHere.appendChild(div);
        // Add a h5/
        const h5 = document.createElement('h5');
        h5.classList.add('card-header');
        if (subscription.subject_id == null) {
            h5.innerHTML = "A subscription to " + subscription.datatype;
        } else {
            h5.innerHTML = "A subscription to " + subscription.subject_id;
        }
        div.appendChild(h5);
        // Add another div in div, to display the latest message
        /*
            <div class="card">
                <h5 class="card-header">Featured</h5>
                <div class="card-body">
                    <h5 class="card-title">Special title treatment</h5>
                    <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
                    <a href="#" class="btn btn-primary">Go somewhere</a>
                </div>
            </div>
        */
        const divLatestMessage = document.createElement('div');
        divLatestMessage.classList.add('card-body');
        // Add an h5 with subject_id and datatype
        const h5LatestMessage = document.createElement('h5');
        h5LatestMessage.classList.add('card-title');
        if (subscription.subject_id == null) {
            h5LatestMessage.innerHTML = subscription.datatype;
        } else {
            h5LatestMessage.innerHTML = subscription.subject_id + ":" + subscription.datatype;
        }
        divLatestMessage.appendChild(h5LatestMessage);
        // Add a p with the latest message
        const pLatestMessage = document.createElement('p');
        pLatestMessage.classList.add('card-text');
        pLatestMessage.innerHTML = "No messages received yet";
        pLatestMessage.id = "divLatestMessage" + subscription.subject_id + ":" + subscription.datatype;
        divLatestMessage.appendChild(pLatestMessage);
        div.appendChild(divLatestMessage);

        const divLogToConsole = document.createElement('div');
        divLogToConsole.classList.add('form-check');
        const inputLogToConsole = document.createElement('input');
        inputLogToConsole.classList.add('form-check-input');
        inputLogToConsole.classList.add('checkbox');
        inputLogToConsole.type = 'checkbox';
        inputLogToConsole.id = "inputLogToConsole" + subscription.subject_id + ":" + subscription.datatype;
        divLogToConsole.appendChild(inputLogToConsole);
        const labelLogToConsole = document.createElement('label');
        labelLogToConsole.classList.add('form-check-label');
        labelLogToConsole.htmlFor = inputLogToConsole.id;
        labelLogToConsole.innerHTML = "Log to console";
        divLogToConsole.appendChild(labelLogToConsole);
        divLatestMessage.appendChild(divLogToConsole);

        async function fetch() {
            const full_specifiers = [desiredSubjectIdValue + ":" + selectedDatatype + ":" + current_messages.length];
            const result = await yukon_state.zubax_apij.fetch_messages_for_subscription_specifiers(JSON.stringify(full_specifiers));
            const messages = result[Object.keys(result)[0]]
            for (const message of messages) {
                if (inputLogToConsole.checked) {
                    yukon_state.addLocalMessage(JSON.stringify(message.message), 20);
                }
                current_messages.push(message);
            }
            pLatestMessage.innerHTML = JSON.stringify(current_messages[current_messages.length - 1]);
        }

        setInterval(fetch, 300);
        // Add a button for removing the subscription
        const btnRemoveSubscription = document.createElement('button');
        btnRemoveSubscription.classList.add('btn');
        btnRemoveSubscription.classList.add('btn-danger');
        btnRemoveSubscription.innerHTML = "Remove subscription";
        btnRemoveSubscription.addEventListener('click', async () => {
            const result = await yukon_state.zubax_apij.unsubscribe(subscription.subject_id, selectedDatatype);
            if (result.success) {
                div.remove();
            } else {
                // Flash the btnRemoveSubscription disabled
                btnRemoveSubscription.disabled = true;
                setTimeout(() => {
                    btnRemoveSubscription.disabled = false;
                });
            }
        });
        div.appendChild(btnRemoveSubscription);
    });
}