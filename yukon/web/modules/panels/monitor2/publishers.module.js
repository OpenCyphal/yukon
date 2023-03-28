import { createSpinner } from "./spinner.module.js";
import { createNumberFieldRow } from "./number_field.js";
import { createBooleanFieldRow } from "./boolean_field.js";
import { createAutocompleteField, createDatatypeField } from "./autocomplete.field.js";

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
export async function updatePublishers(publishersOuterArea, yukon_state) {
    // The client side should publish through calling the APIJ
    // The server side should publish when it receives a request from the client to do so
    // We are trying to make sure that the client side is responsive when the user is publishing
    // When the client side crashes and stops publishing, the server side will not publish
    // Also the server side will turn off the Enabled checkbox if the client side crashes
    // This is so that when the client side recovers, it will not start publishing before the user wants it to
    if (Array.isArray(yukon_state.publishers) === false) {
        return;
    }
    for (const [id, publisher] of Object.entries(await yukon_state.zubax_apiws.get_publishers())) {
        if (publishersOuterArea.querySelector(`[id="${publisher.id}"]`)) {
            // This publisher is already in the DOM
            continue;
        }
        console.log(`Rendering publisher ${JSON.stringify(publisher)}`, publisher);
        const frame = await createPublisherFrame(publisher, yukon_state);
        frame.id = publisher.id;
        // frame.style.top = 200 + "px";
        // frame.style.left = 200 + "px";
        // Add a text saying, "Publisher"
        const publisherText = document.createElement('span');
        publisherText.innerText = "Publisher";
        frame.prepend(publisherText);

        publishersOuterArea.appendChild(frame);
    }
}

export function createRemoveButton(publisher, field, row, yukon_state) {
    const removeButton = document.createElement('button');
    removeButton.classList.add("remove-button");
    removeButton.innerText = "X";
    removeButton.addEventListener('click', async () => {
        await yukon_state.zubax_apiws.delete_publisher_field(publisher.id, field.id);
        row.remove();
    });
    return removeButton;
}


async function createPublisherFrame(publisher, yukon_state) {
    const frame = document.createElement('div');
    frame.classList.add("publisher-frame");
    const closeButton = createCloseButton()
    closeButton.addEventListener('click', () => {
        yukon_state.zubax_apiws.remove_publisher(publisher.id);
        frame.remove();
    });

    frame.appendChild(closeButton);
    let isInitialized = false;
    const possibleTypes = await (yukon_state.zubax_apiws.get_known_datatypes_from_dsdl_for_publishers());
    // Take all the values from dictionary possibleTypes["fixed_id_messages"] and extend them with the array elements from possibleTypes["variable_id_messages"]
    const fixedMessagesArray = Object.values(possibleTypes["fixed_id_messages"]);
    const variableMessagesArray = possibleTypes["variable_id_messages"];
    const allMessagesArray = fixedMessagesArray.concat(variableMessagesArray);
    let chooseTypeFieldWrapper = null;
    let chooseTypeField = null;
    chooseTypeFieldWrapper = await createAutocompleteField(allMessagesArray, [async function (chosenType) {
        yukon_state.zubax_apiws.set_publisher_datatype(publisher.id, chosenType);
        publisher.possiblePaths = await yukon_state.zubax_apiws.get_publisher_possible_paths_for_autocomplete(publisher.id);
        if (!isInitialized) { isInitialized = true; } else { return; }
        await typeWasChosen();
    }], {}, yukon_state);
    frame.append(chooseTypeFieldWrapper);
    chooseTypeField = chooseTypeFieldWrapper.querySelector(".autocomplete-field");
    chooseTypeField.style.width = "100%";
    chooseTypeField.placeholder = "Select a type";
    if (publisher.datatype) {
        console.log("Publisher already has a datatype.")
        chooseTypeField.value = publisher.datatype;
        // This is not actually implemented yet because switching the type of the publisher
        // after it's been created is not a priority, the user could just create a new publisher and delete the old one
        publisher.possiblePaths = await yukon_state.zubax_apiws.get_publisher_possible_paths_for_autocomplete(publisher.id);
        isInitialized = true;
        typeWasChosen();
    } else {
        console.log("publisher doesn't have a datatype yet")
    }

    async function typeWasChosen() {
        // Create a vertical flexbox for holding rows of content
        chooseTypeField.disabled = true;

        const content = document.createElement('div');
        content.classList.add("publisher-content");
        frame.appendChild(content);
        // Create a pixel sized absolute positioned div into the corner of the frame
        const pixel = document.createElement('div');
        pixel.style.position = "absolute";
        pixel.style.top = "-1px";
        pixel.style.left = "0";
        pixel.style.width = "2px";
        pixel.style.height = "2px";
        frame.appendChild(pixel);

        // Create a row for holding refresh rate spinner and checkbox for enabling
        const refreshRateRow = document.createElement('div');
        refreshRateRow.classList.add("publisher-row");
        content.appendChild(refreshRateRow);
        const portIdInput = document.createElement('input');
        portIdInput.type = "number";
        portIdInput.value = publisher.port_id;
        portIdInput.classList.add("port-id-input");
        portIdInput.placeholder = "Port ID";
        portIdInput.title = "Port ID"
        portIdInput.disabled = true;
        // TODO: Get the port id value in case the datatype of the publisher
        // uses a fixed port id
        portIdInput.addEventListener('input', async () => {
            await yukon_state.zubax_apiws.set_publisher_port_id(publisher.id, portIdInput.value);
        });
        refreshRateRow.appendChild(portIdInput);
        // Create a spinner for setting the refresh rate, it should be a number input element
        const refreshRateSpinner = document.createElement('input');
        refreshRateSpinner.type = "number";
        refreshRateSpinner.classList.add("refresh-rate-spinner");
        refreshRateSpinner.value = 15;
        refreshRateSpinner.addEventListener('input', () => {
            publisher.refresh_rate = parseFloat(refreshRateSpinner.value);
            yukon_state.zubax_apiws.set_publisher_rate(publisher.id, publisher.refresh_rate)
        });
        refreshRateRow.appendChild(refreshRateSpinner);
        // Add a text saying, "Hz"
        const hzText = document.createElement('span');
        hzText.innerText = "Hz";
        hzText.style.marginLeft = "2px";
        refreshRateRow.appendChild(hzText);
        const refreshRateInput = refreshRateSpinner;
        refreshRateInput.addEventListener("input", async () => {
            const newRefreshRate = refreshRateInput.value;
            await yukon_state.zubax_apiws.set_publisher_rate(publisher.id, newRefreshRate);
        });
        let enabledState = false;
        let enabledStateChangedFunction = async () => {
            await yukon_state.zubax_apiws.set_publisher_enabled(publisher.id, enabledState);
            if (enabledState) {
                if (yukon_state.publish_intervals[publisher.id]) {
                    try {
                        clearInterval(yukon_state.publish_intervals[publisher.id]);
                    } catch (e) {
                        console.log(e);
                    }
                }
                const publishFunction = async function () {
                    try {
                        pixel.style.backgroundColor = "yellow";
                        setTimeout(() => {
                            pixel.style.backgroundColor = "transparent";
                        }, 100);
                    } catch (e) {
                        console.log(e)
                    }
                    await yukon_state.zubax_apiws.publish(publisher.id);
                    if (enabledState) {
                        yukon_state.publish_intervals[publisher.id] = setTimeout(publishFunction, 1 / parseFloat(refreshRateInput.value) * 1000);
                    }
                }
                publishFunction();
            } else {
                if (yukon_state.publish_intervals[publisher.id]) {
                    try {
                        clearInterval(yukon_state.publish_intervals[publisher.id]);
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        };
        const enabledButton = document.createElement('button');
        enabledButton.innerHTML = "Enable";
        enabledButton.style.width = "65px";
        enabledButton.addEventListener('click', async () => {
            enabledState = !enabledState;
            if (enabledState) {
                enabledButton.innerHTML = "Disable";
                enabledButton.classList.remove("disabled");
            } else {
                enabledButton.innerHTML = "Enable";
                enabledButton.classList.add("disabled");
            }
            enabledStateChangedFunction();
        });
        enabledButton.style.marginLeft = "2px";
        refreshRateRow.appendChild(enabledButton);
        // Add an input box for entering a name for the publisher
        const nameInput = document.createElement('input');
        nameInput.type = "text";
        nameInput.classList.add("publisher-name-input");
        nameInput.placeholder = "Publisher name (optional)";
        nameInput.value = publisher.name;
        nameInput.addEventListener('input', async () => {
            await yukon_state.zubax_apiws.set_publisher_name(publisher.id, nameInput.value);
        });
        nameInput.style.display = "none";
        refreshRateRow.appendChild(nameInput);

        // Add a separator box between the refresh rate row and the next row
        const separator = document.createElement('div');
        separator.classList.add("separator");
        content.appendChild(separator);
        const publisherFieldsResponse = await yukon_state.zubax_apiws.get_publisher_fields(publisher.id);
        if (publisherFieldsResponse.success && publisherFieldsResponse.fields) {
            for (const [id, field] of Object.entries(publisherFieldsResponse.fields)) {
                const fieldRow = await createNumberFieldRow(publisher, yukon_state, field);
                content.appendChild(fieldRow);
            }
        }
        // Create an input-group for holding the add field buttons
        const addFieldInputGroup = document.createElement('div');
        addFieldInputGroup.classList.add("input-group");
        content.appendChild(addFieldInputGroup);
        // Add a button for adding a new field row
        const addNumberFieldButton = document.createElement('button');
        addNumberFieldButton.classList.add("btn", "btn-sm", "btn-secondary", "add-field-button");
        addNumberFieldButton.innerText = "Add number field";
        addNumberFieldButton.addEventListener('click', async () => {
            const fieldRow = await createNumberFieldRow(publisher, yukon_state);
            // Insert the new field row before the add field button
            content.insertBefore(fieldRow, addFieldInputGroup);
        });
        addFieldInputGroup.appendChild(addNumberFieldButton);
        const addBooleanFieldButton = document.createElement('button');
        addBooleanFieldButton.classList.add("btn", "btn-sm", "btn-secondary", "add-field-button");
        addBooleanFieldButton.innerText = "Add boolean field";
        addBooleanFieldButton.addEventListener('click', async () => {
            const fieldRow = await createBooleanFieldRow(publisher, yukon_state);
            // Insert the new field row before the add field button
            content.insertBefore(fieldRow, addFieldInputGroup);
        });
        addFieldInputGroup.appendChild(addBooleanFieldButton);
    }
    // await typeWasChosen();
    return frame;
}
