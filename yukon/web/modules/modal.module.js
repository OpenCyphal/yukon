export function createGenericModal(escapeCallback) {
    let modal = document.createElement("div");
    modal.id = "modal";
    modal.style.position = "fixed";
    modal.style.top = "0px";
    modal.style.left = "0px";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modal.style.zIndex = "100";
    modal.style.display = "flex";
    // Put it vertically to the top
    modal.style.alignItems = "flex-start";
    modal.style.justifyContent = "center";
    let modal_content = document.createElement("div");
    modal_content.style.backgroundColor = "white";
    modal_content.style["margin-top"] = "10vh";
    modal_content.style.padding = "20px";
    modal_content.style.borderRadius = "10px";
    modal_content.style.width = "80%";
    modal.appendChild(modal_content);
    let modal_close = document.createElement("button");
    modal_close.classList.add("btn");
    modal_close.classList.add("btn-danger");
    let escapeListener = null;
    let disconnectEscapeListener = function() {
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
                if(escapeCallback) {
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