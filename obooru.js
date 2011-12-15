if (process.platform == 'freebsd') {
	module.exports = require('./obooru_freebsd');
}
else if (process.platform == "darwin") {
	module.exports = require("./obooru_darwin");
}
else if (process.platform == "linux") {
	module.exports = require("./obooru_linux");
}	
else{
	throw Error('No support for ' + process.platform + '; please recompile bindings.');
}
