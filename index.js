
var booru     = require("./obooru")                  //ORM
var http      = require("http")                      //Server
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

function getTagSet(images, cb)
{
	var tags = new booru.KeyPredicate("Tag");
	tags.relationKeys("ImageTags", images);
	tags.limit(50);

	datastore.getWithPredicate(tags, cb);
}

function getImageSet(tags, page, cb)
{
	var images = new booru.KeyPredicate("Image");
	images.relationKeys("ImageTags", tags);
	images.offset(page * 20);
	images.limit(20);

	datastore.getWithPredicate(images, cb);
}

function getTagRepresentation(tag)
{
	return {
		url_name: tags[i].name, 
		display_name: tags[i].name.replace("_", " "),
		count : 3,
		class : "default"
	};
}

function renderGallery(images, imageCount, tags)
{
	console.log(util.inspect(tags))
	var result = []; 

	for (var i = 0; i < images.length; ++i)
	{
		result.push({
			path: "/image/" + images[i].filehash, 
			imgpath: "/img/" + images[i].filehash + "." + mime.extension(images[i].mime)
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

	var ts = []
	for (var i = 0; i < tags.length; ++i)
	{
		ts.push(getTagRepresentation(tags[i]));
	}

	var data = {
		images: result, 
		pages : pages, 
		tags : ts
	};

	bind.toFile("static/gallery.tpl", data, function(data)
	{
		res.end(data);
	});
}

function renderTagPage(req, res, tag, page)
{
	var tagQuery = new booru.KeyPredicate("Tag");
	tagQuery.where("name = '" + req.params.name + "'")

	datastore.getWithPredicate(tagQuery, function(e, total, tags)
	{
		getImageSet(tags, page, function(e, tc, images)
		{
			getTagSet(images, function(e, total, tags)
			{
				renderGallery(images, total, tags);
			});
		});
	});
}

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

			getTagSet( [ img ], function(e, total, tags)
			{
				var ts = []
				for (var i = 0; i < tags.length; ++i)
				{
					ts.push(getTagRepresentation(tags[i]));
				}

				result = {
					imgpath: "/img/" + img.filehash + "." + mime.extension(img.mime),
					tags : ts
				};

				bind.toFile("static/image.tpl", result, function(data)
				{
					res.end(data);
				});
			});
		});
	});

	app.get("/tag/:name", function(req, res, next)
	{
		renderTagPage(req, res, req.params.name, 0);
	});

	app.get("/tag/:name/:page", function(req, res, next)
	{
		renderTagPage(req, res, req.params.name, req.params.page);
	});

	app.get("/gallery/:page", function(req, res, next)
	{
		var kp = new booru.KeyPredicate("Image");
		kp.orderBy("uploadedDate", true);
		kp.offset(req.params.page * 20);
		kp.limit(20);

		datastore.getWithPredicate(kp, function(e, total, images)
		{
			getTagSet(images, function(e, t, tags)
			{
				renderGallery(images, total, tags);
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

	app.post("/tag/data", function(req, res)
	{
		res.writeHead(302, { "Location" : "/tag/" + req.body.tag + "/0" });
		res.end();
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
					res.writeHead(302, { "Location" : "/gallery/0"});
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
server.use("/img", express.static("uploads/"));
server.use(router);

var port = 3001;
server.listen(port)
console.log("Server is now listening on port " + port);

