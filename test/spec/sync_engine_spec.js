describe("sync engine", function () {

  function dump_task(task) {
    console.log([
      task.k, ",",
      task_kind_to_string(task.kind), ",",
      task.type, ","
    ].join(""));
  }
  function create_access_func(data) {
    return function (k) {
      if (!k) {
        if (!!data)
          return Rx.Observable.fromArray(data);

        return Rx.Observable.empty();
      }
      if (!data)
        return Rx.Observable.returnValue(null);

      return Rx.Observable.returnValue(_.findWhere(data, {k:k}));
    }
  }

  it("should sync based on local", function () {

    run_done(function (done) {

      var cnt = 0;
      var sync = sync_create("00000",
        create_access_func([
          {k: "collect", type: SYNC_DATA_FOLDER, tm: 10243143},
          {k: "collect_file", type: SYNC_DATA_FILE, tm: 134234}
        ]),
        create_access_func(),
        create_access_func(),
        function (sync_obj, task) {

          if (cnt === 0) {
            expect(task.k).toEqual("collect");
            expect(task.kind).toBe(SYNC_TASK_REMOTE_MKDIR);
          }
          else if (cnt === 1) {
            expect(task.k).toEqual("collect_file");
            expect(task.kind).toBe(SYNC_TASK_UPLOAD);
          }
          else
            expect(false).toBe(true);

          ++cnt;

          return Rx.Observable.returnValue(true);
        });

      sync_run_as_ob(sync)
        .subscribe(function () {}, function (err) {} , function () {
          expect(cnt).toBe(2);
          done();
        })
    }, 1024);
  })

  it("should sync based on syncdb", function () {
    var cnt = 0;
    run_done(function (done) {
      var sync = sync_create("00010000",
        create_access_func(),
        create_access_func([
          {k: "a", type: SYNC_DATA_FOLDER, tm: 123456789, rev: 0},
          {k: "b", type: SYNC_DATA_FILE, tm: 123434723, rev: 1}
        ]),
        create_access_func(),
        function (sync_obj, task) {
          if (0 === cnt) {
            expect(task.kind).toBe(SYNC_TASK_REMOTE_RMDIR);
          } else if (1 === cnt) {
            expect(task.kind).toBe(SYNC_TASK_REMOTE_RM);
          }
          ++cnt;

          return Rx.Observable.returnValue(true);
        });

      sync_run_as_ob(sync)
        .subscribe(function () {}, function (err) {}, function () {
          expect(cnt).toBe(2);
          done();
        });

    }, 256);
  });

  it("should sync based on remotedb", function() {
    var cnt = 0;
    run_done(function(done) {
      var sync = sync_create("0002_0000",
        create_access_func(),
        create_access_func(),
        create_access_func([
          {k: "aa", type: SYNC_DATA_FOLDER, exists: true, rev: 0},
          {k: "ab", type: SYNC_DATA_FILE,   exists: true, rev: 1}
        ]),
        function(sync_obj, task) {
          ++cnt;
          return Rx.Observable.returnValue(true);
        }
      );

      sync_run_as_ob(sync)
        .subscribe(function() {}, function(err) {}, function() {
          expect(cnt).toBe(2);
          done();
        })

    }, 256);
  });

  it("should sync between local and sync db", function() {

    var cnt = 0;
    run_done(function(done) {
      var sync = sync_create("0003_0000",
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, tm: 1},
          {k:"a/b", type: SYNC_DATA_FILE,   tm: 2},
          {k:"a/c", type: SYNC_DATA_FILE,   tm: 3}
        ]),
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, tm: 2, rev: 0},
          {k:"a/b", type: SYNC_DATA_FILE,   tm: 2, rev: 0},
          {k:"a/c", type: SYNC_DATA_FILE,   tm: 4, rev: 0},
          {k:"a/d", type: SYNC_DATA_FILE,   tm: 5, rev: 0}
        ]),
        create_access_func(),
        function(sync_obj, task) {
          dump_task(task);
          if(cnt === 0) {
            expect(task.kind).toBe(SYNC_TASK_REMOTE_RM);
            expect(task.k).toBe("a/d");
          }
          ++cnt;

          return Rx.Observable.returnValue(true);
        });

      sync_run_as_ob(sync)
        .subscribe(function() {}, function(err) {}, function() {
          expect(cnt).toBe(1);
          done();
        })

    }, 256);
  })

  it("should sync between sync db and remote", function() {
    var cnt = 0;

    run_done(function(done) {
      var sync = sync_create("0004_0000",
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, tm:1},
          {k:"a/b", type: SYNC_DATA_FILE,   tm:1},
          {k:"a/c", type: SYNC_DATA_FILE,   tm:1},
          {k:"a/d", type: SYNC_DATA_FILE,   tm:2}
        ]),
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, tm:1, rev:0},
          {k:"a/b", type: SYNC_DATA_FILE,   tm:1, rev:1},
          {k:"a/c", type: SYNC_DATA_FILE,   tm:1, rev:1},
          {k:"a/d", type: SYNC_DATA_FILE,   tm:2, rev:2}
        ]),
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, exists: true, rev: 0},
          {k:"a/b", type: SYNC_DATA_FILE,   exists: true, rev: 1},
          {k:"a/c", type: SYNC_DATA_FILE,   exists: true, rev: 2},
          {k:"a/d", type: SYNC_DATA_FILE,   exists: true, rev: 1}
        ]),
        function(sync_obj, task) {
          dump_task(task);
          if(cnt === 0) {
            expect(task.kind).toBe(SYNC_TASK_DOWNLOAD);
            expect(task.k).toBe("a/c");
          }
          ++cnt;
          return Rx.Observable.returnValue(true);
        }
      );

      sync_run_as_ob(sync)
        .subscribe(function() {}, function(err) {}, function() {
          expect(cnt).toBe(1);
          done();
        })
    }, 256);
  });

  it("should sync between local, sync and remote db", function() {
    var cnt = 0;

    run_done(function(done) {
      var sync = sync_create("0005_0000",
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, tm: 1},
          {k:"a/b", type: SYNC_DATA_FILE,   tm: 1},
          {k:"a/c", type: SYNC_DATA_FILE,   tm: 2},
          {k:"a/d", type: SYNC_DATA_FILE,   tm: 3},
          {k:"b",   type: SYNC_DATA_FOLDER, tm: 4},
          {k:"y",   type: SYNC_DATA_FILE,   tm: 1}
        ]),
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, tm: 1, rev: 0},
          {k:"a/b", type: SYNC_DATA_FILE,   tm: 1, rev: 1},
          {k:"a/c", type: SYNC_DATA_FILE,   tm: 1, rev: 2},
          {k:"x",   type: SYNC_DATA_FILE,   tm: 1, rev: 3},
          {k:"y",   type: SYNC_DATA_FILE,   tm: 1, rev: 4}
        ]),
        create_access_func([
          {k:"a",   type: SYNC_DATA_FOLDER, exists: true, rev: 0},
          {k:"a/b", type: SYNC_DATA_FILE,   exists: true, rev: 2},
          {k:"y",   true: SYNC_DATA_FILE,   exists: false, rev: 5}
        ]),
        function(sync_obj, task) {
          dump_task(task);
          if(0 === cnt) {
            expect(task.k).toBe("a/c");
            expect(task.kind).toBe(SYNC_TASK_UPLOAD);
          } else if(1 === cnt) {
            expect(task.k).toBe("a/d");
            expect(task.kind).toBe(SYNC_TASK_UPLOAD);
          } else if(2 === cnt) {
            expect(task.k).toBe("b");
            expect(task.kind).toBe(SYNC_TASK_REMOTE_MKDIR);
          } else if(3 === cnt) {
            expect(task.k).toBe("x");
            expect(task.kind).toBe(SYNC_TASK_REMOTE_RM);
          } else if(4 === cnt) {
            expect(task.k).toBe("a/b");
            expect(task.kind).toBe(SYNC_TASK_DOWNLOAD);
          } else if(5 === cnt) {
            expect(task.k).toBe("y");
            expect(task.kind).toBe(SYNC_TASK_LOCAL_RM);

          }

          ++cnt;
          return Rx.Observable.returnValue(true);
        }
      );

      sync_run_as_ob(sync)
        .subscribe(function() {}, function(err) {}, function() {
          expect(cnt).toBe(6);
          done();
        })

    }, 256);

  })
});
