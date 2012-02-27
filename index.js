
var booru     = require("./obooru")                  //ORM
var http      = require("http")                      //Server
var bind      = require("bind")                      //Templating
var fs        = require("fs")
var formidable= require("formidable")
var util      = require("util")
var mime      = require("mime")
var path      = require("path")
var express   = require("express")
var async     = require("async")
var flow      = require("flow")
var im        = require("imagemagick")
var request   = require("request")
var tempfs    = require("temp")
var passport  = require("passport")
var ghstrat   = require("passport-google-oauth").OAuth2Strategy;

var CLIENT_ID = require('./config').CLIENT_ID;
var SECRET_KEY = require('./config').SECRET_KEY;
var HOSTNAME = require('./config').HOSTNAME;

//Tag mappings.
function tagFromMime(mime, path)
{
	var splitMimes = mime.split("/");

	if (splitMimes[0] === "image")
	{
		return "<a href='" + path + "'><img src='" + path + "'></a>";
	}

	if (splitMimes[0] === "video")
	{
		return "<video controls='controls'><source src='" + path + "' type='" + mime + "'> Video Unsupported :( </video><br/><a href='" + path + "'>Download</a>";
	}

	if (splitMimes[0] === "audio")
	{
		return "<audio controls='controls'><source src='" + path + "' type='" + mime + "'> Audio Unsupported :( </audio><br/><a href='" + path + "'>Download</a>";
	}

	return "<a href='" + path + "'>Download</a>";
}

function requiresThumbnail(mime)
{
	var splitMimes = mime.split("/");
	if (splitMimes[0] === "image")
	{
		return true;
	}
	return false;
}

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
	callbackURL: "http://" + HOSTNAME + "/auth/google/callback"
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

function recomputeRatings(img)
{
	var kp = new booru.KeyPredicate("Rating");
	kp.relationKeys("ratings", [img]);

	datastore.getWithPredicate(kp, function(e, count, rates)
	{
		var average = 0;
		for (var i = 0; i < rates.length; ++i)
		{
			average += rates[i].rating; 
		}
		average /= rates.length;

		img.ratingsAverage = average;

		console.log("Rating: " + average);

		datastore.update(img, function(e)
		{});
	});
}

function getImageSet(tags, page, cb)
{
	var images = new booru.KeyPredicate("Image");
	images.relationKeys("ImageTags", tags);
	images.offset(page * 20);
	images.limit(20);
	images.bridgeRelationIsLogicalOr(false);


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

function renderGallery(res, images, imageCount, tags, optInTags)
{
	getTagCounts(tags, function(tagCounts)
	{
		var isEmpty = (imageCount === 0);

		var result = []; 

		for (var i = 0; i < images.length; ++i)
		{
			var splitMimes = images[i].mime.split("/");
		
			var imgpath = "/thumb/temp_thumb.jpg";
			if (splitMimes[0] === "image")
			{
				try {
					if (fs.lstatSync("./thumb/" + images[i].filehash + "_thumb.jpg")) {
						imgpath = "/thumb/" + images[i].filehash + "_thumb.jpg";
					}
				}
				catch(e) {}

				try {
					if (fs.lstatSync("./thumb/" + images[i].filehash + "_thumb-0.jpg")) {
						imgpath = "/thumb/" + images[i].filehash + "_thumb-0.jpg";
					}
				}
				catch(e) {}
			} else if (splitMimes[0] === "audio")
			{
				imgpath = "/thumb/music.png";
			} else if (splitMimes[0] === "video")
			{
				imgpath = "/thumb/video.png";
			}
				
			result.push({
				path: "/image/" + images[i].filehash, 
				imgpath: imgpath,
				imghash: images[i].filehash
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
			var tr = getTagRepresentation(tags[i], tagCounts[tags[i].name]);
				
			console.log(tags[i].name + " < Tag");
			if (optInTags)
			{
				for (var j in optInTags)
				{
					console.log(optInTags[j]);
				}
				var extras = ""
				for(var j = 0; j < optInTags.length; ++j)
				{
					if (tags[i].name !== optInTags[j])
					{
						if (extras !== "")
						{
							extras = extras + "+";
						}
						extras = extras + optInTags[j];
					}
				}
				tr.extra = extras;
			}

			ts.push(tr);
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
	var inputTags = tag.split(",");
	if (inputTags.length == 0)
	{
		renderEmpty(res);
		return; 
	}

	var splitTags = [];
	for (var i in inputTags) 
	{
		var r = inputTags[i];
		r = r.replace(/^\s+|\s+$/g, "");
		
		if (r.length !== 0)
		{
			splitTags.push(r);
		}
	}

	var result = [];
	
	flow.serialForEach(splitTags, function(tag)
	{
		var tagQuery = new booru.KeyPredicate("Tag");
		tagQuery.where("name = '" + tag.replace(/^\s+|\s+$/g, "") + "'");

		var self = this;
		datastore.getWithPredicate(tagQuery, this);
	}, function(error, total, tags)
	{
		result = result.concat(tags);
	}, function()
	{
		if (result.length == 0 || result.length != splitTags.length)
		{
			renderEmpty(res);
			return;
		}
		
		getImageSet(result, page, function(e, tc, images)
		{
			if (images.length == 0)
			{
				renderEmpty(res);
				return;
			}

			getTagSet(images, function(e, total, tags)
			{
				renderGallery(res, images, total, tags, splitTags);
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
	app.get("/upload", reqauth, function (req, res, next)
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
						var metadataP = new booru.KeyPredicate("UploadMetadata");
						metadataP.whereGUID("imageGUID", img.pid);

						datastore.getWithPredicate(metadataP, function(e, unused, metadatas)
						{
							var ratingsP = new booru.KeyPredicate("Rating");
							ratingsP.relationKeys("ratings", [img]);
							ratingsP.where("raterEmail =='" + req.user.emails[0].value + "'");
							ratingsP.limit(1);

							datastore.getWithPredicate(ratingsP, function(e, unused, userRating)
							{
								var filename =  img.filehash + "." + mime.extension(img.mime);
								var meta = { "uploadedBy" : "Anonymous", "originalExtension" : "Unknown" };
								if (metadatas.length)
								{
									meta = metadatas[0];
								}

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

								console.log(img.uploadedDate);

								var rate = "0";
								if (userRating.length)
								{
									rate = userRating[0].rating;
								}

								result = {
									"hash" : img.filehash,
									"content" : tagFromMime(img.mime, "/img/" + filename),
									"tags" : ts,
									"original-tags" : tagstr,
									"time" : "" + img.uploadedDate,
									"comments" : cs,
									"mimetype" : img.mime,
									"uploadedBy" : meta.uploadedBy,
									"your-rating" : rate, 
									"average-rating" : img.ratingsAverage
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
		});
	});

	app.get("/tag/:name/:page?", reqauth, function(req, res, next)
	{
		var tags = req.params.name.split("+").join(",");
		renderTagPage(req, res, tags, req.params.page || 0);
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
				nc.dateCreated = new Date();
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

	function setTagCollection(imageHash, newTags, doremovals, cb)
	{
		var imageID = imageHash;
		var newtags = newTags.split(",").map(function(t)
		{
			return t.replace(/\s+/g, " ").replace(/^\s+|\s+%/g, "");
		});

		newtags = newtags.filter(function(val) { return val !== ""; });
		newtags = newtags.map(function(val) { return val.toLowerCase(); });

		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash = '" + imageID + "'");

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

				flow.serialForEach(diff.added, function(tName)
				{
					var pred = new booru.KeyPredicate("Tag");
					pred.where("name = '" + tName + "'");
					
					var self = this;

					datastore.getWithPredicate(pred, function(e, total, t)
					{
						if (total === 0)
						{
							datastore.createTag(function(e, nt)
							{
								nt.name = tName;
								datastore.update(nt, function(e)
								{
									datastore.link(image[0], nt, function(e)
									{
										self();
									});
								});
							});
						} else 
						{
							datastore.link(image[0], t[0], function(e)
							{
								self();
							});
						}
					});
				}, function()
				{},function()
				{
					if (doremovals)
					{
						flow.serialForEach(diff.removed, function(t)
						{
							var pred = new booru.KeyPredicate("Tag");
							pred.where("name = '" + t + "'");
							pred.limit(1);
	
							var self = this;
							datastore.getWithPredicate(pred, function(e, total, t)
							{
								datastore.unlink(image[0], t[0], function(e)
								{
									self();
								});
							});
						}, function()
						{},function()
						{
							cb(undefined);
						});
					} else
					{
						cb(undefined);
					}
				});
			});
		});
	}

	app.post("/tag/batch", reqauth, function(req, res)
	{
		var imgs = req.body.imgs;
		var tags = req.body.tags;

		flow.serialForEach(imgs, function(i)
		{
			setTagCollection(i, tags, false, this);
		}, function()
		{}, 
		function()
		{
			res.end();
		});
	});

	app.post("/tag/set", reqauth, function(req, res)
	{
		setTagCollection(req.body.filehash, req.body.newtags, true, function(err)
		{
			res.end();
		});
	});

	app.post("/tag/data", reqauth, function(req, res)
	{
		renderTagPage(req, res, req.body.tag, 0);
	});


	//Generic file upload method
	function createImageUpload(path, mt, user, cb)
	{
		datastore.create("Image", function(err, i)
		{
			if (err)
			{
				console.log(err);
				return;
			}

			i.filehash = i.pid.toString();
			i.mime = mt;
			i.uploadedDate = new Date();

			datastore.update(i, function(e)
			{
				var newPath = "uploads/" + i.filehash + "." + mime.extension(mt);
				fs.rename(path, newPath, function(e)
				{
					cb(e);
					if (requiresThumbnail(mt))
					{
						im.resize({
							srcPath: newPath,
							dstPath: "thumb/" + i.filehash + "_thumb.jpg",
							width:300,
							height:300},
							function(err, stdout, stderr){

							}); 
					}
				});
			});

			datastore.create("UploadMetadata", function(err, m)
			{
				m.imageGUID = i.pid;
				m.uploadedBy = user.emails[0].value;
				m.originalExtension = path.split('.').pop();

				datastore.update(m, function(e)
				{});
			});
		});
	}

	app.post("/rating/modify", reqauth, function(req, res)
	{
		var imgid = new booru.GUID(req.body.imgid);
		var imageP = new booru.KeyPredicate("Image");

		imageP.where("filehash == '" + req.body.imgid + "'");
		imageP.limit(1);

		datastore.getWithPredicate(imageP, function(e, total, images)
		{
			var img = images[0]; 
			var kp = new booru.KeyPredicate("Rating");
			kp.relationKeys("ratings", images);
			kp.where("raterEmail='" + req.user.emails[0].value + "'");

			datastore.getWithPredicate(kp, function(e, total, ratings)
			{
				if (ratings.length)
				{
					var rate = ratings[0];
					rate.rating = parseInt(req.body.rating);

					datastore.update(rate, function(e)
					{
						res.end();
						recomputeRatings(img);
					});
				} else 
				{
					datastore.create("Rating", function(e, rate)
					{
						rate.rating = parseInt(req.body.rating);
						rate.raterEmail = req.user.emails[0].value;
						img.addRatings(rate, function(e)
						{
							datastore.update(rate, function(e)
							{
								res.end();
								recomputeRatings(img);
							});
						});
					});
				}
			});
		});
	});
	
	app.post("/upload/url", reqauth, function(req, res)
	{
		console.log("Url upload from: " + req.body.imgurl);

		tempfs.open("nbooru", function(err, info)
		{
			if (err)
			{
				console.log(err);
				return;
			}

			function errorhandler(error, response, body)
			{
				if (error)
				{
					console.log(error);
					return;
				}

				if (!response.headers['content-type'])
				{
					console.log("No mime type ;_;");
					return;
				}

				createImageUpload(info.path, response.headers['content-type'], req.user, function(err)
				{
					if (err)
					{
						console.log("Could not rename file O_o");
						return;
					}

					res.writeHead(302, { "Location" : "/gallery/0" });
					res.end();
				});
			}
			
			try
			{
				request.get(req.body.imgurl, errorhandler).pipe(fs.createWriteStream(info.path));
			} catch (err)
			{
				console.log(err);
				return;
			}
		});
	});

	//Anyone can upload
	app.post("/upload/data", reqauth, function(req, res)
	{
		if (req.body.imgurl)
		{
			console.log(req.body.imgurl);
		}

		var files = [];

		for (var i in req.files) {
			files.push(req.files[i]);
		}

		async.forEach(files, function(imageFile, callback) 
		{
			createImageUpload(imageFile.path, imageFile.type, req.user, callback);
		}, function (err) 
		{
			if (err)
			{
				console.log("Could not rename file O_O.");
				return;
			}
			res.writeHead(302, { "Location" : "/gallery/0"});
			res.end();
		});
	});
});

var server = express.createServer();
server.use(express.profiler());
server.use(express.bodyParser());
server.use(express.cookieParser());
server.use(express.session({ secret: "Takamagahara is observing you..." }));
server.use(passport.initialize());
server.use(passport.session());
server.use(router);
server.use("/css", express.static("css/"));
server.use("/img", express.static("uploads/"));
server.use("/thumb", express.static("thumb/"));
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



