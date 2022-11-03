function fallbackCopyTextToClipboard(text, event) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}

export async function copyTextToClipboard(text, event) {
    try {
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(text);
            return;
        }
        await navigator.clipboard.writeText(text)
        console.log('Async: Copying to clipboard was successful!');
        return true
    } catch (err) {
        console.error('Async: Could not copy text: ', err);
        return false
    }
}