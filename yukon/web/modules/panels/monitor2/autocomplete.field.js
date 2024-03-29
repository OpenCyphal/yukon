export async function createAutocompleteField(choices, changed_callbacks, state_holder, yukon_state) {
    // Create a div that wraps around the text field and the dropdown menu
    const wrapper = document.createElement('div');
    wrapper.style.position = "relative";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";
    // wrapper.style.width = "250px";
    // Create a text field
    const textField = document.createElement('input');
    textField.classList.add("autocomplete-field");
    textField.style.width = "100%";
    textField.style.minWidth = "270px";
    textField.type = "text";
    if (!choices || choices.length == 0) {
        wrapper.appendChild(textField);
        textField.value = "No choices available";
        textField.disabled = true;
        return wrapper;
    }
    let savedScroll = 0;
    const datatype_was_changed = async () => {
        console.log("Changing datatype to " + textField.value)
        textField.scrollLeft = textField.scrollWidth;
        const new_value = textField.value;
        for (const callback of changed_callbacks) {
            await callback(new_value);
        }
    }
    textField.addEventListener('change', async () => {
        if (state_holder.dropdown) {
            return;
        }
        await datatype_was_changed();
    });
    textField.addEventListener("scroll", () => {
        savedScroll = textField.scrollLeft;
    });
    textField.addEventListener("focusout", () => {
        textField.scrollLeft = savedScroll;
        setTimeout(() => {
            if(state_holder.dropdown) {
                state_holder.dropdown.remove();
                state_holder.dropdown = null;
            }
        }, 300)
    });
    textField.style.position = "relative";
    textField.style.display = "flex";
    // Position in center
    textField.style.alignItems = "center";
    textField.style.justifyContent = "center";
    // textField.style.width = "250px";
    // When the text field is focused, show a dropdown menu with all the available datatypes
    // For now use ["foo.bar", "foo.baz", "foo.baz"] as the list of available datatypes
    wrapper.appendChild(textField);
    // textField.addEventListener('focusout', () => {
    //     if (dropdown) {
    //         dropdown.remove();
    //         dropdown = null;
    //     }
    // });
    let showDropdown = async function (choices) {
        state_holder.dropdown = document.createElement('div');
        state_holder.dropdown.style.backgroundColor = "white";
        state_holder.dropdown.style.border = "1px solid black";
        state_holder.dropdown.style.zIndex = 100;
        state_holder.dropdown.style.position = "absolute";
        state_holder.dropdown.style.width = "600px";
        state_holder.dropdown.style.height = "fit-content"
        state_holder.dropdown.style.maxHeight = "400px";
        state_holder.dropdown.style.overflowY = "scroll";
        state_holder.dropdown.style.top = 34 + "px"; // Height of the text field + 2px
        state_holder.dropdown.style.left = "-30px";
        // Add a list of all the datatypes
        const list = document.createElement('div');
        state_holder.dropdown.appendChild(list);
        for (const something of choices) {
            const listItem = document.createElement('div');
            listItem.style.width = "100%";
            listItem.style.color = "black";
            listItem.style.fontSize = "0.8rem";
            listItem.style.borderBottom = "1px solid black";
            listItem.classList.add("dropdown-list-item");
            // If something is an object then
            let textOfSomething = "";
            if (typeof something === "object") {
                textOfSomething = something.name;
                if (something.is_array) {
                    textOfSomething += "[0]";
                }
            } else {
                textOfSomething = something;
            }
            listItem.innerText = textOfSomething;
            // const response = await yukon_state.zubax_apij.get_number_type_min_max_values(datatype);
            // if (response && response.success && response.min && response.max) {
            //     listItem.title = "Min: " + response.min + ", Max: " + response.max;
            // } else if (response && response.success == false) {
            //     listItem.title = "Error: " + response.message;
            // }
            listItem.addEventListener('click', () => {
                textField.value = textOfSomething;
                setTimeout(async () => {
                    state_holder.dropdown.remove();
                    state_holder.dropdown = null;
                    await datatype_was_changed();
                }, 50);
            });
            list.appendChild(listItem);
        }
        wrapper.appendChild(state_holder.dropdown);
    }
    let highlightFirstElement = function () {
        const firstElement = state_holder.dropdown.querySelector(".dropdown-list-item");
        if (firstElement === null) {
            return;
        }
        firstElement.classList.add("highlighted");
    }
    let highlightLastElement = function () {
        const lastElement = state_holder.dropdown.querySelector(".dropdown-list-item:last-child");
        if (lastElement === null) {
            return;
        }
        lastElement.classList.add("highlighted");
    }

    let moveHighlightDown = function () {
        const highlightedItem = state_holder.dropdown.querySelector(".highlighted");
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
        const highlightedItem = state_holder.dropdown.querySelector(".highlighted");
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
        const highlightedItem = state_holder.dropdown.querySelector(".highlighted");
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

    textField.addEventListener('click', async () => {
        if (state_holder.dropdown) {
            // state_holder.dropdown.remove();
            // state_holder.dropdown = null;
            return;
        }
        await showDropdown(choices);
    });
    // On enter, select the highlighted item
    textField.addEventListener('keydown', async (event) => {
        if (event.key === "Enter" || event.key === "Tab") {
            const highlightedItem = state_holder.dropdown.querySelector(".highlighted");
            if (highlightedItem === null) {
                if (textField.value !== "") {
                    await datatype_was_changed();
                }
                return;
            }
            textField.value = highlightedItem.innerText;
            await datatype_was_changed();
            state_holder.dropdown.remove();
            state_holder.dropdown = null;
        }
    });

    // // On tab, add one segment from the highlighted element to textField.value, a segment is separated by a full stop
    // // If textfield.value is currently at a full stop then add the next segment
    // // Otherwise add the remaining part that is missing until the next full stop
    // textField.addEventListener('keydown', (event) => {
    //     if (event.key === "Tab") {
    //         event.preventDefault();
    //         const highlightedItem = state_holder.dropdown.querySelector(".highlighted");
    //         if (highlightedItem === null) {
    //             return;
    //         }
    //         const highlightedItemText = highlightedItem.innerText;
    //         const textFieldValue = textField.value;
    //         const textFieldValueSegments = textFieldValue.split(".");
    //         const highlightedItemTextSegments = highlightedItemText.split(".");
    //         textField.value = highlightedItemTextSegments.splice(0, textFieldValueSegments.length).join(".");
    //         textField.dispatchEvent(new Event("change"));
    //     }
    // });

    // If the user starts typing something that matches a start of a datatype, show the dropdown menu
    // Also highlight the matching part of the datatype
    textField.addEventListener('input', async () => {
        const text = textField.value;
        var matchingDatatypes = choices.filter((datatype) => {
            if (typeof datatype === "object") {
                return datatype.name.startsWith(text)
            } else if (typeof datatype.name === "string") {
                return datatype.startsWith(text)
            }
        });
        // The first round of getting matching texts from the choices list was unsuccesful but the next round will perform
        // A different kind of search where it is seen if text is contained in the very last parts of the datatypes, the short names

        var matchingDatatypes2 = choices.filter((datatype) => {
            var actualDatatypeText = null;
            if (typeof datatype === "object") {
                actualDatatypeText = datatype.name
            } else if (typeof datatype.name === "string") {
                actualDatatypeText = datatype
            }
            return actualDatatypeText.toLowerCase().search(text.toLowerCase()) !== -1
        });

        if (matchingDatatypes.length === 0 && matchingDatatypes2.length === 0) {
            if (state_holder.dropdown) {
                state_holder.dropdown.remove();
                state_holder.dropdown = null;
            }
            return;
        }
        if (matchingDatatypes.length === 0) {
            matchingDatatypes = matchingDatatypes2;
        }
        if (state_holder.dropdown) {
            state_holder.dropdown.remove();
            state_holder.dropdown = null;
        }
        await showDropdown(matchingDatatypes);
        // If only one datatype matches, higlight the matching part
        if (matchingDatatypes.length === 1) {
            // Add highlight to the first element of dropdown
            const firstElement = state_holder.dropdown.querySelector(".dropdown-list-item");
            firstElement.classList.add("highlighted");
        }
    });
    // When escape is pressed, remove the dropdown
    textField.addEventListener('keydown', (event) => {
        if (event.key === "Escape" || event.key === "Enter") {
            if (state_holder.dropdown) {
                state_holder.dropdown.remove();
                state_holder.dropdown = null;
            }
        }
    });
    return wrapper;
}
export async function createDatatypeField(publisher, field, yukon_state) {
    const listOfOptions = publisher.possiblePaths;

    const wrapper = createAutocompleteField(listOfOptions, [async function (new_value) {
        await yukon_state.zubax_apij.set_publisher_field_specifier(publisher.id, field.id, new_value);
        // await publisher.update_fields();
    }], publisher, yukon_state);
    const textField = (await wrapper).querySelector(".autocomplete-field");
    if (field && field.field_specifier) {
        textField.value = field.field_specifier;
        setTimeout(() => {
            textField.scrollLeft = textField.scrollWidth;
        }, 100);
    }
    return wrapper;
}