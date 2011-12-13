if (process.platform == 'freebsd') {
	module.exports = require('./obooru_freebsd');
}
else {
	throw Error('No support for ' + process.platform + '; please recompile bindings.');
}
