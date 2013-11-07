(function(root) {

  var SYNC_TASK_UPLOAD        = 0
    , SYNC_TASK_DOWNLOAD      = 1
    , SYNC_TASK_REMOTE_MKDIR  = 2
    , SYNC_TASK_REMOTE_RMDIR  = 3
    , SYNC_TASK_REMOTE_RM     = 4
    , SYNC_TASK_LOCAL_MKDIR   = 5
    , SYNC_TASK_LOCAL_RMDIR   = 6
    , SYNC_TASK_LOCAL_RM      = 7


  root.SYNC_TASK_UPLOAD        = SYNC_TASK_UPLOAD        ;
  root.SYNC_TASK_DOWNLOAD      = SYNC_TASK_DOWNLOAD      ;
  root.SYNC_TASK_REMOTE_MKDIR  = SYNC_TASK_REMOTE_MKDIR  ;
  root.SYNC_TASK_REMOTE_RMDIR  = SYNC_TASK_REMOTE_RMDIR  ;
  root.SYNC_TASK_REMOTE_RM     = SYNC_TASK_REMOTE_RM     ;
  root.SYNC_TASK_LOCAL_MKDIR   = SYNC_TASK_LOCAL_MKDIR   ;
  root.SYNC_TASK_LOCAL_RMDIR   = SYNC_TASK_LOCAL_RMDIR   ;
  root.SYNC_TASK_LOCAL_RM      = SYNC_TASK_LOCAL_RM      ;


  var task_kind_map = ["upload", "download", "remote mkdir", "remote rmdir", "remote rm",
    "local mkdir", "local rmdir", "local rm"];

  root.task_kind_to_string     = function(kind) {
    return task_kind_map[kind] || "unknown";
  }

  var SYNC_DATA_FOLDER        = 1
    , SYNC_DATA_FILE          = 2

  root.SYNC_DATA_FOLDER       = SYNC_DATA_FOLDER;
  root.SYNC_DATA_FILE         = SYNC_DATA_FILE;

  /**
   * Create sync object
   * @param sync_db_name
   * @param local_access_func
   * @param remote_access_func
   * @returns {{sync_db_name: *, local_access_func: *, remote_access_func: *}}
   */
  function sync_create(
    sync_name,
    local_access_func,
    sync_access_func,
    remote_access_func,
    task_execute_func) {

    return {
      sync_name           : sync_name,
      local_access_func   : local_access_func,
      sync_access_func    : sync_access_func,
      remote_access_func  : remote_access_func,
      tasks               : [],
      task_execute_func   : task_execute_func
    }
  }

  function sync_add_task(sync, task_kind, k, type) {
    sync.tasks.push({
      kind  : task_kind,
      k     : k,
      type  : type
    })
  }

  function get_local_delta_based_on_localdb(sync) {

    return sync.local_access_func()
      .selectMany(function(local_data) {
        return sync.sync_access_func(local_data.k)
          .select(function(v) {
            return {
              k         : local_data.k,
              type      : local_data.type,
              local_tm  : local_data.tm,
              sync_tm   : !!v ? v.tm : null
            };
          })
      }).select(function(data) {
        if(!data.sync_tm) {
          if(data.type  === SYNC_DATA_FOLDER) {
            sync_add_task(sync, SYNC_TASK_REMOTE_MKDIR, data.k, data.type);
          } else {
            sync_add_task(sync, SYNC_TASK_UPLOAD, data.k, data.type);
          }
        } else if(!!data.sync_tm && data.local_tm > data.sync_tm) {
          if(data.type === SYNC_DATA_FILE)
            sync_add_task(sync, SYNC_TASK_UPLOAD, data.k, data.type);
        } else {
          // do nothing.
          // sync data exists but the local one is same or
          // newer than synced one.
          console.log(sync.sync_name + ": do nothing...");
        }
      }).finallyAction(function() {
        console.log(sync.sync_name + ":--->LOCAL db based delta DONE");
      });
  }


  function get_local_delta_based_on_syncdb(sync) {

    return Rx.Observable.timer(0)
      .take(1)
      .selectMany(function()    { return sync.sync_access_func(); })
      .selectMany(function(sync_data) {
        return sync.local_access_func(sync_data.k)
          .select(function(v) {
            return {
              k         : sync_data.k,
              type      : sync_data.type,
              local_tm  : !!v ? v.tm : null,
              sync_tm   : sync_data.tm
            }
          })
      })
      .select(function(data) {
        if(!data.local_tm && !!data.sync_tm) {
          if(data.type === SYNC_DATA_FOLDER)
            sync_add_task(sync, SYNC_TASK_REMOTE_RMDIR, data.k);
          else
            sync_add_task(sync, SYNC_TASK_REMOTE_RM,    data.k);
        }
      })
      .finallyAction(function() {
        console.log(sync.sync_name + ":--->SYNC db based delta DONE");
      });
  }


  function get_remote_delta(sync) {
    return sync.remote_access_func()
      .selectMany(function(remote) {
        console.log("REMOTE DELTA called");
        return sync.sync_access_func(remote.k)
          .select(function(sync_data) {

            if(sync.sync_name === "0004_0000") {
              debugger;
            }

            if(!remote.exists && !!sync_data) {
              if(sync_data.type === SYNC_DATA_FOLDER)
                sync_add_task(sync, SYNC_TASK_LOCAL_RMDIR, remote.k);
              else
                sync_add_task(sync, SYNC_TASK_LOCAL_RM, remote.k);
            } else if(!!remote.exists && sync_data === null) {
              if(remote.type === SYNC_DATA_FOLDER)
                sync_add_task(sync, SYNC_TASK_LOCAL_MKDIR, remote.k);
              else
                sync_add_task(sync, SYNC_TASK_DOWNLOAD, remote.k);
            } else if(!!remote.exists && sync_data.rev !== null && remote.rev > sync_data.rev) {
              sync_add_task(sync, SYNC_TASK_DOWNLOAD, remote.k);
            } else {
              console.log("REMOTE: exists(%s), SYNC:%s", remote.exists, sync_data);
            }
          })
      })
      .finallyAction(function() {
        console.log(sync.sync_name + ":--->REMOTE db based delta DONE");
      })
  }


  function get_sync_tasks(sync) {
    var ob_localdb_based  = get_local_delta_based_on_localdb(sync);
    var ob_syncdb_based   = get_local_delta_based_on_syncdb(sync);
    var ob_remote_based   = get_remote_delta(sync);

    return Rx.Observable.createWithDisposable(function(ob) {
      return Rx.Observable.concat(ob_localdb_based, ob_syncdb_based, ob_remote_based)
        .subscribe(function() {},
        function(err) {
          console.error(sync.sync_name + ":--->err:" + err.toString());
        },
        function() {
          ob.onNext(sync.tasks);
          ob.onCompleted();
        });
    });
  }

  function sync_run_as_ob(sync) {

    var task_done = true;

    return get_sync_tasks(sync)
      .selectMany(function(tasks) {
        return Rx.Observable.createWithDisposable(function(ob) {

          var TASK_DONE_CHECK_INTERVAL = 32;
          return Rx.Observable.interval(TASK_DONE_CHECK_INTERVAL)
            .takeWhile(function() { return tasks.length > 0; })
            .where(function() { return task_done === true; })
            .subscribe(function() {
              var task = tasks[0];
              tasks.splice(0, 1);

              task_done = false;
              ob.onNext(task);
            },
            function(err) {
              console.error(sync.sync_name + ":--->error processing task:" + err.toString());
            },
            function() {
              console.log(sync.sync_name + ":--->TASK execution done");
              ob.onCompleted();
            });
        })
      })
      .selectMany(function(task) {
        return sync.task_execute_func.call(null, sync, task);
      })
      .select(function() {
        task_done = true;
      });

  }


  root.sync_create      = sync_create;
  root.sync_run_as_ob   = sync_run_as_ob;

})(this);