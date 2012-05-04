var 
  booru = require("./obooru")
  , http = require("http")
  , bind = require("bind")
  , fs = require("fs")
  , formidable = require("formidable")
  , util = require("util")
  , mime = require("mime")
  , magic = require("mime-magic")
  , path = require("path")
  , express = require("express")
  , async = require("async")
  , flow = require("flow")
  , im = require("imagemagick")
  , request = require("request")
  , tempfs = require("temp")
  , passport = require("passport")
  , OAuth2Strategy = require("passport-google-oauth").OAuth2Strategy
  , NativServer = require("nativ-server")
  , glob = require("glob")
  , config = require('./config')
  ;

var NO_LOGIN_REQUIRED = false;

if ((process.argv.indexOf("--no-login") != -1) || (process.argv.indexOf("-nl") != -1)) {
	NO_LOGIN_REQUIRED = true;
	console.log("Logins are not required for this server.");
}

//Adding some mime definitions
mime.define({
	"audio/mp3" : ["mp3"]
});

//Tag mappings.
function tagFromMime(mime, path) {
	var splitMimes = mime.split("/");

	if (splitMimes[0] === "image") {
		return "<a href='" + path + "'><img src='" + path + "'></a>";
	}
  else if (splitMimes[0] === "video") {
		return "<video controls='controls'><source src='" + path + "' type='" + mime + "'> Video Unsupported :( </video><br/><a href='" + path + "'>Download</a>";
	}
  else if (splitMimes[0] === "audio") {
		return "<audio controls='controls'><source src='" + path + "' type='" + mime + "'> Audio Unsupported :( </audio><br/><a href='" + path + "'>Download</a>";
	}

	return "<a href='" + path + "'>Download</a>";
}

function requiresThumbnail(mime) {
	var splitMimes = mime.split("/");

	if (splitMimes[0] === "image") {
		return true;
	}

	return false;
}

function validateEmail(email) {
	if (email) {
		for (var domain in config.ALLOWED_DOMAINS) {
			if (email.match(".*@" + config.ALLOWED_DOMAINS[domain] + "$")) {
				return true;
			}
		}
	}

	return false;
}

passport.serializeUser(function(user, done) {
	return done(null, user)
});

passport.deserializeUser(function(obj, done) {
	return done(null, obj);
});

portString = ''
if (config.EXT_PORT != 80) {
  portString = ':' + config.EXT_PORT;
}

var googleCallbackURI = 'http://' + config.HOSTNAME + portString + '/auth/google/callback';

var ghstrat = new OAuth2Strategy(
  { clientID: config.CLIENT_ID
  , clientSecret: config.SECRET_KEY
  , callbackURL: googleCallbackURI
  }
  , function(access, refresh, profile, done) {
    for (id in profile.emails) {
      var email = profile.emails[id].value

      if (validateEmail(email)) {
        if (email.match(".*@" + ALLOWED_DOMAINS[domain] + "$")) {
          return done(null, profile);
        }
      }
    }

    return done(false, null);
  }
);

passport.use(ghstrat);

var datastore = new booru.SQLiteDatastore("db.sqlite")
datastore.setLogger(function(msg) {
	console.log(msg);
});

function arrayDifference(orig, next) {
	orig.sort(); 
	next.sort();

	if (orig.length == 0 || next.length == 0) {
		return { added: next, removed: orig };
	}

	var added = []
	var removed = []

	var oi = 0; 
	var ni = 0;

	while (oi < orig.length && ni < next.length) {
		if (orig[oi] < next[ni]) {
			removed.push(orig[oi]);
			oi++;
		} 
		else if (orig[oi] > next[ni]) {
			added.push(next[ni]);
			ni++;
		} 
    else {
			oi++;
			ni++;
		}
	}

	if (ni < next.length) {
		added = added.concat(next.slice(ni, next.length));
	} 

	if (oi < orig.length) {
		removed = removed.concat(orig.slice(oi, orig.length));
	}

	return { "added" : added, "removed" : removed };
}

function getTagSet(images, cb) {
	var tags = new booru.KeyPredicate("Tag");
	tags.relationKeys("ImageTags", images);
	tags.limit(50);
	return datastore.getWithPredicate(tags, { resolveSets: false, select: true, count: false }, cb);
}

function getTagCounts(tags, cb) {
	var result = {};
	return flow.serialForEach(
    tags
    , function(val) {
      return getTagCount(val, this)
    }
    , function(e, tag, count) {
      return result[tag.name] = count;
    }
    , function() {
      return cb(result);
    }
  );
}

function getTagCount(tag, cb) {
	var kp = new booru.KeyPredicate("Tag");
	kp.relationKeys("ImageTags", [tag]);
	kp.limit(1);

	return datastore.getWithPredicate(kp, { resolveSets: false, select: false, count: true }, function(e, count, t) {
		return cb(e, tag, count);
	});
}

function recomputeRatings(img) {
	var kp = new booru.KeyPredicate("Rating");
	kp.relationKeys("ratings", [img]);
	kp.limit(200);

	return datastore.getWithPredicate(kp, function(e, count, rates) {
		var average = 0;
		for (var i = 0; i < rates.length; ++i) {
			average += rates[i].rating; 
		}

		average /= rates.length;

		img.ratingsAverage = average;

		console.log("Rating: " + average);

		return datastore.update(img, function(e) {
      if (e) {
        console.log(e);
      }
    });
	});
}

function getImageSet(tags, page, cb) {
	var images = new booru.KeyPredicate("Image");

	images.relationKeys("ImageTags", tags);
	images.offset(page * 20);
	images.limit(20);
	images.orderBy("uploadedDate", true);
	images.bridgeRelationIsLogicalOr(false);

	return datastore.getWithPredicate(images, cb);
}

function getTagRepresentation(tag, c) {
	return {
		url_name: tag.name
		, display_name: tag.name.replace("_", " ")
		, count : c || "??"
		, 'class' : "default"
	};
}

function renderEmpty(res) {
	renderGallery(res, [], 0, 0, []);
}

function renderGallery(res, images, page, imageCount, tags, optInTags) {
	page = parseInt(page);

	return getTagCounts(tags, function(tagCounts) {
		var isEmpty = (imageCount === 0);
		var result = []; 

		for (var i = 0; i < images.length; ++i) {
			var splitMimes = images[i].mime.split("/");
	
			//The image path is the thumbnail path.
			var imgpath = "/thumb/temp_thumb.jpg";
			if (splitMimes[0] === "image") {
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
			} 
      else if (splitMimes[0] === "audio") {
				imgpath = "/thumb/music.png";
			} 
      else if (splitMimes[0] === "video") {
				imgpath = "/thumb/video.png";
			}
				
			result.push({
				path: "/image/" + images[i].filehash, 
				imgpath: imgpath,
				imghash: images[i].filehash
			});
		}

		var ts = []
		for (var i = 0; i < tags.length; ++i) {
			var tr = getTagRepresentation(tags[i], tagCounts[tags[i].name]);
				
			if (optInTags) {
				var extras = "";

				for(var j = 0; j < optInTags.length; ++j) {
					if (tags[i].name !== optInTags[j]) {
						if (extras !== "") {
							extras = extras + "+";
						}

						extras = extras + optInTags[j];
					}
				}

				tr.extra = extras;
			}

			ts.push(tr);
		}

		var currentTags = "";
		if (optInTags) {
			for (var i = 0; i < optInTags.length; ++i) {
				if (i) {
					currentTags = currentTags + "+" + optInTags[i];
				} 
        else {
					currentTags = optInTags[i];
				}
			}
		}

		var pageCount = Math.ceil(imageCount / 20);
		var pages = []; 

		pageBuffer = 5;

		var startPage = page - pageBuffer;
		if (startPage < 0) {
			startPage = 0;
		}

		var endPage = page + pageBuffer;
		if (endPage > pageCount) {
			endPage = pageCount;
		}

		if (page > 0 && page < pageCount) {
			renderPageLink(pages, page - 1, "&larr; Prev", optInTags, currentTags);
		}

		for (var i = startPage; i < endPage; i++) {
			renderPageLink(pages, i, i, optInTags, currentTags);
		}

		if (page < pageCount) {
			renderPageLink(pages, page + 1, "Next &rarr;", optInTags, currentTags);
		}

		var data = {
      "is-empty" : isEmpty
			, "images" : result
			, "pages" : pages
			, "tags" : ts
			,"version" : "0.0.1"
		};

		return bind.toFile("static/gallery.tpl", data, function(data) {
			return res.end(data);
		});
	});
}

function renderPageLink(pages, imageNumber, label, optInTags, currentTags) {
	if (optInTags) {
		pages.push({
			path: "/tag/" + currentTags + "/" + imageNumber,
			label: label
		});
	} 
  else {
		pages.push({
			path: "/gallery/" + imageNumber,
			label: label
		});
	}
}

function renderTagPage(req, res, tag, page) {
	var inputTags = tag.split(",");
	if (inputTags.length == 0) {
		return renderEmpty(res);
	}

	var splitTags = [];
	for (var i in inputTags) {
		var r = inputTags[i];
		r = r.replace(/^\s+|\s+$/g, "");
		
		if (r.length !== 0) {
			splitTags.push(r);
		}
	}

	var result = [];
	
	return flow.serialForEach(
    splitTags
    , function(tag) {
      var tagQuery = new booru.KeyPredicate("Tag");
      tagQuery.where("name = '" + tag.replace(/^\s+|\s+$/g, "") + "'");

      var self = this;
      return datastore.getWithPredicate(tagQuery, { resolveSets: false, select: true, count: false }, this);
    }
    , function(error, total, tags) {
      result = result.concat(tags);
    }
    , function() {
      if (result.length == 0 || result.length != splitTags.length) {
        renderEmpty(res);
        return;
      }
      
      return getImageSet(result, page, function(e, tc, images) {
        if (images.length == 0) {
          renderEmpty(res);
          return;
        }

        return getTagSet(images, function(e, total, tags) {
          return renderGallery(res, images, page, tc, tags, splitTags);
        });
      });	
    }
  );
}

function reqauth(req, res, next) {
	if (NO_LOGIN_REQUIRED) {
		//Proxy a user in the no login senario
		req.user = {
			"emails" : [ { "value" : "nologin@ironclad.mobi" } ]
		}
		return next();
	}

	if (req.isAuthenticated()) { 
    return next(); 
  }

	res.redirect("/login");
}

var router = express.router(function(app) {
	app.get("/upload", reqauth, function (req, res, next) {
		return bind.toFile("static/upload.tpl", {}, function(data) {
			return res.end(data);
		});
	});

	app.get("/", function(req, res, next) {
		res.writeHead(302, { "Location" : "/gallery" });
		res.end();
	});

	app.get("/login/?", function(req, res) {
		return bind.toFile("static/auth.tpl", {}, function(data) {
			return res.end(data);
		});
	});

  var authParam = passport.authenticate(
    'google'
    , { scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'] }
  );

	app.get("/auth/?", authParam, function(req, res) {
		return res.redirect("/");
	});

  var authParam = passport.authenticate('google', { failureRedirect: '/login'});
	app.get("/auth/google/callback", authParam, function(req, res) {
		return res.redirect('/');
	});

	app.get("/image/:name", reqauth, function(req, res, next) {
		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash == '" + req.params.name + "'");
		kp.limit(1);

		return datastore.getWithPredicate(kp, function(e, total, vals) {
			var img = vals[0];

			var commentP = new booru.KeyPredicate("Comment");
			commentP.relationKeys("comments", [img]);
			commentP.orderBy("dateCreated", false);

			return datastore.getWithPredicate(commentP, function(e, commentCount, comments) {
				return getTagSet([img], function(e, total, tags) {
					return getTagCounts(tags, function(tagToCountMap) {
						var metadataP = new booru.KeyPredicate("UploadMetadata");
						metadataP.whereGUID("imageGUID", img.pid);

						return datastore.getWithPredicate(metadataP, function(e, unused, metadatas) {
							var ratingsP = new booru.KeyPredicate("Rating");
							ratingsP.relationKeys("ratings", [img]);
							ratingsP.where("raterEmail =='" + req.user.emails[0].value + "'");
							ratingsP.limit(1);

							return datastore.getWithPredicate(ratingsP, function(e, unused, userRating) {
								var filename =  img.filehash + "." + mime.extension(img.mime);
								var meta = { "uploadedBy" : "Anonymous", "originalExtension" : "Unknown" };
								if (metadatas.length) {
									meta = metadatas[0];
								}

								var ts = [];
								var tagstr = "";
								for (var i = 0; i < tags.length; ++i) {
									ts.push(getTagRepresentation(tags[i], tagToCountMap[tags[i].name]));
									if (i) {
										tagstr = tagstr + ", ";
									}
									tagstr = tagstr + tags[i].name;
								}

								var cs = [];
								for (var i = 0 ; i < comments.length; ++i) {
									cs.push({
										contents: comments[i].contents,
										author: "unknown"
									})
								}

								var rate = "0";
								if (userRating.length) {
									rate = userRating[0].rating;
								}

								result = {
									"hash" : img.filehash
									,"content" : tagFromMime(img.mime, "/img/" + filename)
									, "tags" : ts
									, "original-tags" : tagstr
									, "time" : "" + img.uploadedDate
									, "comments" : cs
									, "mimetype" : img.mime
									, "uploadedBy" : meta.uploadedBy
									, "your-rating" : rate
									, "average-rating" : img.ratingsAverage
								};

								return bind.toFile("static/image.tpl", result, function(data) {
									return res.end(data);
								});	
							});
						});
					});
				});
			});
		});
	});

	app.get("/tag/:name/:page?", reqauth, function(req, res, next) {
		var tags = req.params.name.split("+").join(",");
		return renderTagPage(req, res, tags, req.params.page || 0);
	});

	app.get("/gallery/:page?", reqauth, function(req, res, next) {
		var page = req.params.page || 0;
		var kp = new booru.KeyPredicate("Image");
		kp.orderBy("uploadedDate", true);
		kp.offset(page * 20);
		kp.limit(20);

		return datastore.getWithPredicate(kp, function(e, total, images) {
			if (images.length == 0) {
				renderEmpty(res);
				return;
			}

			return getTagSet(images, function(e, t, tags) {
				renderGallery(res, images, page, total, tags);
			});
		});
	});

	app.post("/comment/set", reqauth, function(req, res) {
		var imageID = req.body.filehash; 
		
		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash = '" + req.body.filehash + "'");
		kp.limit(1);
		
		return datastore.getWithPredicate(kp, function(e, total, image) {
			return datastore.createComment(function(e, nc) {
				nc.dateCreated = new Date();
				nc.contents = req.body.comment;
				
				return image[0].addComments(nc, function(e) {
					return datastore.update(nc, function(e) {
						//Done
						res.end();
					});
				});	
			});
		});
	});

	function setTagCollection(imageHash, newTags, doremovals, cb) {
		var imageID = imageHash;
		var newtags = newTags.split(",").map(function(t) {
			return t.replace(/\s+/g, " ").replace(/^\s+|\s+%/g, "");
		});

		newtags = newtags.filter(function(val) { return val !== ""; });
		newtags = newtags.map(function(val) { return val.toLowerCase(); });

		var kp = new booru.KeyPredicate("Image");
		kp.where("filehash = '" + imageID + "'");

		return datastore.getWithPredicate(kp, function(e, total, image) {
			return getTagSet([image[0]], function(e, total, tags) {
				var ts = [];
				for (var i = 0; i < tags.length; ++i) {
					ts.push(tags[i].name);	
				}

				var diff = arrayDifference(ts, newtags);

				console.log(util.inspect(diff));

				flow.serialForEach(
          diff.added
          , function(tName) {
            var pred = new booru.KeyPredicate("Tag");
            pred.where("name = '" + tName + "'");
            
            var self = this;

            return datastore.getWithPredicate(pred, function(e, total, t) {
              if (total === 0) {
                return datastore.createTag(function(e, nt) {
                  nt.name = tName;
                  return datastore.update(nt, function(e) {
                    return datastore.link(image[0], nt, function(e) {
                      self();
                    });
                  });
                });
              } 
              else  {
                return datastore.link(image[0], t[0], function(e) {
                  self();
                });
              }
            });
				}
        , function() {}
				, function() {
					if (doremovals) {
						flow.serialForEach(
              diff.removed
              , function(t) {
                var pred = new booru.KeyPredicate("Tag");
                pred.where("name = '" + t + "'");
                pred.limit(1);
    
                var self = this;
                return datastore.getWithPredicate(pred, function(e, total, t) {
                  return datastore.unlink(image[0], t[0], function(e) {
                    self();
                  });
                });
              }
              , function() {}
						  , function() {
                cb(undefined);
              }
            );
					} 
          else {
						cb(undefined);
					}
				});
			});
		});
	}

	app.post("/tag/batch", reqauth, function(req, res) {
		var imgs = req.body.imgs;
		var tags = req.body.tags;

		flow.serialForEach(
      imgs
      , function(i) {
        setTagCollection(i, tags, false, this);
      }
      , function() {}
		  , function() {
        res.end();
      }
    );
	});

	app.post("/tag/set", reqauth, function(req, res) {
		return setTagCollection(req.body.filehash, req.body.newtags, true, function(err) {
			res.end();
		});
	});

	app.post("/tag/data", reqauth, function(req, res) {
		renderTagPage(req, res, req.body.tag, 0);
	});


	//Generic file upload method
	function createImageUpload(path, mt, user, cb) {
		return datastore.create("Image", function(err, i) {
			if (err) {
				console.log(err);
				return;
			}

			i.filehash = i.pid.toString();
			i.mime = mt;
			i.uploadedDate = new Date();

			return datastore.update(i, function(e) {
				var newPath = "uploads/" + i.filehash + "." + mime.extension(mt);

        /* Use two streams + pump instead of fs.rename since the file is
         * likely in /tmp and /tmp is rarely on the same device as where we're
         * storing the data */

        var is = fs.createReadStream(path);
        var os = fs.createWriteStream(newPath);

        return util.pump(is, os, function(er) {
          if (er) {
						console.log(e);
						return datastore.remove(i, function(err) {
							cb(err || e, undefined);
						});
          }

          return fs.unlink(path, function(er) {
            cb(e, i);

            if (requiresThumbnail(mt)) {
              /* Don't return here; thumbnail asynchronously */
              im.convert(
                [ '-define', 'jpeg:size=900x900'
                , newPath
                , '-thumbnail', '300x300^'
                , '-gravity', 'center'
                , '-unsharp', '0x.5'
                , "thumb/" + i.filehash + "_thumb.jpg"
                ]
                , function(err, stdout, stderr) {
                  if (err) {
                    console.log(err);
                    console.log('Error creating thumbnail; make sure ImageMagick is installed');
                  }
                }
              ); 
            }

            return datastore.create("UploadMetadata", function(err, m) {
              m.imageGUID = i.pid;
              m.uploadedBy = user.emails[0].value;
              m.originalExtension = path.split('.').pop() || "unknown";

              return datastore.update(m, function(e) {});
            });
          });
        });
			});
		});
	}

	app.post("/rating/modify", reqauth, function(req, res) {
		var imgid = new booru.GUID(req.body.imgid);
		var imageP = new booru.KeyPredicate("Image");

		imageP.where("filehash == '" + req.body.imgid + "'");
		imageP.limit(1);

		return datastore.getWithPredicate(imageP, function(e, total, images) {
			var img = images[0]; 
			var kp = new booru.KeyPredicate("Rating");
			kp.relationKeys("ratings", images);
			kp.where("raterEmail='" + req.user.emails[0].value + "'");

			return datastore.getWithPredicate(kp, function(e, total, ratings) {
				if (ratings.length) {
					var rate = ratings[0];
					rate.rating = parseInt(req.body.rating);

					return datastore.update(rate, function(e) {
						res.end();
						recomputeRatings(img);
					});
				} 
        else {
					return datastore.create("Rating", function(e, rate) {
						rate.rating = parseInt(req.body.rating);
						rate.raterEmail = req.user.emails[0].value;

						return img.addRatings(rate, function(e) {
							return datastore.update(rate, function(e) {
								res.end();
								recomputeRatings(img);
							});
						});
					});
				}
			});
		});
	});
	
	app.post("/upload/url", reqauth, function(req, res) {
		console.log("Url upload from: " + req.body.imgurl);

		if (req.body.imgurl === '') {
			res.writeHead(302, { "Location" : "/gallery/0" });
			res.end();
			return;
		}

		return tempfs.open("nbooru", function(err, info) {
			if (err) {
				console.log(err);
				return;
			}

			function errorhandler(error, response, body) {
				if (error) {
					console.log(error);
					return;
				}
				
				var mimeType = response.headers['content-type'];
				if (!mimeType) {
					return magic.fileWrapper(info.path, function(err, type) {
						return createImageUpload(info.path, type, req.user, function(err) {
							if (err) {
								console.log("Could not rename file O_o: " + err);
                console.log(err.stack);
								res.writeHead(500);
								res.end();
								return;
							}

							res.writeHead(302, { "Location" : "/gallery/0" });
							res.end();
						});
					});
				} 
        else  {
					return createImageUpload(info.path, mimeType, req.user, function(err) {
						if (err) {
							console.log("Could not rename file O_o: " + err);
              console.log(err.stack);
							res.writeHead(500);
							res.end();
							return;
						}

						res.writeHead(302, { "Location" : "/gallery/0" });
						res.end();
					});
				};
			}
			
			try {
				request.get(req.body.imgurl, errorhandler).pipe(fs.createWriteStream(info.path));
			} 
      catch (err) {
				console.log(err);
				return;
			}
		});
	});

	app.post("/upload/curl", function(req, res) {
		var uploaderEmail = req.body.email;
		if (!validateEmail(uploaderEmail)) {
			console.log("The user: " + uploaderEmail + " was not a valid email");
			res.writeHead(403);
			res.end();
			return;
		}

		var files = [];
		for (var i in req.files)  {
			files.push(req.files[i]);
		}
		
		console.log("Uploading unauthed file from: " + uploaderEmail);
		async.forEach(
      files
      , function(i, cb) {
        return magic.fileWrapper(i.path, function(err, type) {
          if (err) {
            console.log(err.message);
            cb(err);
            return;
          }

          return createImageUpload(i.path, type, { "emails" : [ { "value" : uploaderEmail } ] }, function(err, img) {
            if (err) {
              cb(err);
              return;
            }
      
            tags = req.body.tags;
            if (tags) {
              return setTagCollection(img.filehash, tags, false, function(err) {
                if (err) {
                  console.log("Failed to set tags.");
                  return cb(err);
                }

                return cb(undefined);
              });
            } 
            else  {
              return cb(undefined);
            }
          }); 
        });
      }
      , function(err) {
        if (err) {
          console.log("Could not upload file");
          return;
        }

        if (files.length == 1) {
          res.end('Successfully uploaded "' + files[0].name + '".\n');
        } 
        else {
          res.end('Successfully uploaded ' + files.length + ' files.\n');
        }
      }
    );
	});

	//Anyone can upload
	app.post("/upload/data", reqauth, function(req, res) {
		var files = [];

		for (var i in req.files) {
			if (req.files[i].size > 0) {
				files.push(req.files[i]);
			}
		}

		async.forEach(
      files
      , function(imageFile, callback) {
        return magic.fileWrapper(imageFile.path, function(err, type) {
          if (err) {
            console.log(err);
            return callback(err);
          }

          return createImageUpload(imageFile.path, type, req.user, callback);
        });
      }
      , function (err) {
        if (err) {
          console.log("Could not rename file O_O: " + err);
          console.log(err.stack);
          res.writeHead(500);
          return res.end();
        }

        res.writeHead(302, { "Location" : "/gallery/0"});
        res.end();
      }
    );
	});
});


//This is a storage that is basically LocalStorage, except that it looks for files with extensions
//if a no-extension version could not be found.
function LocalStorageNoExtensions(opts) {
	var self = this;
	var ls = new NativServer.LocalStorage(opts);

	self.storeFile = ls.storeFile;
	self.sendFile = function(res, desiredMime, id, isthumb, cb) {
		var target = ls._makeLocalPath(id);

		return path.exists(target, function(ex) {
			if (ex) {
				return ls.sendFile(res, desiredMime, id, isthumb, cb);
			} 

      return glob(target + ".*", {}, function(err, values) {
        if (err) {
          cb(err);
        }

        if (values.length > 0) {
          return fs.readFile(values[0], function(er, data) {
            if (er) {
              return cb(er);
            }

            res.write(data);
            return cb();
          });
        }
      });
		});
	};
}

var server = express.createServer();

server.use(NativServer.create(booru, {
	databasePath: "db.sqlite",
	storage: new LocalStorageNoExtensions({ path: "uploads" })
}));

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

server.listen(config.PORT)
console.log("Server is now listening on port " + config.PORT);	
