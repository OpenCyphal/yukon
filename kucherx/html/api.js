const Api = {};

const proxy1 = new Proxy(Api, {
    get(target, prop) {
        let myPromise = new Promise((resolveOuter) => {
            resolveOuter(
                new Promise((resolveInner) => {
                setTimeout(resolveInner, 1000);
                })
            );
        });
        return myPromise;
    },
})

const p = new Proxy({}, handler);
p.a = 1;
console.log(p.a, p.b); // 1, 42
