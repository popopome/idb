function run_done(func, timeout) {
    timeout = timeout || 250;
    var is_done = false;
    var done = function () { is_done = true; }

    runs(function () {
        func.apply(null, [done]);
    });

    waitsFor(function () {
        return is_done;
    }, timeout);
}

function random_sample_db() { return "sample-" + new Date().getTime(); }
var BASE_PATH = "/base/app/scripts/";

describe("IDB PROXY", function () {
    it("should open in background", function () {

        run_done(function (done) {
                idb_proxy.create(random_sample_db(), BASE_PATH)
                    .selectMany(function (proxy) {
                        return idb_proxy.set(proxy, "k1", "hello");
                    })
                    .selectMany(function (proxy) {
                        return idb_proxy.get(proxy, "k1");
                    })
                    .subscribe(function (proxy) {
                        expect(proxy.result).toBe("hello");
                        idb_proxy.destroy(proxy);
                        done();
                    });
            },
            2048 * 30);

    });


    it("should mset/mget/remove in background", function () {
        run_done(function (done) {
            idb_proxy.create(random_sample_db(), BASE_PATH)
                .selectMany(function (proxy) {
                    return idb_proxy.mset(proxy, [
                        {k: "k1", v: "v1"},
                        {k: "k2", v: "v2"}
                    ]);
                })
                .selectMany(function (proxy) {
                    expect(proxy.result).toBe(true);
                    return idb_proxy.mget(proxy, ["k1", "k2"])
                })

                .selectMany(function (proxy) {
                    expect(proxy.result.length).toBe(2);
                    expect(proxy.result[0]).toBe("v1");
                    expect(proxy.result[1]).toBe("v2");

                    return idb_proxy.remove(proxy, "k1");
                })
                .selectMany(function (proxy) {
                    expect(proxy.result).toBe(true);
                    return idb_proxy.contains(proxy, "k1");
                })
                .subscribe(function (proxy) {
                    expect(proxy.result).toBe(false);
                    idb_proxy.destroy(proxy);
                    done();
                })
        })
    })


    it("should push/pop from left or right direction", function () {
        run_done(function (done) {
            idb_proxy.create(random_sample_db(), BASE_PATH)
                .selectMany(function (proxy) {
                    return idb_proxy.lpush(proxy, "ar1", 1);
                })
                .subscribe(function (proxy) {
                    idb_proxy.destroy(proxy);
                    done();
                })
        })
    });


    it("should add/remove with set", function () {
        run_done(function (done) {
            idb_proxy.create(random_sample_db(), BASE_PATH)
                .selectMany(function (proxy) {
                    return idb_proxy.sadd(proxy, "p", "a", 1);
                })
                .selectMany(function (proxy) {
                    expect(proxy.result.v.a).toBe(1);
                    return idb_proxy.sadd(proxy, "p", "b", 2);
                })
                .selectMany(function (proxy) {
                    expect(proxy.result.v.a).toBe(1);
                    expect(proxy.result.v.b).toBe(2);
                    return idb_proxy.sremove(proxy, "p", "b");
                })
                .subscribe(function (proxy) {
                    expect(proxy.result.v.a).toBe(1);
                    expect(proxy.result.v.b).toBe(undefined);

                    idb_proxy.destroy(proxy);
                    done();
                })
        })
    });


    function idb_all_test(use_web_worker) {
        var cnt = 0;
        run_done(function (done) {
            idb_proxy.create(random_sample_db(), BASE_PATH, use_web_worker)
                .selectMany(function (proxy) {
                    return idb_proxy.mset(proxy, [
                        {k: "k1", v: "v1"},
                        {k: "k2", v: "v2"},
                        {k: "k3", v: "v3"}
                    ]);
                }).selectMany(function (proxy) {
                    return idb_proxy.all(proxy);
                }).subscribe(function (v) {
                    console.log("v: " + JSON.stringify(v.result));
                    ++cnt;
                }, function (err) {
                    ff.log("ERROR: " + err);
                }, function () {
                    expect(cnt).toBe(3);
                    done();
                });
        }, 256);

    }

    it("should retrieve every thing - ui thread version", function () {
        idb_all_test(false);
    });

    it("should retrieve every thing - worker version", function () {
        idb_all_test(true);
    });



    function idb_clear_and_count_test(use_web_worker) {
        run_done(function(done) {
            idb_proxy.create(random_sample_db(), BASE_PATH, use_web_worker)
                .selectMany(function(proxy) {
                    return idb_proxy.mset(proxy, [
                        idb.kv("a", 1),
                        idb.kv("b", 2),
                        idb.kv("c", 3)
                    ]);
                })
                .selectMany(function(proxy) {
                    return idb_proxy.count(proxy)
                }).selectMany(function(proxy) {
                    expect(proxy.result).toBe(3);
                    return idb_proxy.clear(proxy)
                }).selectMany(function(proxy) {
                    return idb_proxy.count(proxy)
                }).subscribe(function(proxy) {
                    expect(proxy.result).toBe(0);
                    done();
                })
        }, 256);
    }

    it("should clear database via proxy - fake worker version", function() {
        idb_clear_and_count_test(false);
    });

    it("should clear database via proxy - remote web worker version", function() {
        idb_clear_and_count_test(true);
    });

})
