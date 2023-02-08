import { guid } from "../../guid.js";
export async function createBooleanFieldRow(publisher, yukon_state, field) {
    const row = document.createElement('div');
    const rowId = guid();
    row.id = rowId;
    row.classList.add("publisher-row");
    if (!field) {
        field = (await yukon_state.zubax_apij.make_publisher_field(publisher.id, rowId)).field;
    }
    // Add a text field of 250px width, after that a number field of 50px width and a spinenr and a number field of 50px width
    row.appendChild(await createDatatypeField(publisher, field, yukon_state));
    const booleanField = document.createElement('input');
    booleanField.type = "checkbox";
    booleanField.classList.add("boolean-field");
    row.appendChild(booleanField);
    // Add a remove button
    const removeButton = createRemoveButton(publisher, field, row, yukon_state);
    row.appendChild(removeButton);
    return row;
}