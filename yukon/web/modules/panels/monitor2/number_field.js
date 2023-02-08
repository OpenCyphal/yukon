import { guid } from "../../guid.js";
import { createDatatypeField } from "./autocomplete.field.js";
import { createSpinner } from "./spinner.module.js";
import { createRemoveButton } from "./publishers.module.js";
export async function createNumberFieldRow(publisher, yukon_state, field) {
    const row = document.createElement('div');
    const rowId = guid();
    if (field && field.id) {
        row.id = field.id;
    } else {
        row.id = rowId;
    }
    if (!field) {
        field = (await yukon_state.zubax_apij.make_publisher_field(publisher.id, rowId)).field;
        console.log(field);
    }
    row.classList.add("publisher-row");
    // Add a text field of 250px width, after that a number field of 50px width and a spinenr and a number field of 50px width
    row.appendChild(await createDatatypeField(publisher, field, yukon_state));
    const numberField1 = document.createElement('input');
    numberField1.type = "number";
    numberField1.classList.add("number-field");
    numberField1.classList.add("min-value-field")
    numberField1.style.width = "50px";
    numberField1.value = field.min;
    numberField1.title = "Minimum value";
    row.appendChild(numberField1);
    const valueField = document.createElement('input');
    valueField.title = "Value";
    const numberField2 = document.createElement('input');
    const spinner = createSpinner("100%",
        (x) => { // Value changed callback
            valueField.value = x;
            yukon_state.zubax_apij.set_publisher_field_value(publisher.id, field.id, parseFloat(valueField.value));
        },
        () => parseFloat(numberField1.value), // Get minimum value
        () => parseFloat(numberField2.value) // Get maximum value
    );

    const spinnerElement = spinner.spinnerElement;
    spinnerElement.style.marginLeft = "2px";
    spinnerElement.style.marginRight = "2px";
    spinnerElement.title = "Value knob / dial"
    row.appendChild(spinnerElement);
    numberField2.classList.add("max-value-field");
    numberField2.title = "Maximum value";
    numberField2.type = "number";
    numberField2.classList.add("number-field");
    numberField2.style.width = "50px";
    numberField2.value = field.max;
    numberField2.addEventListener('input', async () => {
        if (parseFloat(valueField.value) > parseFloat(numberField2.value)) {
            spinner.setValue(parseFloat(numberField2.value));
        }
        await yukon_state.zubax_apij.set_field_min_max(publisher.id, field.id, parseFloat(numberField1.value), parseFloat(numberField2.value));
        // numberField2.dispatchEvent(new CustomEvent('maxChanged', {
        //     bubbles: true,
        // }));
    });
    numberField1.addEventListener('input', async () => {
        if (parseFloat(valueField.value) < parseFloat(numberField1.value)) {
            spinner.setValue(parseFloat(numberField1.value));
        }
        await yukon_state.zubax_apij.set_field_min_max(publisher.id, field.id, parseFloat(numberField1.value), parseFloat(numberField2.value));
    });
    row.appendChild(numberField2);
    // Add a number field for value
    valueField.type = "number";
    valueField.classList.add("value-field");
    valueField.style.width = "100px";
    valueField.addEventListener('input', async () => {
        yukon_state.zubax_apij.set_publisher_field_value(publisher.id, field.id, parseFloat(valueField.value));
        spinner.setValue(parseFloat(valueField.value));
    });
    spinner.setValue(parseFloat(field.value));
    valueField.value = field.value;
    row.appendChild(valueField);
    // Add a remove button
    const removeButton = createRemoveButton(publisher, field, row, yukon_state);
    row.appendChild(removeButton);
    return row;
}