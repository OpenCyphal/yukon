const _zubax_api = {"empty": true}
console.log("Loading zubax_api");
const zubax_api = new Proxy(_zubax_api, {
    get(target, prop) {
        console.log("get", prop)
        let url = "/" + prop;
        console.log("url", url)
        return function() {
            let data = {"arguments": []};
            // For each argument in arguments, put it into data.arguments
            for (let i = 0; i < arguments.length; i++) {
                data.arguments.push(arguments[i]);
            }
            // for each element in arguments
            let myPromise = new Promise((resolve, reject) => {
                console.log("Sending a post request to", url)
                $.ajax(url, {
                    data : JSON.stringify(data),
                    contentType : 'application/json',
                    type : 'POST',
                }).done(function(data, status) {
                    console.log("Post request to " + url + " with data " + data + " and status " + status + " returned");
                    resolve(data);
                });
            });
            return myPromise;
        }
    },
});
window.addEventListener('load', function () {
    window.dispatchEvent( new Event('zubax_api_ready') );
});
