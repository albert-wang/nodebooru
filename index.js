var booru = require("./obooru")
  , http = require("http")
  , bind = require("bind")
  , fs = require("fs")
  , util = require("util")
  , magic = require("mime-magic")
  , path = require("path")
  , express = require("express")
  , async = require("async")
  , flow = require("flow")
  , im = require("imagemagick")
  , request = require("request")
  , tempfs = require("temp")
  , NativServer = require("nativ-server")
  , glob = require("glob")
  , mime = require("./lib/mime")
  , arrayops = require("./lib/arrayops")
  , auth = require("./lib/auth")
  , tar = require("./lib/metadata")
  , gallery = require("./lib/gallery")
  , config = require('./config')
  , co = require("co")
  , harmonics = require("./lib/harmonics")
  ;

var datastore = new booru.SQLiteDatastore("db.sqlite")
datastore.setLogger(function(lvl, msg) {
  console.log(msg);
});

tar.init(datastore);
harmonics.harmonize(datastore);

var route_file = require('./lib/route_file')(datastore);
var reqauth = auth.authentication("/login");
var is_admin = function(email) {
  var isAdmin = false;

  for (var i in config.ADMIN_EMAILS) {
    if (email === config.ADMIN_EMAILS[i]) {
      isAdmin = true;
      break;
    }
  }

  return isAdmin;
}

var router = express.router(function(app) {
  app.harmony = {
    get: function(path, auth, cb) {
      if (cb == undefined) {
        cb = auth;
        auth = undefined;
      }

      var captured = function(req, res, next) {
        //The last argmuent is a 'done' callback, not to be confused with 'next'
        return co(cb)(req, res, next, null);
      }

      if (auth == undefined) {
        return app.get(path, captured);
      } else {
        return app.get(path, auth, captured);
      }
    },

    post: function(path, auth, cb) {
      if (cb == undefined) {
        cb = auth;
        auth = undefined;
      }

      var captured = function(req, res, next) {
        //The last argmuent is a 'done' callback, not to be confused with 'next'
        return co(cb)(req, res, next, null);
      }

      if (auth == undefined) {
        return app.post(path, captured);
      } else {
        return app.post(path, auth, captured);
      }
    }
  }

  app.harmony.get("/upload", reqauth, function* (req, res, next) {
    var data = yield bind.thunkFile("static/upload.tpl", {});
    return res.end(data);
  });

  app.harmony.get("/", function* (req, res, next) {
    res.writeHead(302, { "Location" : "/gallery" });
    return res.end();
  });

  app.harmony.get("/login/?", function*(req, res) {
    var data = yield bind.thunkFile("static/auth.tpl", {});
    return res.end(data);
  });

	app.harmony.get("/logout", function*(req, res) {
		req.logOut();
		res.redirect('/');
	});

  app.harmony.get("/auth/?", auth.profilescope, function*(req, res) {
    return res.redirect("/");
  });

  app.harmony.get(config.REDIRECT_URI, auth.callback, function*(req, res) {
    return res.redirect('/');
  });

  app.harmony.get("/image/:name", reqauth, route_file);

  app.harmony.get("/tag/:name/:page?", reqauth, function*(req, res, next) {
    var tags = req.params.name.split("+").join(",");
    return yield gallery.renderTagPage(datastore, req, res, tags, req.params.page || 0);
  });

  app.harmony.get("/gallery/:page?", reqauth, function*(req, res, next) {
    var page = req.params.page || 0;
    var kp = new booru.KeyPredicate("Image");
    kp.orderBy("uploadedDate", true);
    kp.offset(page * 20);
    kp.limit(20);

    var results = yield datastore.harmony.getWithPredicate(kp);
    if (results.length == 0) {
      gallery.renderEmpty(datastore, res);
    } else {
      var tags = yield tar.getTags(datastore, results);
      yield gallery.renderGallery(datastore, res, results, page, results.total, tags);
    }
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

  app.post("/tag/batch", reqauth, function(req, res) {
    var imgs = req.body.imgs;
    var tags = req.body.tags;

    flow.serialForEach(
      imgs
      , function(i) {
        tar.setTagCollection(i, tags, false, this);
      }
      , function() {}
      , function() {
        res.end();
      }
    );
  });

  app.post("/tag/set", reqauth, function(req, res) {
    return tar.setTagCollection(req.body.filehash, req.body.newtags, true, function(err) {
      res.end();
    });
  });

  app.post("/tag/data", reqauth, function(req, res) {
    gallery.renderTagPage(datastore, req, res, req.body.tag, 0);
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

            if (mime.requiresThumbnail(mt)) {
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

  // Deletes the specified image and upload metadata, as well as all other metadata (comments, etc.)
  function *deleteImage(image, uploadData) {
    // Delete tags
    var tags = yield tar.getTags(datastore, [image]);
    for (var i in tags) {
      yield datastore.harmony.unlink(image, tags[i]);
    }

    var comments = yield tar.getComments(datastore, [image]);
    for (var i in comments) {
      yield datastore.harmony.remove(comments[i])
    }

    var ratings = yield tar.getRatings(datastore, [images]);
    for (var i in ratings) {
      yield datastore.harmony.remove(ratings[i]);
    }

    // Delete image data
    if (mime.requiresThumbnail(image.mime)) {
        yield fs.harmony.unlink("./thumb/" + image.filehash + "_thumb.jpg");
    }

    var filename = image.filehash + "." + mime.extension(image.mime);
    yield fs.unlink("./uploads/" + filename);

    // Delete image and upload metadata
    if (uploadData) {
        yield datastore.harmony.remove(uploadData);
    }

    yield datastore.harmony.remove(image);
  }

  app.harmony.post("/delete/image/:name", reqauth, function* (req, res, next) {
    // Delete the specified image if the authed user is its uploader or an admin
    var imageP = new booru.KeyPredicate("Image");
    imageP.where("filehash == '" + req.params.name + "'");
    imageP.limit(1);

    var images = yield datastore.harmony.getWithPredicate(imageP);
    if (images.length == 0) {
      return;
    }

    var image = imaegs[0];
    var metadataP = new booru.KeyPredicate("UploadMetadata");
    metadataP.whereGUID("imageGUID", image.pid);

    var metadata = yield datastore.harmony.getWithPredicate(metadataP);
    var data = metadata[0];;

    if (!data || auth.can_delete(data, req.user.emails[0].value)) {
      // If metadata is not available, or the user is allowed to delete this file, delete it
      console.log("Deleting image " + req.params.name);

      // Delete this image and all metadata
      yield deleteImage(image, data);
    }

    res.writeHead(302, { "Location" : "/gallery/0"});
    res.end();
  });

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
            tar.recomputeRatings(datastore, img);
          });
        }
        else {
          return datastore.create("Rating", function(e, rate) {
            rate.rating = parseInt(req.body.rating);
            rate.raterEmail = req.user.emails[0].value;

            return img.addRatings(rate, function(e) {
              return datastore.update(rate, function(e) {
                res.end();
                tar.recomputeRatings(datastore, img);
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
    if (uploaderEmail === undefined && "email" in req.files) {
      tryEmail = req.files["email"]
      delete req.files["email"]

      if (tryEmail.size < 100) {
        uploaderEmail = fs.readFileSync(tryEmail.path, "utf8")
      }
    }

    var tags = req.body.tags;
    if (tags === undefined && "tags" in req.files) {
      tryTags = req.files["tags"]
      delete req.files["tags"]

      tags = fs.readFileSync(tryTags.path, "utf8")
    }

    if (!auth.validateEmail(uploaderEmail)) {
      console.log("The user: " + uploaderEmail + " was not a valid email");
      res.writeHead(403);
      res.end();
      return;
    }

    var files = [];
    for (var i in req.files)  {
      if (req.files[i].mime != null) {
        // Only process actual files
        files.push(req.files[i]);
      }
    }

    if (files.length == 0) {
      console.log("No files uploaded?")
    }

    var uploadResults = []
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

            uploadResults.push(img)

            if (tags) {
              return tar.setTagCollection(img.filehash, tags, false, function(err) {
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

        res.end(JSON.stringify(uploadResults));
      }
    );
  });

  app.post("/upload/data", reqauth, function(req, res) {
    var files = [];

    for (var i in req.files) {
      if (req.files[i].mime != null) {
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

server.use(NativServer.create(datastore, booru, {
  storage: new LocalStorageNoExtensions({ path: "uploads" })
}));

server.use(express.bodyParser());
server.use(express.cookieParser());
server.use(express.session({ secret: "Takamagahara is observing you..." }));
server.use(auth.initialize());
server.use(auth.session());
server.use(router);
server.use("/css", express.static("css/"));
server.use("/img", express.static("uploads/"));
server.use("/thumb", express.static("thumb/"));

server.listen(config.PORT);
console.log("Server is now listening on port " + config.PORT);
