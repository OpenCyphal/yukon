const _zubax_api = { "empty": true }
let zubax_api_ready = false;
function JsonParseHelper(k, v) {
    if (v === Infinity) {
        return "Infinity";
    } else if (v === NaN) {
        return "NaN";
    } else {
        return v;
    }
}
const zubax_api = new Proxy(_zubax_api, {
    get(target, prop) {
        let url = "http://localhost:5000/api/" + prop;
        return async function () {
            let data = { "arguments": [] };
            // For each argument in arguments, put it into data.arguments
            for (let i = 0; i < arguments.length; i++) {
                data.arguments.push(arguments[i]);
            }
            // for each element in arguments
            const response = await (fetch(url, {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                mode: 'cors', // no-cors, *cors, same-origin
                cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
                credentials: 'same-origin', // include, *same-origin, omit
                headers: {
                  'Content-Type': 'application/json'
                  // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                redirect: 'follow', // manual, *follow, error
                referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
                body: JSON.stringify(data) // body data type must match "Content-Type" header
            }));
            const text_response = await response.text();
            return text_response;
        }
    },
});
const zubax_apij = new Proxy(_zubax_api, {
    get(target, prop) {
        let url = "http://localhost:5000/api/" + prop;
        return async function () {
            let data = { "arguments": [] };
            // For each argument in arguments, put it into data.arguments
            for (let i = 0; i < arguments.length; i++) {
                data.arguments.push(arguments[i]);
            }
            // for each element in arguments
            const response = await (fetch(url, {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                mode: 'cors', // no-cors, *cors, same-origin
                cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
                credentials: 'same-origin', // include, *same-origin, omit
                headers: {
                  'Content-Type': 'application/json'
                  // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                redirect: 'follow', // manual, *follow, error
                referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
                body: JSON.stringify(data) // body data type must match "Content-Type" header
            }));
            const object_response = await response.text();
            return JSON.parse(object_response, JsonParseHelper);
        }
    },
});

const _zubax_reception_api = { "empty": true }
const zubax_reception_api = new Proxy(_zubax_reception_api, {
    get(target, prop) {
        return {
            "connect": function (callback) {
                setInterval(function () {
                    const uri = "ws://localhost:8765/" + prop;
                    console.log("Trying to connect to " + uri);
                    const socket = new WebSocket(uri);
                    socket.onopen = function () {
                        console.log("Connected to " + prop);
                    }
                    socket.onmessage = function (message) {
                        console.log("Message from " + prop + ": " + message.data);
                        callback(message.data);
                        socket.send("Yep, it works!");
                    }
                    socket.onerror = function (error) {
                        console.error(`[error] ${error.message}`);
                    };
                }, 200);
            }
        }
    }
});
window.addEventListener('load', function () {
    window.dispatchEvent(new Event('zubax_api_ready'));
    zubax_api_ready = true;
});
