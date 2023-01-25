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
function createFieldRow() {
    const row = document.createElement('div');
    row.classList.add("publisher-row");
    // Add a text field of 250px width, after that a number field of 50px width and a spinenr and a number field of 50px width
    const textField = document.createElement('input');
    textField.type = "text";
    textField.classList.add("text-field");
    textField.style.width = "250px";
    row.appendChild(textField);
    const numberField1 = document.createElement('input');
    numberField1.type = "number";
    numberField1.classList.add("number-field");
    numberField1.style.width = "50px";
    row.appendChild(numberField1);
    const spinner = createSpinner("100%");
    spinner.style.marginLeft = "2px";
    spinner.style.marginRight = "2px";
    row.appendChild(spinner);
    const numberField2 = document.createElement('input');
    numberField2.type = "number";
    numberField2.classList.add("number-field");
    numberField2.style.width = "50px";
    row.appendChild(numberField2);
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
    const spinner1 = createSpinner();
    frame.appendChild(createSpinner("100px"));
    frame.appendChild(spinner1);
    return frame;
}
function createSpinner(spinnerSizePx = "50px", valueChangedCallback = null) {
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
    // let tweenRotate = (now) => {
    //     let delta = 0;
    //     if (lastTime) {
    //         delta = now - lastTime;
    //     }
    //     lastTime = now;
    //     spinner.style.transform = `rotate(${rotation}deg)`;
    //     rotation += spinnerSpeed * delta;
    //     window.requestAnimationFrame(tweenRotate);
    // };
    // window.requestAnimationFrame(tweenRotate);
    // Register when mouse is pressed down on spinner
    // Rotate spinner such that the dot is pointing to the mouse
    let mousePos = {
        x: 0,
        y: 0
    }
    document.addEventListener('mousemove', (e) => {
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
    });

    let faceToMouse = function (mouseEvent) {
        // Get the mouse position
        // Get the spinner's absolute position relative to the window
        const spinnerPos = {
            x: spinner.getBoundingClientRect().left + spinner.getBoundingClientRect().width / 2,
            y: spinner.getBoundingClientRect().top + spinner.getBoundingClientRect().height / 2
        };

        // Get the angle between the mouse and the spinner
        const angle = Math.atan2(mousePos.y - spinnerPos.y, mousePos.x - spinnerPos.x);
        // This didn't work, use acos instead
        // const angle2 = Math.acos((mousePos.x - spinnerPos.x) / Math.sqrt(Math.pow(mousePos.x - spinnerPos.x, 2) + Math.pow(mousePos.y - spinnerPos.y, 2)));
        // console.log(angle2);
        // Rotate the spinner
        if (valueChangedCallback) {
            valueChangedCallback(angle);
        }
        spinner.style.transform = `rotate(${angle}rad)`;
    }
    let mouseDown = false;
    spinner.addEventListener('mousedown', (e) => {
        mouseDown = true;
        // Make sure that nothing in the document is selectable 
        document.body.style.userSelect = "none";
        // While mouse is down, on every requestAnimationFrame call faceToMouse
        let faceToMouseLoop = (now) => {
            faceToMouse();
            if (mouseDown) {
                window.requestAnimationFrame(faceToMouseLoop);
            }
        };
        window.requestAnimationFrame(faceToMouseLoop);
    });
    document.addEventListener('mouseup', (e) => {
        document.body.style.userSelect = "auto";
        mouseDown = false;
    });
    return spinner;
}