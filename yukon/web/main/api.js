const _zubax_api = { "empty": true }

let zubax_api_ready = false;
const zubax_api = new Proxy(_zubax_api, {
    get(target, prop) {
        let url = "http://127.0.0.1:5000/api/" + prop;
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
