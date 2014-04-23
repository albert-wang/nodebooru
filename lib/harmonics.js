"use strict"

var bind = require("bind");

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
}

module.exports = {
	harmonize: harmonize
}