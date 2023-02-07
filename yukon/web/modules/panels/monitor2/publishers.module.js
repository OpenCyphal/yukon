import { createSpinner } from "./spinner.module.js";
import { createNumberFieldRow } from "./number_field.js";
import { createBooleanFieldRow } from "./boolean_field.js";
import { createDatatypeField } from "./autocomplete.field.js";
var lut = []; for (var i = 0; i < 256; i++) { lut[i] = (i < 16 ? '0' : '') + (i).toString(16); }
function guid() {
    var d0 = Math.random() * 0xffffffff | 0;
    var d1 = Math.random() * 0xffffffff | 0;
    var d2 = Math.random() * 0xffffffff | 0;
    var d3 = Math.random() * 0xffffffff | 0;
    return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
        lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
        lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
        lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
}
function createCloseButton() {
    const closeButton = document.createElement("button");
    closeButton.classList.add("btn", "btn-sm", "btn-danger")
    closeButton.innerText = "x";
    closeButton.style.borderWidth = "0";
    closeButton.style.position = "absolute";
    closeButton.style.display = "flex";
    // Align text to the baseline
    closeButton.style.alignItems = "flex-end";
    closeButton.style.justifyContent = "center";
    // closeButton.style.right = "1px";
    // closeButton.style.top = "1px";
    closeButton.style.right = -23 + "px";
    closeButton.style.top = 1 + "px";
    closeButton.style.marginTop = "0";
    // Make sure the button has a 1x1 aspect ratio and a width of 14px
    closeButton.style.width = "20px";
    closeButton.style.height = "20px";
    closeButton.style.padding = "0px";
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
    for (const [id, publisher] of Object.entries(await yukon_state.zubax_apij.get_publishers())) {
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
        publisherText.innerText = "Publisher (id: " + publisher.id + ")";
        frame.prepend(publisherText);

        publishersOuterArea.appendChild(frame);
    }
}

function createRemoveButton(publisher, field, row, yukon_state) {
    const removeButton = document.createElement('button');
    removeButton.classList.add("remove-button");
    removeButton.innerText = "X";
    removeButton.addEventListener('click', async () => {
        await yukon_state.zubax_apij.delete_publisher_field(publisher.id, field.id);
        row.remove();
    });
    return removeButton;
}


async function createPublisherFrame(publisher, yukon_state) {
    const frame = document.createElement('div');
    frame.classList.add("publisher-frame");
    const closeButton = createCloseButton()
    closeButton.addEventListener('click', () => {
        yukon_state.zubax_apij.remove_publisher(publisher.id);
        frame.remove();
    });

    frame.appendChild(closeButton);
    async function typeWasChosen() {
        // Create a vertical flexbox for holding rows of content
        const content = document.createElement('div');
        content.classList.add("publisher-content");
        frame.appendChild(content);
        // Create a row for holding refresh rate spinner and checkbox for enabling
        const refreshRateRow = document.createElement('div');
        refreshRateRow.classList.add("publisher-row");
        content.appendChild(refreshRateRow);
        // Create a spinner for setting the refresh rate, it should be a number input element
        const refreshRateSpinner = document.createElement('input');
        refreshRateSpinner.type = "number";
        refreshRateSpinner.classList.add("refresh-rate-spinner");
        refreshRateSpinner.value = 15;
        refreshRateSpinner.addEventListener('input', () => {
            publisher.refresh_rate = parseFloat(refreshRateSpinner.value);
            yukon_state.zubax_apij.set_publisher_rate(publisher.id, publisher.refresh_rate)
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
            await yukon_state.zubax_apij.set_publisher_refresh_rate(publisher.id, newRefreshRate);
        });
        // Create a checkbox for enabling the publisher
        const enableCheckbox = document.createElement('input');
        enableCheckbox.type = "checkbox";
        enableCheckbox.classList.add("enable-checkbox");
        enableCheckbox.checked = true;
        refreshRateRow.appendChild(enableCheckbox);
        // Add a text saying, "Enable"
        const enableText = document.createElement('span');
        enableText.innerText = "Enable";
        enableText.style.marginLeft = "2px";
        refreshRateRow.appendChild(enableText);
        // Add an input box for entering a name for the publisher
        const nameInput = document.createElement('input');
        nameInput.type = "text";
        nameInput.classList.add("publisher-name-input");
        nameInput.placeholder = "Publisher name";
        nameInput.value = publisher.name;
        nameInput.addEventListener('input', async () => {
            await yukon_state.zubax_apij.set_publisher_name(publisher.id, nameInput.value);
        });
        refreshRateRow.appendChild(nameInput);
        // Add a separator box between the refresh rate row and the next row
        const separator = document.createElement('div');
        separator.classList.add("separator");
        content.appendChild(separator);
        const publisherFieldsResponse = await yukon_state.zubax_apij.get_publisher_fields(publisher.id);
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
    return frame;
}
