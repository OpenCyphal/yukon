export function createSpinner(spinnerSizePx = "50px", valueChangedCallback = null, getMinValue = null, getMaxValue = null) {
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
    let spinnerValue = 0.0;
    let spinnerAngle = 0.0;
    const valueRange = () => getMaxValue() - getMinValue();
    const multiplier = () => {
        if (valueRange() <= 1) {
            return 0.15;
        } else if (valueRange() <= 2) {
            return 0.25;
        } else {
            return 1;
        }
    };
    const wholeRange = () => valueRange() * 1 / multiplier();
    const maxAngle = () => wholeRange() - Math.floor((wholeRange()) / (Math.PI * 2)) * (Math.PI * 2);
    const minAngle = 0;
    spinnerValue = getMinValue() || 0;
    if (getMinValue) {
        spinnerValue = getMinValue();
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
        let newAngle = Math.atan2(mousePos.y - spinnerPos.y, mousePos.x - spinnerPos.x);
        let options = [newAngle + 2 * Math.PI - previousSpinnerAngle, newAngle - previousSpinnerAngle, newAngle - 2 * Math.PI - previousSpinnerAngle]
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

        let newValue = spinnerValue + angleDiff * multiplier();
        let wasClamped = false;
        // Clamp data-value between getMinValue and getMaxValue
        if (getMinValue) {
            const minValue = getMinValue();
            if (newValue <= minValue) {
                newAngle = minAngle;
                newValue = minValue;
                wasClamped = true;
            }
        }
        if (getMaxValue) {
            const maxValue = getMaxValue();
            if (newValue >= maxValue) {
                newAngle = maxAngle();
                newValue = maxValue;
                wasClamped = true;
            }
        }
        if (valueChangedCallback) {
            valueChangedCallback(newValue);
        }
        previousSpinnerAngle = newAngle;
        spinner.style.transform = `rotate(${newAngle}rad)`;
        spinnerValue = newValue;
        spinnerAngle = newAngle;
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
            hoveringValueSpan.innerText = spinnerValue;
            hoveringValueSpan.style.position = "absolute";
            hoveringValueSpan.style.left = mousePos.x + 20 + "px";
            hoveringValueSpan.style.top = mousePos.y + 20 + "px";
        };
        window.requestAnimationFrame(faceToMouseLoop);
    });
    // When mouse is scrolled while it is hovering spinner, rotate it
    spinner.addEventListener('wheel', (e) => {
        e.preventDefault();
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
            let scroll_multiplier = multiplier();
            if (e.shiftKey) {
                scroll_multiplier = 10 * multiplier();
            }
            const addedIncrement = (e.deltaY > 0 ? -scroll_multiplier : scroll_multiplier);
            let newValue = spinnerValue + addedIncrement;
            let newAngle = newValue / Math.pow(multiplier(), 3);
            newAngle = newAngle - Math.floor(newAngle / (2 * Math.PI)) * 2 * Math.PI;
            const minAngle = 0;
            let isClamped = false;
            if (getMinValue) {
                const minValue = getMinValue();
                if (newValue < minValue) {
                    newValue = minValue;
                    isClamped = true;
                    // Set the angle to the corresponding clamped angle
                    newAngle = minAngle;
                }
            }
            if (getMaxValue) {
                const maxValue = getMaxValue();
                if (newValue > maxValue) {
                    newValue = maxValue;
                    isClamped = true;
                    // Set the angle to the corresponding clamped angle
                    newAngle = maxAngle();
                }
            }
            spinnerValue = newValue;
            spinnerAngle = newAngle;
            spinner.style.transform = `rotate(${newAngle}rad)`;
            previousSpinnerAngle = newAngle;

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
    return {
        "spinnerElement": spinner,
        "setValue": (newValue) => {
            const circle = Math.PI * 2.0;
            spinnerValue = parseFloat(newValue);
            spinnerAngle = spinnerValue / multiplier() - Math.floor(spinnerValue / circle) * circle;
            if (getMinValue) {
                const minValue = getMinValue();
                if (spinnerValue < minValue) {
                    spinnerValue = minValue;
                    valueChangedCallback(spinnerValue);
                    // Set the angle to the corresponding clamped angle
                    spinnerAngle = minAngle;
                }
            } else {
                console.error("no minvalue function")
            }
            if (getMaxValue) {
                const maxValue = getMaxValue();
                if (spinnerValue > maxValue) {
                    spinnerValue = maxValue;
                    valueChangedCallback(spinnerValue);
                    // Set the angle to the corresponding clamped angle
                    spinnerAngle = maxAngle();
                }
            } else {
                console.error("no maxvalue function");
            }
            spinner.style.transform = `rotate(${spinnerAngle}rad)`;
            previousSpinnerAngle = spinnerAngle;
        }
    };
}