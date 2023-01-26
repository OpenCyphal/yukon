export function updatePublishers(publishersOuterArea, yukon_state) {
    if (Array.isArray(yukon_state.publishers) === false) {
        return;
    }
    for (const publisher of yukon_state.publishers) {
        if (publishersOuterArea.querySelector(`[id="${publisher.id}"]`)) {
            // This publisher is already in the DOM
            continue;
        }

        const frame = createPublisherFrame();
        frame.id = publisher.id;
        frame.style.top = 200 + "px";
        frame.style.left = 200 + "px";
        // Add a text saying, "Publisher"
        const publisherText = document.createElement('span');
        publisherText.innerText = "Publisher";
        frame.prepend(publisherText);
        publishersOuterArea.appendChild(frame);
    }
}
function createDatatypeField() {
    const listOfOptions = ["foo.bar", "foo.baz", "foo.baz", "kala.saba", "kassi.nurr", "airplane.engine.cover.vent", "airplane.engine.cover.duct", "airplane.motor.cover.duct"];
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
    textField.style.position = "relative";
    textField.style.display = "flex";
    // Position in center
    textField.style.alignItems = "center";
    textField.style.justifyContent = "center";
    textField.style.width = "250px";
    // When the text field is focused, show a dropdown menu with all the available datatypes
    // For now use ["foo.bar", "foo.baz", "foo.baz"] as the list of available datatypes
    wrapper.appendChild(textField);
    let dropdown = null
    // textField.addEventListener('focusout', () => {
    //     if (dropdown) {
    //         dropdown.remove();
    //         dropdown = null;
    //     }
    // });
    let showDropdown = function (listOfOptions) {
        dropdown = document.createElement('div');
        dropdown.style.backgroundColor = "white";
        dropdown.style.border = "1px solid black";
        dropdown.style.zIndex = 100;
        dropdown.style.position = "absolute";
        dropdown.style.width = "400px";
        dropdown.style.height = "250px";
        dropdown.style.top = 34 + "px"; // Height of the text field + 2px
        dropdown.style.left = 0;
        // Add a list of all the datatypes
        const list = document.createElement('div');
        dropdown.appendChild(list);
        for (const datatype of listOfOptions) {
            const listItem = document.createElement('div');
            listItem.style.width = "100%";
            listItem.style.color = "black";
            listItem.style.borderBottom = "1px solid black";
            listItem.classList.add("dropdown-list-item");
            listItem.innerText = datatype;
            listItem.addEventListener('click', () => {
                textField.value = datatype;
                dropdown.remove();
            });
            list.appendChild(listItem);
        }
        wrapper.appendChild(dropdown);
    }
    let highlightFirstElement = function () {
        const firstElement = dropdown.querySelector(".dropdown-list-item");
        if (firstElement === null) {
            return;
        }
        firstElement.classList.add("highlighted");
    }
    let highlightLastElement = function () {
        const lastElement = dropdown.querySelector(".dropdown-list-item:last-child");
        if (lastElement === null) {
            return;
        }
        lastElement.classList.add("highlighted");
    }

    let moveHighlightDown = function () {
        const highlightedItem = dropdown.querySelector(".highlighted");
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
        const highlightedItem = dropdown.querySelector(".highlighted");
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

    // On down arrow, move the highlight down
    textField.addEventListener('keydown', (event) => {
        if (event.key === "ArrowDown") {
            moveHighlightDown();
        }
    });

    // On up arrow, move the highlight up
    textField.addEventListener('keydown', (event) => {
        if (event.key === "ArrowUp") {
            moveHighlightUp();
        }
    });

    // On enter, select the highlighted item
    textField.addEventListener('keydown', (event) => {
        if (event.key === "Enter") {
            const highlightedItem = dropdown.querySelector(".highlighted");
            if (highlightedItem === null) {
                return;
            }
            textField.value = highlightedItem.innerText;
            dropdown.remove();
            dropdown = null;
        }
    });

    // On tab, add one segment from the highlighted element to textField.value, a segment is separated by a full stop
    // If textfield.value is currently at a full stop then add the next segment
    // Otherwise add the remaining part that is missing until the next full stop
    textField.addEventListener('keydown', (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            const highlightedItem = dropdown.querySelector(".highlighted");
            if (highlightedItem === null) {
                return;
            }
            const highlightedItemText = highlightedItem.innerText;
            const textFieldValue = textField.value;
            const textFieldValueSegments = textFieldValue.split(".");
            const highlightedItemTextSegments = highlightedItemText.split(".");
            textField.value = highlightedItemTextSegments.splice(0, textFieldValueSegments.length).join(".");
        }
    });


    textField.addEventListener('click', () => {
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
            return;
        }
        showDropdown(listOfOptions);
    });
    // If the user starts typing something that matches a start of a datatype, show the dropdown menu
    // Also highlight the matching part of the datatype
    textField.addEventListener('input', () => {
        const text = textField.value;
        const matchingDatatypes = listOfOptions.filter((datatype) => datatype.startsWith(text));
        if (matchingDatatypes.length === 0) {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
            return;
        }
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        showDropdown(matchingDatatypes);
        // If only one datatype matches, higlight the matching part
        if (matchingDatatypes.length === 1) {
            // Add highlight to the first element of dropdown
            const firstElement = dropdown.querySelector(".dropdown-list-item");
            firstElement.classList.add("highlighted");
        }
    });
    // When escape is pressed, remove the dropdown
    textField.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
        }
    });

    return wrapper;
}
function createFieldRow() {
    const row = document.createElement('div');
    row.classList.add("publisher-row");
    // Add a text field of 250px width, after that a number field of 50px width and a spinenr and a number field of 50px width
    row.appendChild(createDatatypeField());
    const numberField1 = document.createElement('input');
    numberField1.type = "number";
    numberField1.classList.add("number-field");
    numberField1.classList.add("min-value-field")
    numberField1.style.width = "50px";
    numberField1.value = 0
    row.appendChild(numberField1);
    const numberField2 = document.createElement('input');
    const spinner = createSpinner("100%", null, () => numberField1.value, () => numberField2.value);
    spinner.style.marginLeft = "2px";
    spinner.style.marginRight = "2px";
    row.appendChild(spinner);
    numberField2.classList.add("max-value-field");
    numberField2.type = "number";
    numberField2.classList.add("number-field");
    numberField2.style.width = "50px";
    numberField2.value = 100;
    row.appendChild(numberField2);
    // Add a number field for value
    const valueField = document.createElement('input');
    valueField.type = "number";
    valueField.classList.add("value-field");
    valueField.style.width = "50px";
    valueField.value = 0;
    row.appendChild(valueField);
    return row;
}
function createPublisherFrame() {
    const frame = document.createElement('div');
    frame.classList.add("publisher-frame");
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
    // Add a separator box between the refresh rate row and the next row
    const separator = document.createElement('div');
    separator.classList.add("separator");
    content.appendChild(separator);
    const fieldRow = createFieldRow();
    content.appendChild(fieldRow);
    // Add a button for adding a new field row
    const addFieldButton = document.createElement('button');
    addFieldButton.classList.add("add-field-button");
    addFieldButton.innerText = "Add Field";
    addFieldButton.addEventListener('click', () => {
        const fieldRow = createFieldRow();
        // Insert the new field row before the add field button
        content.insertBefore(fieldRow, addFieldButton);
    });
    content.appendChild(addFieldButton);
    return frame;
}
function createSpinner(spinnerSizePx = "50px", valueChangedCallback = null, getMinValue = null, getMaxValue = null) {
    // Create a span that is circular and has a border.
    // It should also have a slight shadow.
    // It should have a little dot on the inside that is black and sticks to the border
    const spinner = document.createElement('span');
    spinner.classList.add("spinner-knob", "ratio-1x1");
    spinner.style.height = spinnerSizePx;
    const dot = document.createElement('span');
    dot.classList.add("knob-dot")
    spinner.appendChild(dot);
    // The spinner should rotate 360 degrees in 1 second
    let rotation = 0;
    let lastTime;
    let spinnerSpeed = 0.2;
    let mousePos = {
        x: 0,
        y: 0
    }
    document.addEventListener('mousemove', (e) => {
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
    });
    let previousSpinnerAngle = 0.0;
    spinner.setAttribute("data-angle", 0.0);
    spinner.setAttribute("data-value", 0.0);
    if (getMinValue) {
        spinner.setAttribute("data-value", getMinValue());
    }
    let hoveringValueSpan = null;
    let faceToMouse = function (mouseEvent) {
        // Get the mouse position
        // Get the spinner's absolute position relative to the window
        const spinnerPos = {
            x: spinner.getBoundingClientRect().left + spinner.getBoundingClientRect().width / 2,
            y: spinner.getBoundingClientRect().top + spinner.getBoundingClientRect().height / 2
        };

        // Get the angle between the mouse and the spinner
        const angle = Math.atan2(mousePos.y - spinnerPos.y, mousePos.x - spinnerPos.x);
        let options = [angle + 2 * Math.PI - previousSpinnerAngle, angle - previousSpinnerAngle, angle - 2 * Math.PI - previousSpinnerAngle]
        // Take the absolute value of every option in options and find the smallest absolute value, then save the index of that value
        let smallestIndex = 0;
        let smallestValue = Math.abs(options[0]);
        for (let i = 1; i < options.length; i++) {
            if (Math.abs(options[i]) < smallestValue) {
                smallestValue = Math.abs(options[i]);
                smallestIndex = i;
            }
        }
        const angleDiff = options[smallestIndex];
        spinner.setAttribute("data-value", (parseFloat(spinner.getAttribute("data-value")) + angleDiff).toFixed(4));
        let wasClamped = false;
        // Clamp data-value between getMinValue and getMaxValue
        if (getMinValue) {
            const minValue = getMinValue();
            if (parseFloat(spinner.getAttribute("data-value")) <= minValue) {
                spinner.setAttribute("data-value", minValue);
                wasClamped = true;
            }
        }
        if (getMaxValue) {
            const maxValue = getMaxValue();
            if (parseFloat(spinner.getAttribute("data-value")) >= maxValue) {
                spinner.setAttribute("data-value", maxValue);
                wasClamped = true;
            }
        }
        // This didn't work, use acos instead
        // const angle2 = Math.acos((mousePos.x - spinnerPos.x) / Math.sqrt(Math.pow(mousePos.x - spinnerPos.x, 2) + Math.pow(mousePos.y - spinnerPos.y, 2)));
        // console.log(angle2);
        // Rotate the spinner
        if (valueChangedCallback) {
            valueChangedCallback(angle);
        }
        if (!wasClamped) {
            previousSpinnerAngle = angle;
            spinner.style.transform = `rotate(${angle}rad)`;
            spinner.setAttribute("data-angle", angle);
        }
    }
    let mouseDown = false;
    let wheelScrollValueIndicatorTimeout = null;
    spinner.addEventListener('mousedown', (e) => {
        mouseDown = true;
        if (hoveringValueSpan) {
            hoveringValueSpan.remove();
            clearTimeout(wheelScrollValueIndicatorTimeout);
        }
        hoveringValueSpan = document.createElement('span');
        hoveringValueSpan.classList.add("hovering-value");
        document.body.appendChild(hoveringValueSpan);
        // Make sure that nothing in the document is selectable 
        document.body.style.userSelect = "none";
        // While mouse is down, on every requestAnimationFrame call faceToMouse
        let faceToMouseLoop = (now) => {
            faceToMouse();
            if (mouseDown) {
                window.requestAnimationFrame(faceToMouseLoop);
            }
            // Position a span above the mouse showing the current value
            hoveringValueSpan.innerText = spinner.getAttribute("data-value");
            hoveringValueSpan.style.position = "absolute";
            hoveringValueSpan.style.left = mousePos.x + 20 + "px";
            hoveringValueSpan.style.top = mousePos.y + 20 + "px";

        };
        window.requestAnimationFrame(faceToMouseLoop);
    });
    // When mouse is scrolled while it is hovering spinner, rotate it
    spinner.addEventListener('wheel', (e) => {

        // Get the mouse position
        // Get the spinner's absolute position relative to the window
        const spinnerPos = {
            x: spinner.getBoundingClientRect().left + spinner.getBoundingClientRect().width / 2,
            y: spinner.getBoundingClientRect().top + spinner.getBoundingClientRect().height / 2
        };
        // Check if mouse is over the spinner
        if (mousePos.x >= spinnerPos.x - spinner.getBoundingClientRect().width / 2 && mousePos.x <= spinnerPos.x + spinner.getBoundingClientRect().width / 2 && mousePos.y >= spinnerPos.y - spinner.getBoundingClientRect().height / 2 && mousePos.y <= spinnerPos.y + spinner.getBoundingClientRect().height / 2) {
            if (wheelScrollValueIndicatorTimeout) {
                clearTimeout(wheelScrollValueIndicatorTimeout);
            }
            // Rotate the spinner by 1 degree if the mouse is scrolled up, -1 degree if the mouse is scrolled down
            const angle = parseFloat(spinner.getAttribute("data-angle"));
            const value = parseFloat(spinner.getAttribute("data-value"));
            const valueRange = () => getMaxValue() - getMinValue();
            let multiplier = 1;
            if (e.shiftKey) {
                multiplier = 10;
            }
            const addedIncrement = (e.deltaY > 0 ? -1 * multiplier : 1 * multiplier);
            let newValue = parseFloat(value) + addedIncrement;
            let newAngle = parseFloat(angle) + addedIncrement;
            const maxAngle = () => valueRange() * multiplier;
            const minAngle = 0;
            let isClamped = false;
            if (getMinValue) {
                const minValue = getMinValue();
                if (newValue <= minValue) {
                    newValue = minValue;
                    isClamped = true;
                    // Set the angle to the corresponding clamped angle
                    newAngle = minAngle;
                }
            }
            if (getMaxValue) {
                const maxValue = getMaxValue();
                if (newValue >= maxValue) {
                    newValue = maxValue;
                    isClamped = true;
                    // Set the angle to the corresponding clamped angle
                    newAngle = maxAngle();
                }
            }
            spinner.setAttribute("data-value", parseFloat(newValue).toFixed(4));
            spinner.style.transform = `rotate(${newAngle}rad)`;
            previousSpinnerAngle = newAngle;
            spinner.setAttribute("data-angle", newAngle);
            hoveringValueSpan = document.body.querySelector(".hovering-value") || document.createElement('span');
            hoveringValueSpan.classList.add("hovering-value");
            document.body.appendChild(hoveringValueSpan);
            hoveringValueSpan.innerText = spinner.getAttribute("data-value");
            hoveringValueSpan.style.position = "absolute";
            hoveringValueSpan.style.left = mousePos.x + 20 + "px";
            hoveringValueSpan.style.top = mousePos.y + 20 + "px";
            // Remove the hovering value span after 2 seconds when there hasn't been any mouse wheel scrolling
            wheelScrollValueIndicatorTimeout = setTimeout(() => {
                if (hoveringValueSpan && hoveringValueSpan.parentElement == document.body) {
                    document.body.removeChild(hoveringValueSpan);
                }
            }, 2000);
            if (valueChangedCallback) {
                valueChangedCallback(newValue);
            }
        }
    });
    document.addEventListener('mouseup', (e) => {
        document.body.style.userSelect = "auto";
        if (hoveringValueSpan && hoveringValueSpan.parentElement == document.body) {
            document.body.removeChild(hoveringValueSpan);
        }
        mouseDown = false;
    });
    return spinner;
}