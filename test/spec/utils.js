
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

function random_db_name() {
    return new Date().getTime() + "__test";
}