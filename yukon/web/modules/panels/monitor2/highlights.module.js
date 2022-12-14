function pickHighlightColor(objects, settings, yukon_state) {
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
export function highlightElement(element, color, settings, yukon_state) {
    if (element.classList.contains("arrowhead")) {
        element.style.setProperty("border-top", "7px solid " + color);
    } else if (element.classList.contains("horizontal_line_label") && element.tagName === "LABEL") {
        element.style.setProperty("background-color", settings.LinkLabelHighlightColor);
        element.style.setProperty("color", settings.LinkLabelHighlightTextColor);
    } else if (element.classList.contains("horizontal_line") || element.classList.contains("line")) {
        element.style.setProperty("background-color", color);
    }
}
export function highlightElements(objects, settings, yukon_state) {
    const pickedHighlightColor = pickHighlightColor(objects, settings, yukon_state);
    for (const object of objects) {
        highlightElement(object.element, pickedHighlightColor);
    }
}
export function removeHighlightsFromObjects(objects, settings, yukon_state) {
    for (const object of objects) {
        object.toggledOn.value = false;
        if (object.takenColor) {
            const takenColor = settings.HighlightColors.find((color) => { return color.color === object.takenColor.color; });
            takenColor.taken = false;
        }
        removeHighlightFromElement(object.element, settings, yukon_state);
    }
}
export function removeHighlightFromElement(element, settings, yukon_state) {
    if (element.classList.contains("arrowhead")) {
        element.style.setProperty("border-top", "7px solid pink");
    } else if (element.classList.contains("horizontal_line_label") && element.tagName === "LABEL") {
        element.style.setProperty("background-color", settings.LinkLabelColor);
        element.style.setProperty("color", settings.LinkLabelTextColor);
    } else if (element.classList.contains("horizontal_line") || element.classList.contains("line")) {
        element.style.removeProperty("background-color");
    }
}
export function unhighlightAll(settings, yukon_state) {
    for (const object of linesByPortAndPortType) {
        object.toggledOn.value = false;
        if (object.takenColor) {
            const takenColor = settings.HighlightColors.find((color) => { return color.color === object.takenColor.color; });
            takenColor.taken = false;
        }
        removeHighlightFromElement(object.element, settings, yukon_state);
    }
}