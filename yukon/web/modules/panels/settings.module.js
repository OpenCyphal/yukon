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

export async function setUpSettingsComponent(container, yukon_state) {
    const containerElement = container.getElement()[0];
    let settings = yukon_state.all_settings;
    const settingsDiv = containerElement.querySelector("#settings-div")
    const settingsDebugDiv = containerElement.querySelector("#settings-debug-div");

    function createPathDiv(settings, parentDiv, parentSettings, key_name, __type__) {
        // Make an input element to store the path in settings["value"], and a button to open the file dialog
        const pathDiv = document.createElement("div");
        pathDiv.classList.add("path-div");
        pathDiv.classList.add("input-group");
        const pathInput = document.createElement("input");
        pathInput.classList.add("path-input");
        pathInput.classList.add("form-control");
        pathInput.value = settings["value"];
        pathInput.type = "text";
        pathInput.addEventListener("input", function () {
            settings["value"] = pathInput.value;
        });
        pathInput.style.width = "calc(100% - 148px)";
        const pathButton = document.createElement("button");
        pathButton.classList.add("path-button");
        pathButton.classList.add("btn");
        pathButton.classList.add("btn-danger");
        pathButton.classList.add("btn-sm");
        pathButton.innerText = "Browse";
        pathButton.addEventListener("click", async function () {
            let path = "";
            if (__type__ === "filepath") {
                path = await window.electronAPI.openPath({
                    properties: ["openFile"],
                });
            } else if (__type__ === "dirpath") {
                path = await window.electronAPI.openPath({
                    properties: ["openDirectory"],
                });
            }
            if (path) {
                pathInput.value = path;
                settings["value"] = path;
            }
        });
        pathDiv.style.width = "100%";
        pathDiv.appendChild(pathInput);
        pathDiv.appendChild(pathButton);
        // Add a button for removing
        const removeButton = document.createElement("button");
        removeButton.classList.add("remove-button");
        removeButton.classList.add("btn");
        removeButton.classList.add("btn-danger");
        removeButton.classList.add("btn-sm");
        removeButton.innerText = "Remove";
        removeButton.addEventListener("click", function () {
            // Delete the settings object
            // If parentSettings is an array
            if (Array.isArray(parentSettings)) {
                // Find the index of the settings object
                const index = parentSettings.indexOf(settings);
                // Remove the settings object from the array
                parentSettings.splice(index, 1);
                parentDiv.parentElement.parentElement.removeChild(parentDiv.parentElement);
                createSettingsDiv(parentSettings, parentDiv.parentElement.parentElement, null, null);
            } else if (typeof parentSettings === "object" && key_name) {
                // If parentSettings is an object
                // Delete the settings object
                delete parentSettings[key_name];
                parentDiv.parentElement.innerHTML = "";
                createSettingsDiv(parentSettings, parentDiv.parentElement, null, null);
            }
        });
        pathDiv.appendChild(removeButton);
        parentDiv.appendChild(pathDiv);
    }

    function createRadioDiv(settings, parentdiv) {
        for (let i = 0; i < settings["values"].length; i++) {
            let value = settings["values"][i];
            let description = "";
            if (typeof settings["values"][i] === "object") {
                value = settings["values"][i]["value"];
                description = settings["values"][i]["description"];
            }
            const radioDiv = document.createElement("div");
            radioDiv.classList.add("form-check");
            const radioInput = document.createElement("input");
            radioInput.classList.add("form-check-input");
            radioInput.type = "radio";
            radioInput.name = settings["name"];
            radioInput.id = settings["name"] + i;
            let value_in_settings = settings["values"][i];
            if (typeof settings["values"][i] === "object") {
                value_in_settings = settings["values"][i]["value"];
            }
            radioInput.checked = settings["chosen_value"] === value_in_settings;
            radioInput.addEventListener("change", function () {
                if (this.checked) {
                    settings["chosen_value"] = value;
                }
            });
            const radioLabel = document.createElement("label");
            radioLabel.classList.add("form-check-label");
            radioLabel.setAttribute("for", settings["name"] + i)
            radioLabel.innerText = value;
            radioDiv.appendChild(radioInput);
            radioDiv.appendChild(radioLabel);
            parentdiv.appendChild(radioDiv);
            if (description !== "") {
                // Make a new label after the current label
                const radioDescriptionLabel = document.createElement("label");
                radioDescriptionLabel.classList.add("mb-3");
                radioDescriptionLabel.setAttribute("for", settings["name"] + i)
                radioDescriptionLabel.innerText = description;
                parentdiv.appendChild(radioDescriptionLabel);
            }
        }
    }

    function createSettingsDiv(settings, parentDiv, parentSettings) {
        let id = settings["__id__"];
        if (settings["__type__"] === "radio") {
            createRadioDiv(settings, parentDiv);
            return;
        }
        if (settings["__type__"] === "dirpath" || settings["__type__"] === "filepath") {
            createPathDiv(settings, parentDiv, parentSettings, null, settings["__type__"]);
            return;
        }
        // Only the even entries of arrays are real, odd entries are just the id
        // Make a dictionary where keys are ids and values are the values


        for (const [key, value] of Object.entries(settings)) {
            let innerId = null;
            if (Array.isArray(settings)) {
                if (key % 2 === 0) {
                    continue;
                } else {
                    innerId = settings[key - 1];
                }
            } else if (typeof settings === "object") {
                if (key.startsWith("__id__")) {
                    continue;
                } else {
                    innerId = settings["__id__" + key]
                }
            }
            // If key is a string and starts with __id__, then it is an id, continue
            if (typeof key === "string" && key.startsWith("__id__")) {
                continue;
            }
            let realDictionaryKey = null;
            if (!Array.isArray(settings)) {
                realDictionaryKey = key;
            }
            // If the value is an empty dictionary, say that it is empty
            if (Object.keys(value).length === 0 && value.constructor === Object) {
                const div = document.createElement("div");
                div.classList.add("card");
                div.classList.add("card-body");
                div.classList.add("mb-2");
                div.innerHTML = `<h5 class="card-title">${key}</h5><p class="card-text">Empty</p>`;
                parentDiv.appendChild(div);
                // Add a button for adding a key/value pair to the dictionary
                continue;
            }
            const isInnerValueDictionary = typeof value === 'object';
            if (isInnerValueDictionary) {
                const cardDiv = document.createElement("div");
                cardDiv.classList.add("card");
                cardDiv.classList.add("mb-3");
                const cardHeaderDiv = document.createElement("div");
                cardHeaderDiv.classList.add("card-header");
                // Make an h5

                // If key == "__editable__" then make an input field for the value of the key
                if (key === "__editable__") {
                    const input = document.createElement("input");
                    input.classList.add("form-control");
                    input.type = "text";
                    input.value = value;
                    input.placeholder = "Enter new key";
                    input.style.setProperty("width", "calc(100% - 70px)", "important");
                    cardHeaderDiv.appendChild(input);
                } else {
                    const cardHeaderH5 = document.createElement("span");
                    cardHeaderH5.classList.add("mb-0");
                    cardHeaderH5.innerText = key;
                    // Align the text center vertically
                    cardHeaderH5.style.display = "inline-block";
                    cardHeaderH5.style.verticalAlign = "middle";
                    cardHeaderH5.style.lineHeight = "normal";
                    // Align things in cardHeaderDiv center vertically
                    cardHeaderDiv.style.display = "flex";
                    cardHeaderDiv.style.alignItems = "center";
                    cardHeaderDiv.style.justifyContent = "space-between";
                    cardHeaderDiv.appendChild(cardHeaderH5);
                }
                if (typeof value === "object" && value["__type__"] === "radio") {
                    cardHeaderDiv.innerText = value["name"];
                }
                // Add a remove button to the card header
                const btnRemove = document.createElement("button");
                btnRemove.classList.add("btn");
                btnRemove.classList.add("btn-danger");
                btnRemove.classList.add("btn-sm");
                btnRemove.classList.add("float-right");
                btnRemove.innerHTML = "Remove";
                btnRemove.addEventListener("click", async function () {
                    yukon_state.zubax_apij.setting_was_removed(innerId);
                    delete settings[key];
                    delete settings[innerId]
                    parentDiv.innerHTML = "";
                    createSettingsDiv(settings, parentDiv, parentSettings, realDictionaryKey);
                });
                btnRemove.style.float = "right";
                cardHeaderDiv.appendChild(btnRemove);
                if (!Array.isArray(settings)) {
                    cardDiv.appendChild(cardHeaderDiv);
                }
                const cardBodyDiv = document.createElement("div");
                cardBodyDiv.classList.add("card-body");
                cardDiv.appendChild(cardBodyDiv);
                parentDiv.appendChild(cardDiv);
                createSettingsDiv(value, cardBodyDiv, settings, realDictionaryKey);
            } else {
                const formGroupDiv = document.createElement("div");
                formGroupDiv.classList.add("mb-3");
                const label = document.createElement("label");

                label.setAttribute("for", key);
                if (key === "__editable__") {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = "";
                    input.placeholder = "Enter new key";
                    label.appendChild(input);
                    formGroupDiv.appendChild(label);
                    // Add a submit button
                    const btnSubmit = document.createElement("button");
                    btnSubmit.classList.add("btn");
                    btnSubmit.classList.add("btn-primary");
                    btnSubmit.classList.add("btn-sm");
                    btnSubmit.classList.add("float-right");
                    btnSubmit.innerHTML = "Submit";
                    btnSubmit.addEventListener("click", async function () {
                        settings[input.value] = value;
                        parentDiv.innerHTML = "";
                        createSettingsDiv(settings, parentDiv, parentSettings, realDictionaryKey);
                    });
                    formGroupDiv.appendChild(btnSubmit);
                } else {
                    label.innerHTML = key;
                    if (!Array.isArray(settings)) {
                        formGroupDiv.appendChild(label);
                    }
                }

                // Put each input inside <div class="input-group mb-3">

                if (typeof value === 'boolean') {
                    const checkbox = document.createElement("input");
                    formGroupDiv.classList.add("form-check");
                    checkbox.classList.add("form-check-input");
                    label.classList.add("form-check-label");
                    checkbox.type = "checkbox";
                    checkbox.id = key;
                    checkbox.checked = value;
                    checkbox.addEventListener("change", async function () {
                        settings[key] = checkbox.checked;
                    });
                    formGroupDiv.appendChild(checkbox);
                } else {
                    formGroupDiv.classList.add("input-group");
                    if (typeof value === 'number') {
                        const input = document.createElement("input");
                        input.type = "number";
                        input.style.display = "inline";
                        input.classList.add("form-control");
                        input.value = value;
                        input.style.width = "calc(100% - 70px)"
                        input.addEventListener("change", async function () {
                            settings[key] = parseFloat(input.value);
                            yukon_state.zubax_apij.setting_was_changed(innerId, input.value)
                        });
                        input.title = "Number field"
                        formGroupDiv.appendChild(input);
                    } else {
                        const input = document.createElement("input");
                        input.type = "text";
                        input.style.display = "inline";
                        input.style.width = "calc(100% - 70px)"
                        input.classList.add("form-control");
                        input.value = value;
                        input.addEventListener("change", async function () {
                            settings[key] = input.value;
                            yukon_state.zubax_apij.setting_was_changed(innerId, input.value)
                        });
                        input.title = "Text field";
                        formGroupDiv.appendChild(input);
                    }
                }
                parentDiv.appendChild(formGroupDiv);
                // If settings is an array, add a button for removing the element from the array
                if (Array.isArray(settings)) {
                    const btnRemove = document.createElement("button");
                    btnRemove.classList.add("btn");
                    btnRemove.classList.add("btn-danger");
                    btnRemove.classList.add("btn-sm");
                    btnRemove.style.display = "inline";
                    btnRemove.innerHTML = "Remove";
                    btnRemove.addEventListener("click", async function () {
                        settings.splice(key, 1);
                        yukon_state.zubax_apij.setting_was_removed(innerId)
                        parentDiv.innerHTML = "";
                        createSettingsDiv(settings, parentDiv, parentSettings, realDictionaryKey);
                    });
                    formGroupDiv.appendChild(btnRemove);
                }
            }
        }
        if (Array.isArray(settings)) {
            // Put three buttons in a <div class="btn-group"> for adding a bool, int or string to the array
            const btnGroupDiv = document.createElement("div");
            btnGroupDiv.classList.add("btn-group");
            btnGroupDiv.classList.add("mb-3");
            // const btnAddBool = document.createElement("button");
            // btnAddBool.classList.add("btn");
            // btnAddBool.classList.add("btn-primary");
            // btnAddBool.innerText = "Add bool";
            // btnAddBool.addEventListener("click", function () {
            //     settings.push({ "__editable__": true });
            //     parentDiv.innerHTML = "";
            //     createSettingsDiv(settings, parentDiv);
            // });
            // const btnAddInt = document.createElement("button");
            // btnAddInt.classList.add("btn");
            // btnAddInt.classList.add("btn-primary");
            // btnAddInt.innerText = "Add int";
            // btnAddInt.addEventListener("click", function () {
            //     settings.push(0);
            //     parentDiv.innerHTML = "";
            //     createSettingsDiv(settings, parentDiv);
            // });
            const btnAddPath = document.createElement("button");
            btnAddPath.classList.add("btn");
            btnAddPath.classList.add("btn-primary");
            btnAddPath.innerText = "Add path";
            btnAddPath.addEventListener("click", function () {
                settings.push({ "__id__": guid(), "__type__": "dirpath", "value": "" });
                parentDiv.innerHTML = "";
                createSettingsDiv(settings, parentDiv, parentSettings, null);
            });
            const btnAddString = document.createElement("button");
            btnAddString.classList.add("btn");
            btnAddString.classList.add("btn-primary");
            btnAddString.innerText = "Add string";
            btnAddString.addEventListener("click", function () {
                settings.push(guid())
                settings.push("");
                yukon_state.zubax_apij.array_item_was_added(innerId,)
                parentDiv.innerHTML = "";
                createSettingsDiv(settings, parentDiv, parentSettings, null);
            });
            // btnGroupDiv.appendChild(btnAddBool);
            // btnGroupDiv.appendChild(btnAddInt);
            btnGroupDiv.appendChild(btnAddPath);
            btnGroupDiv.appendChild(btnAddString);
            parentDiv.appendChild(btnGroupDiv);
        }
    }

    // TODO: This saving should take place when settings have been modified, not on a timer
    setInterval(async function () {
        await yukon_state.zubax_apij.save_settings();
    }, 1000);

    createSettingsDiv(settings, settingsDiv, null, null)
    setInterval(function () {
        settingsDebugDiv.innerHTML = JSON.stringify(settings, null, 2);
    }, 1000);
}