
var booru     = require("./obooru")                  //ORM
var http      = require("http")                      //Server
var route     = require("choreographer").router();   //Routing
var bind      = require("bind")                      //Templating
var fs        = require("fs")
var formidable= require("formidable")
var util      = require("util")
var mime      = require("mime")
var path      = require("path")

var datastore = new booru.PostgresDatastore("localhost", "albert", "albertowang");

route.get("/image/*", function(req, res, imageid)
{
	var kp = new booru.KeyPredicate("Image");
	kp.orderBy("uploadedDate", true);
	kp.offset(imageid * 20);
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

route.get("/uploads/*", function(req, res, f)
{
	var fname = path.basename(f);
	fs.readFile("./uploads/" + fname, function(err, data)
	{
		if (err)
		{
			console.log(err);
		}
		res.end(data);
	});
});

route.get("/upload/", function(req, res)
{
	bind.toFile("static/upload.tpl", { user: "Nyancat" }, function(data)
	{
		res.end(data);
	});
});

route.post("/upload/data", function(req, res)
{
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files)
	{
		if (err)
		{
			console.log(err);
			return;
		}

		datastore.create("Image", function(e, i)
		{
			util.inspect(i);
			i.filehash = i.pid.toString();
			i.mime = files.image.mime;
			i.uploadedDate = new Date().getTime();

			datastore.update(i, function(e)
			{
				fs.rename(files.image.path, "uploads/" + i.filehash + "." + mime.extension(files.image.mime), function(e){});
				res.end("Done!");
			});
		});
	});
});

http.createServer(route).listen(3000)
console.log("Server is now listening on port 3000")















