
function run_done(func, timeout) {
    timeout = timeout || 250;
    var is_done = false;
    var done = function() { is_done = true; }

    runs(function() {
        func.apply(null, [done]);
    });

    waitsFor(function() {
        return is_done;
    }, timeout);
}

function random_sample_db() {   return "sample-" + new Date().getTime();    }
var BASE_PATH = "/base/app/scripts/";

describe("IDB PROXY", function() {
    it("should open in background", function() {

        run_done(function(done) {
            idb_proxy.create(random_sample_db(), BASE_PATH)
                .selectMany(function(proxy) {
                    return idb_proxy.set(proxy, "k1", "hello");
                })
                .selectMany(function(proxy) {
                    return idb_proxy.get(proxy, "k1");
                })
                .subscribe(function(proxy) {
                    expect(proxy.result).toBe("hello");
                    idb_proxy.destroy(proxy);
                    done();
                });
        },
        2048*30);

    });


    it("should mset/mget/remove in background", function() {
        run_done(function(done) {
            idb_proxy.create(random_sample_db(), BASE_PATH)
                .selectMany(function(proxy) {
                    return idb_proxy.mset(proxy, [
                        {k:"k1", v:"v1"},
                        {k:"k2", v:"v2"}]);
                })
                .selectMany(function(proxy) {
                    expect(proxy.result).toBe(true);
                    return idb_proxy.mget(proxy, ["k1", "k2"])
                })

                .selectMany(function(proxy) {
                    expect(proxy.result.length).toBe(2);
                    expect(proxy.result[0]).toBe("v1");
                    expect(proxy.result[1]).toBe("v2");

                    return idb_proxy.remove(proxy, "k1");
                })
                .selectMany(function(proxy) {
                    expect(proxy.result).toBe(true);
                    return idb_proxy.contains(proxy, "k1");
                })
                .subscribe(function(proxy) {
                    expect(proxy.result).toBe(false);
                    idb_proxy.destroy(proxy);
                    done();
                })
        })
    })

    it("should push/pop from left or right direction", function() {
        run_done(function(done) {
            idb_proxy.create(random_sample_db(), BASE_PATH)
                .selectMany(function(proxy) {
                    return idb_proxy.lpush(proxy, "ar1", 1);
                })
                .subscribe(function(proxy) {
                    debugger;
                    idb_proxy.destroy(proxy);
                    done();
                })
        })
    })
})
