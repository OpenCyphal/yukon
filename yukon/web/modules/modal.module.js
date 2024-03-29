export function createGenericModal(escapeCallback) {
    let modal = document.createElement("div");
    modal.id = "modal";
    modal.classList.add("my-modal");
    let modal_content = document.createElement("div");
    modal_content.classList.add("my-modal-content");
    modal_content.style.position = "relative";
    modal.appendChild(modal_content);
    let modal_close = document.createElement("button");
    // Position the modal_close in the top right corner
    modal_close.style.position = "absolute";
    modal_close.style.top = "0";
    modal_close.style.right = "0";
    modal_close.style.margin = "10px";
    modal_close.classList.add("btn");
    modal_close.classList.add("btn-danger");
    let escapeListener = null;
    let disconnectEscapeListener = function () {
        if (escapeListener) {
            document.removeEventListener("keydown", escapeListener);
            escapeListener = null;
        }
    }
    modal_close.innerHTML = "Close";
    modal_close.onclick = function () {
        disconnectEscapeListener();
        document.body.removeChild(modal);
    }
    modal_content.appendChild(modal_close);

    escapeListener = function (event) {
        if (event.key === "Escape") {
            console.log("Escape was pressed to close a modal");
            disconnectEscapeListener();
            if (modal.parentNode === document.body) {
                if (escapeCallback) {
                    escapeCallback();
                }
                document.body.removeChild(modal);
            }
        }
    }
    // Also close the modal if escape is pressed
    document.addEventListener("keydown", escapeListener);
    return { "modal": modal, "modal_content": modal_content };
}