import { createSpinner } from "./spinner.module.js";
import { createNumberFieldRow } from "./number_field.js";
import { createBooleanFieldRow } from "./boolean_field.js";
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
        const refreshRateInput = frame.querySelector(".refresh-rate-spinner");
        refreshRateInput.addEventListener("input", async () => {
            const newRefreshRate = refreshRateInput.value;
            await yukon_state.zubax_apij.set_publisher_refresh_rate(publisher.id, newRefreshRate);
        });
        publishersOuterArea.appendChild(frame);
    }
}
async function createDatatypeField(publisher, field, yukon_state) {
    const listOfOptions = await yukon_state.zubax_apij.get_publish_type_names();
    // Create a div that wraps around the text field and the dropdown menu
    const wrapper = document.createElement('div');
    wrapper.style.position = "relative";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";
    wrapper.style.width = "250px";
    // Create a text field
    const textField = document.createElement('input');
    textField.type = "text";
    if (field && field.field_specifier) {
        textField.value = field.specifier;
        setTimeout(() => {
            textField.scrollLeft = textField.scrollWidth;
        }, 100);
    }
    let savedScroll = 0;
    textField.addEventListener('change', async () => {
        console.log("Changing datatype to " + textField.value)
        textField.scrollLeft = textField.scrollWidth;
        const newDatatype = textField.value;
        await yukon_state.zubax_apij.set_publisher_field_specifier(publisher.id, field.id, newDatatype);
    });
    textField.addEventListener("scroll", () => {
        savedScroll = textField.scrollLeft;
    });
    textField.addEventListener("focusout", () => {
        textField.scrollLeft = savedScroll;
    });
    textField.style.position = "relative";
    textField.style.display = "flex";
    // Position in center
    textField.style.alignItems = "center";
    textField.style.justifyContent = "center";
    textField.style.width = "250px";
    // When the text field is focused, show a dropdown menu with all the available datatypes
    // For now use ["foo.bar", "foo.baz", "foo.baz"] as the list of available datatypes
    wrapper.appendChild(textField);
    // textField.addEventListener('focusout', () => {
    //     if (dropdown) {
    //         dropdown.remove();
    //         dropdown = null;
    //     }
    // });
    let showDropdown = async function (listOfOptions) {
        publisher.dropdown = document.createElement('div');
        publisher.dropdown.style.backgroundColor = "white";
        publisher.dropdown.style.border = "1px solid black";
        publisher.dropdown.style.zIndex = 100;
        publisher.dropdown.style.position = "absolute";
        publisher.dropdown.style.width = "400px";
        publisher.dropdown.style.height = "fit-content"
        publisher.dropdown.style.maxHeight = "100px";
        publisher.dropdown.style.overflowY = "scroll";
        publisher.dropdown.style.top = 34 + "px"; // Height of the text field + 2px
        publisher.dropdown.style.left = 0;
        // Add a list of all the datatypes
        const list = document.createElement('div');
        publisher.dropdown.appendChild(list);
        for (const datatype of listOfOptions) {
            const listItem = document.createElement('div');
            listItem.style.width = "100%";
            listItem.style.color = "black";
            listItem.style.borderBottom = "1px solid black";
            listItem.classList.add("dropdown-list-item");
            listItem.innerText = datatype;
            const response = await yukon_state.zubax_apij.get_number_type_min_max_values(datatype);
            if (response && response.success && response.min && response.max) {
                listItem.title = "Min: " + response.min + ", Max: " + response.max;
            } else if (response && response.success == false) {
                listItem.title = "Error: " + response.error;
            }
            listItem.addEventListener('click', () => {
                textField.value = datatype;
                textField.dispatchEvent(new Event("change"));
                publisher.dropdown.remove();
            });
            list.appendChild(listItem);
        }
        wrapper.appendChild(publisher.dropdown);
    }
    let highlightFirstElement = function () {
        const firstElement = publisher.dropdown.querySelector(".dropdown-list-item");
        if (firstElement === null) {
            return;
        }
        firstElement.classList.add("highlighted");
    }
    let highlightLastElement = function () {
        const lastElement = publisher.dropdown.querySelector(".dropdown-list-item:last-child");
        if (lastElement === null) {
            return;
        }
        lastElement.classList.add("highlighted");
    }

    let moveHighlightDown = function () {
        const highlightedItem = publisher.dropdown.querySelector(".highlighted");
        if (highlightedItem === null) {
            highlightFirstElement();
            return;
        }
        const nextSibling = highlightedItem.nextSibling;
        if (nextSibling === null) {
            return;
        }
        highlightedItem.classList.remove("highlighted");
        nextSibling.classList.add("highlighted");
    }
    let moveHighlightUp = function () {
        const highlightedItem = publisher.dropdown.querySelector(".highlighted");
        if (highlightedItem === null) {
            highlightLastElement();
            return;
        }
        const previousSibling = highlightedItem.previousSibling;
        if (previousSibling === null) {
            return;
        }
        highlightedItem.classList.remove("highlighted");
        previousSibling.classList.add("highlighted");
    }
    let scrollToHighlightedElement = function () {
        const highlightedItem = publisher.dropdown.querySelector(".highlighted");
        if (highlightedItem === null) {
            return;
        }
        highlightedItem.scrollIntoView();
    }

    // On down arrow, move the highlight down
    textField.addEventListener('keydown', (event) => {
        if (event.key === "ArrowDown") {
            moveHighlightDown();
            scrollToHighlightedElement();
        }
    });

    // On up arrow, move the highlight up
    textField.addEventListener('keydown', (event) => {
        if (event.key === "ArrowUp") {
            moveHighlightUp();
            scrollToHighlightedElement();
        }
    });

    // On enter, select the highlighted item
    textField.addEventListener('keydown', (event) => {
        if (event.key === "Enter") {
            const highlightedItem = publisher.dropdown.querySelector(".highlighted");
            if (highlightedItem === null) {
                return;
            }
            textField.value = highlightedItem.innerText;
            textField.dispatchEvent(new Event("change"));
            publisher.dropdown.remove();
            publisher.dropdown = null;
        }
    });

    // On tab, add one segment from the highlighted element to textField.value, a segment is separated by a full stop
    // If textfield.value is currently at a full stop then add the next segment
    // Otherwise add the remaining part that is missing until the next full stop
    textField.addEventListener('keydown', (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            const highlightedItem = publisher.dropdown.querySelector(".highlighted");
            if (highlightedItem === null) {
                return;
            }
            const highlightedItemText = highlightedItem.innerText;
            const textFieldValue = textField.value;
            const textFieldValueSegments = textFieldValue.split(".");
            const highlightedItemTextSegments = highlightedItemText.split(".");
            textField.value = highlightedItemTextSegments.splice(0, textFieldValueSegments.length).join(".");
            textField.dispatchEvent(new Event("change"));
        }
    });


    textField.addEventListener('click', async () => {
        if (publisher.dropdown) {
            publisher.dropdown.remove();
            publisher.dropdown = null;
            return;
        }
        await showDropdown(listOfOptions);
    });
    // If the user starts typing something that matches a start of a datatype, show the dropdown menu
    // Also highlight the matching part of the datatype
    textField.addEventListener('input', async () => {
        const text = textField.value;
        const matchingDatatypes = listOfOptions.filter((datatype) => datatype.startsWith(text));
        if (matchingDatatypes.length === 0) {
            if (publisher.dropdown) {
                publisher.dropdown.remove();
                publisher.dropdown = null;
            }
            return;
        }
        if (publisher.dropdown) {
            publisher.dropdown.remove();
            publisher.dropdown = null;
        }
        await showDropdown(matchingDatatypes);
        // If only one datatype matches, higlight the matching part
        if (matchingDatatypes.length === 1) {
            // Add highlight to the first element of dropdown
            const firstElement = publisher.dropdown.querySelector(".dropdown-list-item");
            firstElement.classList.add("highlighted");
        }
    });
    // When escape is pressed, remove the dropdown
    textField.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            if (publisher.dropdown) {
                publisher.dropdown.remove();
                publisher.dropdown = null;
            }
        }
    });

    return wrapper;
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
    return frame;
}
