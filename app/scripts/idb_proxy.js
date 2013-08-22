

"use strict";

(function(root) {

    function proxy_create(name, base_path) {
        var js_path = base_path + 'idb_server.js';
        js_path = js_path.replace(/\\\\/g, "\\")
                         .replace(/\/\//g, "\/");
        var worker = new Worker(js_path);
        return {
            counter: 0,
            worker: worker
        };
    }

    function proxy_post_message_as_ob(proxy, msg) {
        return Rx.Observable.createWithDisposable(function(ob) {

            var msg_id = proxy.counter;
            proxy.counter++;


            var replyHandler = function(evt) {
                if(evt.data.id == msg_id) {
                    proxy.worker.removeEventListener('message', replyHandler);
                    ob.onNext(evt.data.msg);
                    ob.onCompleted();
                }
            };

            proxy.worker.addEventListener('message', replyHandler);
            proxy.worker.postMessage({
                id: msg_id,
                msg: msg
            });

            return Rx.Disposable.empty;
        })
    }

    function proxy_send_command_as_ob(proxy, cmd) {
        var ary = _.toArray(arguments)
            , cmd_params = _.rest(ary, 2)

        cmd_params.splice(0,0,cmd);
        return proxy_post_message_as_ob(proxy, cmd_params)
            .select(function(v) {
                var new_proxy = _.clone(proxy);
                new_proxy.result = v;
                return new_proxy;
            })
    }

    function set(proxy, k, v)       {   return proxy_send_command_as_ob(proxy, "set", k, v);        }
    function get(proxy, k, defval)  {   return proxy_send_command_as_ob(proxy, "get", k, defval);   }
    function contains(proxy, k)     {   return proxy_send_command_as_ob(proxy, "contains", k);      }
    function mget(proxy, key_or_ary){   return proxy_send_command_as_ob(proxy, "mget", key_or_ary); }
    function mset(proxy, kv_ary)    {   return proxy_send_command_as_ob(proxy, "mset", kv_ary);     }
    function remove(proxy, k)       {   return proxy_send_command_as_ob(proxy, "remove", k);        }
    function lpush(proxy, k, v)     {   return proxy_send_command_as_ob(proxy, "lpush", k, v);      }
    function lpop(proxy, k)         {   return proxy_send_command_as_ob(proxy, "lpop", k, v);       }
    function rpush(proxy, k, v)     {   return proxy_send_command_as_ob(proxy, "rpush", k, v);      }
    function rpop(proxy, k, v)      {   return proxy_send_command_as_ob(proxy, "rpop", k, v);       }

    var idb_proxy = {};
    idb_proxy.create = function(name, basepath) {
        var proxy = proxy_create(name, basepath);
        return proxy_send_command_as_ob(proxy, "open", name);
    };
    idb_proxy.set = set;
    idb_proxy.get = get;
    idb_proxy.contains = contains;
    idb_proxy.remove = remove;
    idb_proxy.mget  = mget;
    idb_proxy.mset  = mset;
    idb_proxy.lpush = lpush;
    idb_proxy.lpop = lpop;
    idb_proxy.rpush = rpush;
    idb_proxy.rpop = rpop;

    idb_proxy.destroy = function(proxy) {
        proxy.worker.terminate();
        proxy.worker = null;
    }

    root.idb_proxy = idb_proxy;
})(this);
