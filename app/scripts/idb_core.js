"use strict";

(function(root) {

    var OBJ_STORE_NAME = "KVSTORE";
    var IDB_VERSION    = 2;

    function existy(v) { return v !== null && v !== undefined; }
    function make_array(v) {
        if(_.isArray(v))
            return v;
        return [v];
    }

    function success_error_to_ob(req) {
        return Rx.Observable.createWithDisposable(function(ob) {

            req.onsuccess = function(e) {
                ob.onNext(e.target.result);
                ob.onCompleted();
            };

            req.onerror = function(err) {
                ob.onError(err);
            };

            return Rx.Disposable.empty;
        })
    }

    function complete_to_ob(tx) {
        return Rx.Observable.createWithDisposable(function(ob) {
            tx.oncomplete = function(e) {
                ob.onNext(e);
                ob.onCompleted();
            }

            return Rx.Disposable.empty;
        })
    }

    function ver_up_to_ob(req) {
        return Rx.Observable.createWithDisposable(function(ob) {

            req.onupgradeneeded = function(e) {
                ob.onNext(e.target.result);
                ob.onCompleted();
            };

            return Rx.Disposable.empty;
        });
    }


    function get_store_mode_func(mode) {
        return function(db) {
            return db.transaction(OBJ_STORE_NAME, mode).objectStore(OBJ_STORE_NAME);
        };
    }
    var get_store_rw = get_store_mode_func("readwrite");
    var get_store_ro = get_store_mode_func("readonly");


    function ctx_create(db) {
        return {
            db: db
        };
    }
    function ctx_set_result(ctx, result) {
        ctx.result = result;
        return ctx;
    }

    function ctx_return_true(ctx) {
        ctx = _.clone(ctx);
        ctx.result = true;
        return ctx;
    }
    function ctx_return_false_ob(ctx) {
        ctx = _.clone(ctx);
        ctx.result = false;
        return Rx.Observable.returnValue(ctx);
    }


    function open(dbname) {
        var req = indexedDB.open(dbname, IDB_VERSION);

        var ob_open = success_error_to_ob(req);
        var ob_verup   = ver_up_to_ob(req)
            .selectMany(function(db) {

                if(db.objectStoreNames.contains(OBJ_STORE_NAME))
                    db.deleteObjectStore(OBJ_STORE_NAME);

                db.createObjectStore(OBJ_STORE_NAME, {keyPath: "k"});
                return Rx.Observable.empty();
            });

        return Rx.Observable.merge(ob_open, ob_verup)
            .select(function(db) {
                return ctx_create(db);
            });
    }

    function set(ctx, k, v) {

        var item = kv(k,v);
        var req = get_store_rw(ctx.db).put(item);

        var ob_tx = complete_to_ob(req.transaction);

        return success_error_to_ob(req).zip(ob_tx, function(_1,_2) {
            return true
        }).select(function(___) {
                return ctx_set_result(ctx, item);
            });
    }

    function _assoc(map, k, v) {    map[k] = v; return map; }

    function get(ctx, k, default_val) {
        var req = get_store_ro(ctx.db).get(k);
        return success_error_to_ob(req)
            .select(function(obj) {
                return (!!obj) ? obj.v : default_val;
            })
            .onErrorResumeNext(Rx.Observable.returnValue(default_val))
            .take(1)
            .select(function(value) {
                ctx = _.clone(ctx);
                ctx.result = value;
                return ctx;
            });
    }

    function contains(ctx, k) {
        var req = get_store_ro(ctx.db).get(k);
        return success_error_to_ob(req)
            .select(function(obj) {
                return !!obj;
            })
            .onErrorResumeNext(Rx.Observable.returnValue(false))
            .take(1)
            .select(function(v) {
                ctx = _.clone(ctx);
                ctx.result = v;
                return ctx;
            });
    }

    function mget(ctx, keys, default_val) {
        keys = make_array(keys);

        var obs = _.map(keys, function(k) {
            return get(ctx, k, default_val)
                .select(function(obj) { return obj.result; });
        });

        return Rx.Observable.forkJoin(obs)
            .select(function(results) {
                var new_ctx = _.clone(ctx);
                new_ctx.result = results;
                return new_ctx;
            });
    }

    function set_func(k,v) {
        return function(ctx) {
            return root.idb.set(ctx, k, v);
        }
    }

    function get_func(k) {
        return function(ctx) {
            return root.idb.get(ctx, k);
        }
    }

    function get_result(ctx) {
        return ctx.result;
    }

    function kv(k,v) {
        return { k:k, v:v }
    }

    function mset(ctx, ary) {
        ary = make_array(ary);

        var obs = _.map(ary, function(kv) {
            return set(ctx, kv.k, kv.v);
        });
        return Rx.Observable.forkJoin(obs)
            .select(function(__) {
                ctx = _.clone(ctx);
                ctx.result = true;
                return ctx;
            });
    }

    function remove(ctx, k) {
        var req = get_store_rw(ctx.db).delete(k);
        var ob_tx = complete_to_ob(req.transaction);

        return success_error_to_ob(req).zip(ob_tx, _.identity)
            .select(_.partial(ctx_return_true, ctx))
            .onErrorResumeNext(ctx_return_false_ob(ctx))
            .take(1)
            .select(function (v) { return v; });
    }

    function update_value_with_opfunc(ctx, k, v, opfunc) {
        return get(ctx, k)
            .selectMany(function(ctx) {
                var saved_value;
                var result = get_result(ctx);
                if(!!result) {
                    saved_value = result;
                }

                var new_value = opfunc.apply(null, [saved_value,v]);
                return set(ctx, k, new_value);
            });
    }

    function lpush(ctx, k, v) {
        return update_value_with_opfunc(ctx, k, v, function(ov, nv) {
            ov = ov || [];
            ov.splice(0,0,nv);
            return ov;
        });
    }

    function rpush(ctx, k, v) {
        return update_value_with_opfunc(ctx, k, v, function(ov, nv) {
            ov = ov || [];
            ov.push(nv);
            return ov;
        });
    }


    function pop_op(ctx, k, v, pop_func) {
        var pop_value;
        return update_value_with_opfunc(ctx, k, v, function(ov, nv) {
            ov = ov || [];
            if(ov.length>0) {
                pop_value = pop_func(ov);
            }
            return ov;
        })
            .select(function(ctx) {
                ctx.result.pop_value = pop_value;
                return ctx;
            });
    }

    function sadd(ctx, k, k_inner, v) {
        return update_value_with_opfunc(ctx, k, null, function(ov, nv) {
            ov = ov || {};
            ov[k_inner] = v;
            return ov;
        });
    }
    function sremove(ctx, k, k_inner) {
        return update_value_with_opfunc(ctx, k, null, function(ov, nv) {
            ov = ov || {};
            delete ov[k_inner];
            return ov;
        });
    }

    function llen(ctx, k) {
        return get(ctx, k)
            .select(function(ctx) {
                var list = ctx.result;
                ctx.result = _.isArray(list) ? list.length : undefined;
                return ctx;
            });
    }

    function lpop(ctx, k, v) {
        return pop_op(ctx,k,v,function(ov) {
            var v = ov[0];
            ov.splice(0,1);
            return v;
        });
    }

    function rpop(ctx, k, v) {
        return pop_op(ctx,k,v,function(ov) {
            var v = ov[ov.length-1];
            ov.pop();
            return v;
        });
    }

    function incr(ctx, k) {
        return update_value_with_opfunc(ctx, k, null, function(ov, ___) {
            ov = ov || 0;
            ov++;
            return ov;
        }).select(function(nctx) {
                nctx.result = nctx.result.v;
                return nctx;
            });
    }

    function decr(ctx, k) {
        return update_value_with_opfunc(ctx, k, null, function(ov, ___) {
            ov = ov || 0;
            ov--;
            return ov;
        }).select(function(nctx) {
                nctx.result = nctx.result.v;
                return nctx;
            });
    }


    root.idb = {};

    root.idb.kv = kv;
    root.idb.result = get_result;

    root.idb.open = open;
    root.idb.set = set;
    root.idb.get = get;
    root.idb.contains = contains;
    root.idb.remove = remove;
    root.idb.mget = mget;
    root.idb.mset = mset;

    root.idb.lpush = lpush;
    root.idb.rpush = rpush;
    root.idb.lpop  = lpop;
    root.idb.rpop  = rpop;
    root.idb.llen  = llen;

    root.idb.incr = incr;
    root.idb.decr = decr;

    root.idb.sadd = sadd;
    root.idb.sremove = sremove;

    root.idb.set_func = set_func;
    root.idb.get_func = get_func;



})(this);
