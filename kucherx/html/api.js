const zubax_api = {}

const proxy1 = new Proxy(zubax_api, {
    get(target, prop) {
        console.log("get", prop)
        if(prop == "api_ready") {
            return function() {
                let myPromise = new Promise((resolve, reject) => {
                    $.get(prop, function(data, status) {
                        resolve();
                    });
                });
                return myPromise;
            }
        } else {
            return function() {
                let data = arguments;
                let myPromise = new Promise((resolve, reject) => {
                    $.post(prop, data, function(data, status) {
                        resolve(data);
                    });
                });
                return myPromise;
            }
        }
    },
});
