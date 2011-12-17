
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

function arrayDifference(orig, next)
{
	orig.sort(); 
	next.sort();

	if (orig.length == 0 || next.length == 0)
	{
		return { added: next, removed: orig };
	}

	var added = []
	var removed = []

	var oi = 0; 
	var ni = 0;

	while (oi < orig.length && ni < next.length)
	{
		if (orig[oi] < next[ni])
		{
			removed.push(orig[oi]);
			oi++;
		} 
		else if (orig[oi] > next[ni])
		{
			added.push(next[ni]);
			ni++;
		} else 
		{
			oi++;
			ni++;
		}
	}

	if (ni < next.length)
	{
		added = added.concat(next.slice(ni, next.length));
	} 

	if (oi < orig.length)
	{
		removed = removed.concat(orig.slice(oi, orig.length));
	}

	return { "added" : added, "removed" : removed };
}

function diff(o, n) {
  
  // declare temporary variables
  var op = 0; var np = 0;
  var a = []; var r = [];

  // compare arrays and add to add or remove lists
  while (op < o.length && np < n.length) {
      if (o[op] < n[np]) {
          // push to diff?
          r.push(o[op]);
          op++;
      }
      else if (o[op] > n[np]) {
          // push to diff?
          a.push(n[np]);
          np++;
      }
      else {
          op++;np++;
      }
  }

  // add remaining items
  if( np < n.length )
    a = a.concat(n.slice(np, n.length));
  if( op < o.length )
    r = r.concat(o.slice(op, o.length));

  return {added: a, removed: r}; 
}

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

function renderEmpty(res)
{
	renderGallery(res, [], 0, []);
}

function renderGallery(res, images, imageCount, tags)
{
	console.log(util.inspect(tags))

	var isEmpty = (imageCount === 0);

	var result = []; 

	for (var i = 0; i < images.length; ++i)
	{
		result.push({
			path: "/image/" + images[i].filehash, 
			imgpath: "/img/" + images[i].filehash + "." + mime.extension(images[i].mime)
		});
	}

	var pageCount = Math.ceil(imageCount/ 20);
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
		"is-empty" : isEmpty,
		"images" : result, 
		"pages" : pages, 
		"tags" : ts
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
		if (tags.length == 0)
		{
			renderEmpty(res);
			return;
		}

		getImageSet(tags, page, function(e, tc, images)
		{
			if (images.length == 0)
			{
				renderEmpty(res);
				return;
			}

			getTagSet(images, function(e, total, tags)
			{
				renderGallery(res, images, total, tags);
			});
		});
	});
}

var router = express.router(function(app) 
{
	app.get("/upload", function (req, res, next)
	{
		bind.toFile("static/upload.tpl", {}, function(data)
		{
			res.end(data);
		});
	});

	app.get("/", function(req, res, next)
	{
		res.writeHead(302, { "Location" : "/gallery" });
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
				var filename =  img.filehash + "." + mime.extension(img.mime);

				var ts = []
				for (var i = 0; i < tags.length; ++i)
				{
					ts.push(getTagRepresentation(tags[i]));
				}

				result = {
					"hash" : img.filehash,
					"imgpath" : "/img/" + filename,
					"tags" : ts
				};

				bind.toFile("static/image.tpl", result, function(data)
				{
					res.end(data);
				});	
			});
		});
	});

	app.get("/tag/:name/:page?", function(req, res, next)
	{
		renderTagPage(req, res, req.params.name, req.params.page || 0);
	});

	app.get("/gallery/:page?", function(req, res, next)
	{
		var page = req.params.page || 0;
		var kp = new booru.KeyPredicate("Image");
		kp.orderBy("uploadedDate", true);
		kp.offset(page * 20);
		kp.limit(20);

		datastore.getWithPredicate(kp, function(e, total, images)
		{
			if (images.length == 0)
			{
				renderEmpty(res);
				return;
			}

			getTagSet(images, function(e, t, tags)
			{
				renderGallery(res, images, total, tags);
			});
		});
	});

	app.post("/tag/set", function(req, res)
	{
		var imageID = req.body.filehash;
		var originalTags = req.body.original.replace("\s+", " ").split(" ");
		var updatedTags = req.body.updated.replace("\s+", " ").split(" ");

		var delta = arrayDifference(originalTags, updatedTags);

		res.writeHead(302, { "Location" : "/image/" + imageID });
		res.end();
	});

	app.post("/tag/data", function(req, res)
	{
		renderTagPage(req, res, req.body.tag, 0);
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

fs.mkdir("uploads", 0777, function(e) {
	if (e)
	{
		console.log("EEXISTS below is fine.");
		console.log("Error while making directory: " + e);
	}

	var port = 3001;
	server.listen(port)
	console.log("Server is now listening on port " + port);	
})



