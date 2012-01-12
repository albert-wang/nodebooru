
var booru     = require("./obooru")                  //ORM
var http      = require("http")                      //Server
var bind      = require("bind")                      //Templating
var fs        = require("fs")
var formidable= require("formidable")
var util      = require("util")
var mime      = require("mime")
var path      = require("path")
var express   = require("express")
var flow      = require("flow")
var passport  = require("passport")
var ghstrat   = require("passport-google-oauth").OAuth2Strategy;

var CLIENT_ID = '947772040441.apps.googleusercontent.com';
var SECRET_KEY = 'UQ_DdG36QLSr62Na5FddGF4T'; 

//setup passport
passport.serializeUser(function(user, done) {
	done(null, user)
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

passport.use(new ghstrat({
	clientID: CLIENT_ID, 
	clientSecret: SECRET_KEY, 
	callbackURL: "http://127.0.0.1:3001/auth/google/callback"
}, function(access, refresh, profile, done) {
	for (id in profile.emails)
	{
		var email = profile.emails[id].value

		if (email.match(".*@ironclad.mobi$"))
		{
			return done(null, profile);
		}
	}
	return done(false, null);
}));

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

function getTagSet(images, cb)
{
	var tags = new booru.KeyPredicate("Tag");
	tags.relationKeys("ImageTags", images);
	tags.limit(50);

	datastore.getWithPredicate(tags, cb);
}

function getTagCounts(tags, cb)
{
	var result = {};
	flow.serialForEach(tags, function(val)
	{
		getTagCount(val, this)
	}, function(e, tag, count)
	{
		result[tag.name] = count;
	}, function()
	{
		cb(result);
	});
}

function getTagCount(tag, cb)
{
	var kp = new booru.KeyPredicate("Tag");
	kp.relationKeys("ImageTags", [tag]);
	kp.limit(1);

	datastore.getWithPredicate(kp, function(e, count, t)
	{
		cb(e, tag, count);
	});
}

function getImageSet(tags, page, cb)
{
	var images = new booru.KeyPredicate("Image");
	images.relationKeys("ImageTags", tags);
	images.offset(page * 20);
	images.limit(20);

	datastore.getWithPredicate(images, cb);
}

function getTagRepresentation(tag, c)
{
	return {
		url_name: tag.name, 
		display_name: tag.name.replace("_", " "),
		count : c || "??",
		class : "default"
	};
}

function renderEmpty(res)
{
	renderGallery(res, [], 0, []);
}

function renderGallery(res, images, imageCount, tags)
{
	getTagCounts(tags, function(tagCounts)
	{
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
			ts.push(getTagRepresentation(tags[i], tagCounts[tags[i].name]));
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
	});
}

function renderTagPage(req, res, tag, page)
{
	var tagQuery = new booru.KeyPredicate("Tag");
	tagQuery.where("name = '" + tag + "'")

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

function reqauth(req, res, next)
{
	if (req.isAuthenticated()) { return next(); }
	res.redirect("/login");
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

	app.get("/login/?", function(req, res)
	{
		bind.toFile("static/auth.tpl", {}, function(data)
		{
			res.end(data);
		});
	});

	app.get("/auth/?", passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'] }), function(req, res)
	{
		res.redirect("/");
	});

	app.get("/auth/google/callback", passport.authenticate('google', { failureRedirect: '/login' }), function(req, res)
	{
		res.redirect('/');
	});

	app.get("/image/:name", reqauth, function(req, res, next)
	{
		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash == '" + req.params.name + "'");
		kp.limit(1);

		datastore.getWithPredicate(kp, function(e, total, vals)
		{
			var img = vals[0];

			var commentP = new booru.KeyPredicate("Comment");
			commentP.relationKeys("comments", [img]);
			commentP.orderBy("dateCreated", false);

			datastore.getWithPredicate(commentP, function(e, commentCount, comments)
			{
				getTagSet( [ img ], function(e, total, tags)
				{
					getTagCounts(tags, function(tagToCountMap)
					{
						var filename =  img.filehash + "." + mime.extension(img.mime);

						var ts = [];
						var tagstr = "";
						for (var i = 0; i < tags.length; ++i)
						{
							ts.push(getTagRepresentation(tags[i], tagToCountMap[tags[i].name]));
							if (i)
							{
								tagstr = tagstr + ", ";
							}
							tagstr = tagstr + tags[i].name;
						}

						var cs = [];
						for (var i = 0 ; i < comments.length; ++i)
						{
							cs.push({
								contents: comments[i].contents
							})
						}

						console.log(ts);

						result = {
							"hash" : img.filehash,
							"imgpath" : "/img/" + filename,
							"tags" : ts,
							"original-tags" : tagstr,
							"comments" : cs
						};

						bind.toFile("static/image.tpl", result, function(data)
						{
							res.end(data);
						});	
					});
				});
			});
		});
	});

	app.get("/tag/:name/:page?", reqauth, function(req, res, next)
	{
		renderTagPage(req, res, req.params.name, req.params.page || 0);
	});

	app.get("/gallery/:page?", reqauth, function(req, res, next)
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

	app.post("/comment/set", reqauth, function(req, res)
	{
		var imageID = req.body.filehash; 
		
		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash = '" + req.body.filehash + "'");
		kp.limit(1);
		
		datastore.getWithPredicate(kp, function(e, total, image)
		{
			datastore.createComment(function(e, nc)
			{
				nc.dateCreated = new Date().getTime();
				nc.contents = req.body.comment;
				
				image[0].addComments(nc, function(e)
				{
					datastore.update(nc, function(e)
					{
						//Done
						res.end();
					});
				});	
			});
		});
	});

	app.post("/tag/set", reqauth, function(req, res)
	{
		var imageID = req.body.filehash;
		var newtags = req.body.newtags.split(",").map(function(t)
		{
			return t.replace(/\s+/g, " ").replace(/^\s+|\s+%/g, "");
		});
		
		newtags = newtags.filter(function(val) { return val !== ""; });
		newtags = newtags.map(function(val) { return val.toLowerCase(); });

		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash = '" + req.body.filehash + "'");

		datastore.getWithPredicate(kp, function(e, total, image)
		{
			getTagSet( [ image[0] ], function(e, total, tags)
			{
				var ts = [];
				var i = 0;
				for (i = 0; i < tags.length; ++i)
				{
					ts.push(tags[i].name);	
				}

				var diff = arrayDifference(ts, newtags);

				console.log(util.inspect(diff));

				for (i = 0; i < diff.added.length; ++i)
				{
					var pred = new booru.KeyPredicate("Tag");
					pred.where("name = '" + diff.added[i] + "'");

					datastore.getWithPredicate(pred, function(e, total, t)
					{
						if (total === 0)
						{
							datastore.createTag(function(e, nt)
							{
								nt.name = diff.added[i];
								datastore.update(nt, function(e)
								{
									datastore.link(image[0], nt, function(e)
									{
										res.end();
										//oh dear ;_;
									});
								});
							});
						} else 
						{
							datastore.link(image[0], t[0], function(e)
							{
								res.end();
								//lolo
							});
						}
					});
				}

				for (i = 0; i < diff.removed.length; ++i)
				{
					var pred = new booru.KeyPredicate("Tag");
					pred.where("name = '" + diff.removed[i] + "'");
					pred.limit(1);

					datastore.getWithPredicate(pred, function(e, total, t)
					{
						datastore.unlink(image[0], t[0], function(e)
						{
							res.end();
							//<_<_<_<_<
						});
					});
				}
			});
		});
	});

	app.post("/tag/data", reqauth, function(req, res)
	{
		renderTagPage(req, res, req.body.tag, 0);
	});

	//Anyone can upload
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
server.use(express.profiler());
server.use(express.bodyParser());
server.use(express.cookieParser());
server.use(express.session({ secret: "Takamagahara is observing you..." }));
server.use(passport.initialize());
server.use(passport.session());
server.use(router);
server.use("/css", express.static("css/"));
server.use("/img", express.static("uploads/"));

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



