"use strict"

var bind = require("bind")
  , fs = require("fs")
  , thunk = require("thunkify")
  ;

fs.harmony = {};
fs.harmony.unlink = thunk(fs.unlink);
fs.harmony.stat = thunk(fs.stat);

bind.thunkFile = function(file, data) {
  return function(cb) {
    return bind.toFile(file, data, function(data) {
      return cb(null, data);
    });
  }
}

function harmonize(datastore) {
  datastore.harmony = {};

  datastore.harmony.getWithPredicate = function(kp, opts) {
    return function(cb) {
      var wrapper = function(err, count, values) {
        Object.defineProperty(values, "total", {
            enumerable: false,
            writable: true
        });

        values.total = count;
        return cb(err, values);
      }

      if (opts == undefined) {
        return datastore.getWithPredicate(kp, wrapper);
      } else {
        return datastore.getWithPredicate(kp, opts, wrapper);
      }
    }
  }

  datastore.harmony.unlink = function(a, b) {
    return function(cb) {
      return datastore.unlink(a, b, cb);
    }
  }

  datastore.harmony.remove = function(a) {
    return function(cb) {
      return datastore.remove(a, cb);
    }
  }
}

module.exports = {
  harmonize: harmonize
}