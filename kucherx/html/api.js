const _zubax_api = { "empty": true }
let zubax_api_ready = false;
const zubax_api = new Proxy(_zubax_api, {
    get(target, prop) {
        let url = "/" + prop;
        return function () {
            let data = { "arguments": [] };
            // For each argument in arguments, put it into data.arguments
            for (let i = 0; i < arguments.length; i++) {
                data.arguments.push(arguments[i]);
            }
            // for each element in arguments
            let myPromise = new Promise((resolve, reject) => {
                $.ajax(url, {
                    data: JSON.stringify(data),
                    contentType: 'application/json',
                    type: 'POST',
                }).done(function (data, status) {
                    resolve(data);
                });
            });
            return myPromise;
        }
    },
});
window.addEventListener('load', function () {
    window.dispatchEvent(new Event('zubax_api_ready'));
    zubax_api_ready = true;
});
