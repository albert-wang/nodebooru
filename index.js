
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
var async     = require("async")
var datastore = new booru.SQLiteDatastore("db.sqlite")
datastore.setLogger(function(msg)
{
	console.log(msg);
});
/*
function getTagSet(images, cb)
{
	var tagbridge = new booru.KeyPredicate("TagBridge");
	tagbridge.relationKeys("TagsRelation", images);

	datastore.getWithPredicate(tagbridge, function(e, total, vals)
	{
		var tags = new booru.KeyPredicate("Tag");
	});
}
*/
var router = express.router(function(app) 
{
	app.get("/upload/", function (req, res, next)
	{
		bind.toFile("static/upload.tpl", {}, function(data)
		{
			res.end(data);
		});
	});

	app.get("/", function(req, res, next)
	{
		res.writeHead(302, { "Location" : "/gallery/0" });
		res.end();
	});

	app.get("/image/:name", function(req, res, next)
	{
		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash == '" + req.params.name + "'");
		kp.limit(1);

		datastore.getWithPredicate(kp, function(e, total, vals)
		{
			var img = vals[0];

			result = {
				imgpath: "/img/" + img.filehash + "." + mime.extension(img.mime)
			};

			bind.toFile("static/image.tpl", result, function(data)
			{
				res.end(data);
			});
		});
	});

	app.get("/gallery/:page", function(req, res, next)
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
				result.push({ 
					path: "/image/" + vals[i].filehash,
					imgpath: "/img/" + vals[i].filehash + "." + mime.extension(vals[i].mime)
				});
			}

			var pageCount = Math.ceil(total / 20);

			var pages = [];

			for (var i = 0; i < pageCount; i++) {
				pages.push({
					path: "/gallery/" + i,
					label: i
				});
			}

			//Grab tags for all the images.
			bind.toFile("static/gallery.tpl", { images: result, pages: pages }, function(data)
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

		var files = [];

		for (var i in req.files) {
			files.push(req.files[i]);
		}

		async.forEach(files, function(imageFile, callback) {	

			datastore.create("Image", function(err, i)
			{
				if (err) 
				{
					console.log(err);
					return;
				}

				i.filehash = i.pid.toString();
				i.mime = imageFile.mime;
				i.uploadedDate = new Date().getTime();

				console.log(util.inspect(i));
				datastore.update(i, function(e)
				{
					fs.rename(imageFile.path, "uploads/" + i.filehash + "." + mime.extension(imageFile.mime), function(e)
					{
						callback(e);
					});
				});
				});
			}, function (err) {
				if (err)
				{
					console.log("Could not rename file O_O.");
					return;
				}
				res.writeHead(302, { "Location" : "/gallery/0"});
				res.end();
			}
		);
	});
});

var server = express.createServer();
//server.use(express.logger());
server.use(express.bodyParser());
server.use("/css", express.static("css/"));
server.use("/img", express.static("uploads/"));
server.use(router);

var port = 3001;
server.listen(port)
console.log("Server is now listening on port " + port);

