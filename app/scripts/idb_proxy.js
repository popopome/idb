"use strict";

(function (root) {

  /**
   * FAKE WORKER functions
   * Especially Tizen does not support IndexedDB within WebWorker.
   *
   * @returns {{}}
   *
   */
  function fworker_create() {
    return {
      handlers: []
    };
  }

  function fworker_subscribe_message(w, handler) {
    w.handlers.push(handler);
  }

  function fworker_unsubscribe_message(w, handler) {
    var idx = w.handlers.indexOf(handler);
    if (idx !== -1) {
      w.handlers.splice(idx, 1);
    }
  }

  function fworker_fire_events(w, msg) {
    _.each(w.handlers, function (h) {
      h.call(null, { data: msg });
    });
  }

  function fworker_post_message(w, msg) {
    var id = msg.id;
    var cmd_params = msg.msg;
    var cmd = cmd_params[0];
    _.defer(function () {
      var ob;
      switch (cmd) {
        case "open":
          ob = idb.open(cmd_params[1]).select(function (ctx) {
            w.ctx = ctx;
            return {
              result: true
            }
          });
          break;
        case "set":
          ob = idb.set(w.ctx, cmd_params[1], cmd_params[2]);
          break;
        case "get":
          ob = idb.get(w.ctx, cmd_params[1], cmd_params[2]);
          break;
        case "all":
          ob = idb.all(w.ctx)
            .subscribe(function (ctx) {
              fworker_fire_events(w, {
                id : id,
                msg: ctx.result,
                keep_alive: true
              });
            }, function(err) {}
            , function() {
              fworker_fire_events(w, {
                id: id,
                done: true
              })
            }
          );

          return;
        case "contains":
          ob = idb.contains(w.ctx, cmd_params[1]);
          break;
        case "mget":
          ob = idb.mget(w.ctx, cmd_params[1], cmd_params[2]);
          break;
        case "mset":
          ob = idb.mset(w.ctx, cmd_params[1]);
          break;
        case "remove":
          ob = idb.remove(w.ctx, cmd_params[1]);
          break;
        case "lpush":
          ob = idb.lpush(w.ctx, cmd_params[1], cmd_params[2]);
          break;
        case "rpush":
          ob = idb.rpush(w.ctx, cmd_params[1], cmd_params[2]);
          break;
        case "lpop":
          ob = idb.lpop(w.ctx, cmd_params[1]);
          break;
        case "rpop":
          ob = idb.rpop(w.ctx, cmd_params[1]);
          break;
        case "sadd":
          ob = idb.sadd(w.ctx, cmd_params[1], cmd_params[2], cmd_params[3]);
          break;
        case "sremove":
          ob = idb.sremove(w.ctx, cmd_params[1], cmd_params[2]);
          break;
        case "incr":
          ob = idb.incr(w.ctx, cmd_params[1]);
          break;
        case "decr":
          ob = idb.decr(w.ctx, cmd_params[1]);
          break;
        default:
          f.assert("unknown command is given:{0}", cmd);
          break;
      }

      ob.take(1).subscribe(function (ctx) {
        fworker_fire_events(w, {
          id : id,
          msg: ctx.result
        });
      })
    });

  }

  function fworker_terminate(w) {
    w.ctx = null;
  }

  var fworker_tbl = {
    create             : fworker_create,
    subscribe_message  : fworker_subscribe_message,
    unsubscribe_message: fworker_unsubscribe_message,
    post_message       : fworker_post_message,
    terminate          : fworker_terminate
  };

  function rworker_create(base_path) {
    var js_path = base_path + 'idb_server.js';
    js_path = js_path.replace(/\\\\/g, "\\")
      .replace(/\/\//g, "\/");

    var worker = new Worker(js_path);
    return {
      worker: worker
    };
  }

  function rworker_unsubscribe_message(w, handler) { w.worker.removeEventListener('message', handler); }

  function rworker_subscribe_message(w, handler) { w.worker.addEventListener('message', handler); }

  function rworker_post_message(w, msg) { w.worker.postMessage(msg); }

  function rworker_terminate(w) {
    w.worker.terminate();
  }

  var rworker_tbl = {
    create             : rworker_create,
    subscribe_message  : rworker_subscribe_message,
    unsubscribe_message: rworker_unsubscribe_message,
    post_message       : rworker_post_message,
    termiante          : rworker_terminate
  }


  function proxy_create(name, base_path, use_web_worker) {

    var worker_funcs = (use_web_worker) ? rworker_tbl : fworker_tbl;

    var w = worker_funcs.create(base_path);
    return {
      counter     : 0,
      worker      : w,
      worker_funcs: worker_funcs
    };
  }

  function proxy_post_message_as_ob(proxy, msg) {
    return Rx.Observable.createWithDisposable(function (ob) {

      var msg_id = proxy.counter;
      proxy.counter++;


      var replyHandler = function (evt) {
        if (evt.data.id == msg_id) {

          if(!evt.data.done)
            ob.onNext(evt.data.msg);


          if(!!evt.data.done
            || !evt.data.keep_alive) {
            proxy.worker_funcs.unsubscribe_message(proxy.worker, replyHandler);
            ob.onCompleted();
            return;
          }
        }
      };


      proxy.worker_funcs.subscribe_message(proxy.worker, replyHandler);
      proxy.worker_funcs.post_message(proxy.worker,
        {
          id : msg_id,
          msg: msg
        });

      return Rx.Disposable.empty;
    })
  }

  function proxy_send_command_as_ob(proxy, cmd) {
    var ary = _.toArray(arguments)
      , cmd_params = _.rest(ary, 2)

    cmd_params.splice(0, 0, cmd);
    return proxy_post_message_as_ob(proxy, cmd_params)
      .select(function (v) {
        var new_proxy = _.clone(proxy);
        new_proxy.result = v;
        return new_proxy;
      })
  }

  function set(proxy, k, v)       { return proxy_send_command_as_ob(proxy, "set", k, v);      }
  function get(proxy, k, defval)  { return proxy_send_command_as_ob(proxy, "get", k, defval); }
  function all(proxy)             { return proxy_send_command_as_ob(proxy, "all");            }

  function contains(proxy, k) { return proxy_send_command_as_ob(proxy, "contains", k); }

  function mget(proxy, key_or_ary, defval) { return proxy_send_command_as_ob(proxy, "mget", key_or_ary, defval); }

  function mset(proxy, kv_ary) { return proxy_send_command_as_ob(proxy, "mset", kv_ary); }

  function remove(proxy, k) { return proxy_send_command_as_ob(proxy, "remove", k); }

  function lpush(proxy, k, v) { return proxy_send_command_as_ob(proxy, "lpush", k, v); }

  function lpop(proxy, k) { return proxy_send_command_as_ob(proxy, "lpop", k, v); }

  function rpush(proxy, k, v) { return proxy_send_command_as_ob(proxy, "rpush", k, v); }

  function rpop(proxy, k, v) { return proxy_send_command_as_ob(proxy, "rpop", k, v); }

  function sadd(proxy, k, k_inner, v) { return proxy_send_command_as_ob(proxy, "sadd", k, k_inner, v); }

  function sremove(proxy, k, k_inner) { return proxy_send_command_as_ob(proxy, "sremove", k, k_inner); }

  function incr(proxy, k) { return proxy_send_command_as_ob(proxy, "incr", k); }

  function decr(proxy, k) { return proxy_send_command_as_ob(proxy, "decr", k); }

  var idb_proxy = {};
  idb_proxy.create = function (name, basepath, use_web_worker) {
    var proxy = proxy_create(name, basepath, use_web_worker);
    return proxy_send_command_as_ob(proxy, "open", name);
  };
  idb_proxy.set = set;
  idb_proxy.get = get;
  idb_proxy.all = all;
  idb_proxy.contains = contains;
  idb_proxy.remove = remove;
  idb_proxy.mget = mget;
  idb_proxy.mset = mset;
  idb_proxy.lpush = lpush;
  idb_proxy.lpop = lpop;
  idb_proxy.rpush = rpush;
  idb_proxy.rpop = rpop;
  idb_proxy.sadd = sadd;
  idb_proxy.sremove = sremove;
  idb_proxy.incr = incr;
  idb_proxy.decr = decr;

  idb_proxy.destroy = function (proxy) {
    proxy.worker_funcs.terminate(proxy.worker);
    proxy.worker = null;
  }

  root.idb_proxy = idb_proxy;
})(this);
