
(function(root) {

    var importScripts = root.importScripts || null;
    if(!importScripts) {
        // This execution is not in WEBWORKER.
        // Just return.
        return;
    }

    importScripts("../components/underscore/underscore.js");
    importScripts("../components/underscore-contrib/underscore-contrib.js");
    importScripts("../components/rxjs/rx.js");
    importScripts("../components/rxjs/rx.aggregates.js");
    importScripts("../components/rxjs/rx.binding.js");
    importScripts("../components/rxjs/rx.coincidence.js");
    importScripts("../components/rxjs/rx.experimental.js");
    importScripts("../components/rxjs/rx.joinpatterns.js");
    importScripts("../components/rxjs/rx.testing.js");
    importScripts("../components/rxjs/rx.time.js");

    importScripts("idb_core.js");

    var g_ctx = null;

    var wrap_func_post_message = function(func) {
        return function(msg_id, cmd) {
            func(cmd)
                .subscribe(function(ctx) {
                    postMessage({
                        id: msg_id,
                        msg: ctx.result
                    });
                });
        }
    }
    var cmd_map = {
        open: wrap_func_post_message(function(cmd) {
            return idb.open(cmd[1])
                .select(function(ctx) {
                    g_ctx = ctx;
                    return {
                        result: true
                    }
                });
        }),
        set: wrap_func_post_message(function(cmd) { return idb.set(g_ctx, cmd[1], cmd[2]);  }),
        get: wrap_func_post_message(function(cmd) { return idb.get(g_ctx, cmd[1], cmd[2]);  }),
        contains: wrap_func_post_message(function(cmd) {
            return idb.contains(g_ctx, cmd[1]);}),
        mget: wrap_func_post_message(function(cmd) { return idb.mget(g_ctx, cmd[1])}),
        mset: wrap_func_post_message(function(cmd) { return idb.mset(g_ctx, cmd[1])}),
        remove: wrap_func_post_message(function(cmd) {  return idb.remove(g_ctx, cmd[1]);   }),
        lpush: wrap_func_post_message(function(cmd) {   return idb.lpush(g_ctx, cmd[1], cmd[2])}),
        rpush: wrap_func_post_message(function(cmd) {   return idb.rpush(g_ctx, cmd[1], cmd[2])}),
        lpop: wrap_func_post_message(function(cmd) {   return idb.lpop(g_ctx, cmd[1])}),
        rpop: wrap_func_post_message(function(cmd) {   return idb.rpop(g_ctx, cmd[1])})
    };

    root.onmessage = function(evt) {
        var msg_id = evt.data.id;
        var cmd = evt.data.msg;
        cmd_map[cmd[0]].apply(null, [msg_id, cmd]);
    };

})(this);

