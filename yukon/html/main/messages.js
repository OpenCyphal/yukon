(async function () {
    function waitForElm(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }
    function addLocalMessage(message) {
        zubax_api.add_local_message(message)
    }

    async function doStuffWhenReady() {

    }
    if (zubax_api_ready) {
        await doStuffWhenReady();
    } else {
        window.addEventListener('zubax_api_ready', async function () {
            await doStuffWhenReady();
        });
    }
})();
