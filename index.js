
var booru     = require("./obooru")                  //ORM
var http      = require("http")                      //Server
var route     = require("choreographer").router();   //Routing
var bind      = require("bind")                      //Templating
var fs        = require("fs")
var formidable= require("formidable")
var util      = require("util")
var mime      = require("mime")
var path      = require("path")
var express   = require("express")

var datastore = new booru.SQLiteDatastore("db.sqlite")
datastore.setLogger(function(msg)
{
	console.log(msg);
});

var router = express.router(function(app) 
{
	app.get("/upload/", function (req, res, next)
	{
		bind.toFile("static/upload.tpl", {}, function(data)
		{
			res.end(data);
		});
	});

	app.get("/image/:page", function(req, res, next)
	{
		var kp = new booru.KeyPredicate("Image");
		kp.orderBy("uploadedDate", true);
		kp.offset(req.params.page * 20);
		kp.limit(20);

		datastore.getWithPredicate(kp, function(e, total, vals)
		{
			var result = [];
			for (var i = 0; i < vals.length; ++i)
			{
				result.push({ path: "/uploads/" + vals[i].filehash + "." + mime.extension(vals[i].mime) });
			}

			bind.toFile("static/index.tpl", { images: result }, function(data)
			{
				res.end(data);
			});
		});
	});

	app.get("/uploads/:name", function(req, res, next)
	{
		var fname = path.basename(req.params.name);
		fs.readFile("./uploads/" + fname, function(err, data)
		{
			if (err)
			{
				console.log(err);
			}
			res.end(data);
		});
	});

	app.post("/upload/data", function(req, res)
	{
		datastore.create("Image", function(err, i)
		{
			if (err) 
			{
				console.log(err);
				return;
			}

			i.filehash = i.pid.toString();
			i.mime = req.files.image.mime;
			i.uploadedDate = new Date().getTime();

			console.log(util.inspect(i));
			datastore.update(i, function(e)
			{
				fs.rename(req.files.image.path, "uploads/" + i.filehash + "." + mime.extension(req.files.image.mime), function(e)
				{
					if (e)
					{
						console.log("Could not rename file O_O.");
						return;
					}
					res.writeHead(302, { "Location" : "/image/0"});
					res.end();
				});
			});
		});
	});
});

var server = express.createServer();
//server.use(express.logger());
server.use(express.bodyParser());
server.use("/css", express.static("css/"));
server.use(router);

var port = 3001;
server.listen(port)
console.log("Server is now listening on port " + port);

