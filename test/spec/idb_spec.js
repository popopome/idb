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

function random_db_name() {
    return new Date().getTime() + "__test";
}

describe("IDB", function () {

    it("should open db as expected", function () {

        run_done(function (done) {

            console.log("______________STARTED");

            idb.open("a")
                .selectMany(idb.set_func("test:object", {a: 1, b: "ssfdd"}))
                .selectMany(idb.get_func("test:object"))
                .selectMany(function (ctx) {
                    console.log(ctx.result);
                    expect(ctx.result).toEqual({a: 1, b: "ssfdd"});
                    return Rx.Observable.returnValue(ctx);
                })
                .selectMany(idb.set_func("xyz", [1, 2, 3]))
                .selectMany(idb.get_func("xyz"))
                .selectMany(function (ctx) {
                    expect(ctx.result).toEqual([1, 2, 3]);
                    return idb.set(ctx, "test:1", "1");
                })
                .selectMany(function (ctx) {
                    return idb.get(ctx, "test:1");
                })
                .subscribe(function (ctx) {

                    expect(ctx).not.toBe(null);
                    expect(idb.result(ctx)).toBe("1");

                    console.log("______________DONE");
                    done();
                });
        }, 250);
    });


    it("should return multiple values", function () {

        run_done(function (done) {

            idb.open(new Date().getTime() + "__test")
                .selectMany(idb.set_func("test:1", 1))
                .selectMany(idb.set_func("test:2", 2))
                .selectMany(function (ctx) {
                    return idb.mget(ctx, ["test:1", "nonono", "test:2"], "___my__test__");
                })
                .subscribe(function (ctx) {

                    expect(idb.result(ctx)).toEqual([1, "___my__test__", 2]);
                    done();
                });
        }, 250);
    });

    it("should set multiple values", function () {
        run_done(function (done) {
            idb.open(random_db_name())
                .selectMany(function (ctx) {
                    return idb.mset(ctx, [
                        idb.kv("a:1", 1),
                        idb.kv("a:2", 2),
                        idb.kv("a:3", 3)
                    ]);
                })
                .selectMany(function (ctx) {
                    return idb.mget(ctx, ["a:1", "a:2", "a:3"]);
                })
                .subscribe(function (ctx) {
                    expect(idb.result(ctx)).toEqual([1, 2, 3]);
                    done();
                })
        })
    });

    it("should delete data", function () {
        run_done(function (done) {
            idb.open(random_db_name())
                .selectMany(function (ctx) {
                    return idb.set(ctx, "x", 30);
                })
                .selectMany(function (ctx) {
                    return idb.remove(ctx, "x");
                })
                .selectMany(function (ctx) {
                    return idb.get(ctx, "x");
                })
                .subscribe(function (ctx) {
                    expect(idb.result(ctx)).toBe(undefined);
                    done();
                })
        });
    });

    it("should push to left", function () {
        run_done(function (done) {
            idb.open(random_db_name())
                .selectMany(function (ctx) {
                    return idb.lpush(ctx, "ids", 1);
                })
                .selectMany(function (ctx) {
                    return idb.lpush(ctx, "ids", 2);
                })
                .selectMany(function (ctx) {
                    return idb.get(ctx, "ids");
                })
                .subscribe(function (ctx) {
                    expect(ctx.result).toEqual([2, 1]);
                    done();
                })
        })
    });

    it("should push to right", function () {
        run_done(function (done) {
            idb.open(random_db_name())
                .selectMany(function (ctx) { return idb.rpush(ctx, "ids", 1); })
                .selectMany(function (ctx) { return idb.rpush(ctx, "ids", 2); })
                .selectMany(function (ctx) { return idb.lpush(ctx, "ids", 0); })
                .selectMany(function (ctx) {
                    return idb.llen(ctx, "ids")
                })
                .select(function (ctx) {
                    expect(ctx.result).toBe(3);
                    return ctx;
                })
                .selectMany(idb.get_func("ids"))
                .subscribe(function (ctx) {
                    expect(ctx.result).toEqual([0, 1, 2]);
                    done();
                });
        });
    });

    it("should increase a value", function () {
        run_done(function (done) {
            idb.open(random_db_name())
                .selectMany(function (ctx) { return idb.set(ctx, "seq", 0); })
                .selectMany(function (ctx) { return idb.incr(ctx, "seq"); })
                .selectMany(function (ctx) {
                    expect(ctx.result).toBe(1);

                    return idb.incr(ctx, "seq");
                })
                .selectMany(function (ctx) { return idb.decr(ctx, "seq"); })
                .subscribe(function (ctx) {
                    expect(ctx.result).toBe(1);
                    done();
                })
        })
    });

    it("should pop left and right", function () {
        run_done(function (done) {
            idb.open(random_db_name())
                .selectMany(function (ctx) { return idb.rpush(ctx, "ids", 1); })
                .selectMany(function (ctx) { return idb.rpush(ctx, "ids", 2); })
                .selectMany(function (ctx) { return idb.lpush(ctx, "ids", 0); })
                .selectMany(function (ctx) { return idb.lpop(ctx, "ids") })
                .selectMany(function (ctx) {
                    expect(ctx.result.pop_value).toBe(0);
                    expect(ctx.result.v).toEqual([1, 2]);
                    return idb.rpop(ctx, "ids");
                })
                .selectMany(function (ctx) {
                    expect(ctx.result.pop_value).toBe(2);
                    expect(ctx.result.v).toEqual([1]);
                    return idb.get(ctx, "ids")
                })
                .subscribe(function (ctx) {
                    expect(ctx.result).toEqual([1]);
                    done();
                });
        });
    });

    it("should add or remove k,v from set", function () {
        run_done(function (done) {
            idb.open(random_db_name())
                .selectMany(function (ctx) { return idb.sadd(ctx, "p", "xx", "a"); })
                .selectMany(function (ctx) {
                    expect(ctx.result.v.xx).toBe("a");
                    return idb.sadd(ctx, "p", "xy", "ab");
                })
                .selectMany(function (ctx) {
                    expect(ctx.result.v.xx).toBe("a");
                    expect(ctx.result.v.xy).toBe("ab");

                    return idb.sadd(ctx, "p", "xyz", "abc");
                })
                .selectMany(function (ctx) {
                    expect(ctx.result.v.xx).toBe("a");
                    expect(ctx.result.v.xy).toBe("ab");
                    expect(ctx.result.v.xyz).toBe("abc");

                    return idb.sremove(ctx, "p", "xyz");
                })
                .selectMany(function (ctx) {
                    expect(ctx.result.v.xx).toBe("a");
                    expect(ctx.result.v.xy).toBe("ab");
                    expect(ctx.result.v.xyz).toBe(undefined);

                    return idb.sremove(ctx, "p", "xy");
                })
                .selectMany(function (ctx) {
                    expect(ctx.result.v.xx).toBe("a");
                    expect(ctx.result.v.xy).toBe(undefined);
                    expect(ctx.result.v.xyz).toBe(undefined);

                    return idb.sremove(ctx, "p", "xy");
                })
                .selectMany(function (ctx) {
                    expect(ctx.result.v.xx).toBe("a");
                    expect(ctx.result.v.xy).toBe(undefined);
                    expect(ctx.result.v.xyz).toBe(undefined);

                    return idb.sremove(ctx, "p", "delete-non-exist-key");
                })
                .selectMany(function (ctx) {
                    expect(ctx.result.v.xx).toBe("a");
                    expect(ctx.result.v.xy).toBe(undefined);
                    expect(ctx.result.v.xyz).toBe(undefined);

                    return idb.sremove(ctx, "p", "xx");
                })
                .subscribe(function (ctx) {
                    expect(ctx.result.v.xx).toBe(undefined);
                    expect(ctx.result.v.xy).toBe(undefined);
                    expect(ctx.result.v.xyz).toBe(undefined);
                    done();
                })
        })
    });


    it("should iterate empty idb", function () {
        run_done(function (done) {
            idb.open("000000")
                .subscribe(function (ctx) {
                    idb.all(ctx)
                        .subscribe(function () {},
                        function (err) {},
                        function () {
                            console.log("EMPTY rows. DONE called");
                            done();
                        })
                });
        }, 512);
    });

    it("should count and delete object store", function() {
        run_done(function(done) {
          idb.open("0123456")
              .selectMany(function(ctx) {
                  return idb.mset(ctx, [
                      idb.kv("a_1", 1),
                      idb.kv("a_2", 2),
                      idb.kv("a_3", 3)
                  ])
              })
              .selectMany(function(ctx) {
                  return idb.count(ctx);
              })
              .selectMany(function(ctx) {
                  expect(ctx.result).toBe(3);
                  return idb.contains(ctx, "a_1")
              })
              .selectMany(function(ctx) {
                  expect(ctx.result).toBe(true);
                  return idb.clear(ctx);
              })
              .selectMany(function(ctx) {
                  return idb.contains(ctx, "a_1")
              })
              .selectMany(function(ctx) {
                  expect(ctx.result).toBe(false);
                  return idb.count(ctx);
              })
              .subscribe(function(ctx) {
                  expect(ctx.result).toBe(0);
                  done();
              })
        }, 256);
    })

});



