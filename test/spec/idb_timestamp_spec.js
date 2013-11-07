

xdescribe("idb timestamp", function() {
   it("should have timestamp", function() {
    run_done(function(done) {
      var k   = "test:object";
      var k2  = "test2:object";
      idb.open(random_db_name())
        .selectMany(idb.set_func(k, {a:1, b:2}))
        .selectMany(idb.set_func(k2, {a:3, b:4}))
        .selectMany(idb.get_func(k))
        .selectMany(function(ctx) {
          expect(ctx.result).toEqual({a:1,b:2})

          return idb.all(ctx);
        })
        .subscribe(function(ctx) {
          console.log("ALL RESULT: " + JSON.stringify(ctx.result));
        },
        function(err) {},
        function() { done(); })

    }, 1024);
  });
})
