"use strict"

var bind = require("bind")
  , booru = require("../obooru")
  , config = require('../config')
  , tar = require("./metadata")
  , mime = require("./mime")
  , auth = require("./auth")
  ;

module.exports = function(datastore) {
  return function*(req, res, next) {
    var kp = new booru.KeyPredicate("Image");
    kp.where("filehash == '" + req.params.name + "'");
    kp.limit(1);

    var isAdmin = false;
    var email = req.user.emails[0].value;

    for (var i in config.ADMIN_EMAILS) {
      if (email === config.ADMIN_EMAILS[i]) {
        isAdmin = true;
        break;
      }
    }

    var files = yield datastore.harmony.getWithPredicate(kp);
    if (files.length == 0) {
      res.writeHead(404);
      res.end();
      return;
    }

    var img = files[0];

    var commentP = new booru.KeyPredicate("Comment");
    commentP.relationKeys("comments", [img]);
    commentP.orderBy("dateCreated", false);

    var ratingsP = new booru.KeyPredicate("Rating");
    ratingsP.relationKeys("ratings", [img]);
    ratingsP.where("raterEmail =='" + req.user.emails[0].value + "'");
    ratingsP.limit(1);

    var metadataP = new booru.KeyPredicate("UploadMetadata");
    metadataP.whereGUID("imageGUID", img.pid);

    var comments = yield datastore.harmony.getWithPredicate(commentP);
    var tagCounts = yield tar.tagCounts(datastore, tags);
    var metadatas = yield datastore.harmony.getWithPredicate(metadataP);
    var ratings = yield datastore.harmony.getWithPredicate(ratingsP);
    var tags = yield tar.getTags(datastore, [img]);

    var filename =  img.filehash + "." + mime.extension(img.mime);
    var meta = { "uploadedBy" : "Anonymous", "originalExtension" : "Unknown" };
    if (metadatas.length) {
      meta = metadatas[0];
    }

    var ts = [];
    var tagstr = "";
    for (var i = 0; i < tags.length; ++i) {
      ts.push(tar.tagRepresentation(tags[i], tagToCountMap[tags[i].name]));
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
    if (ratings.length) {
      rate = ratings[0].rating;
    }

    result = {
      "hash" : img.filehash
        , "content" : mime.viewForMime(img.mime, "/img/" + filename)
        , "tags" : ts
        , "original-tags" : tagstr
        , "time" : "" + img.uploadedDate
        , "comments" : cs
        , "mimetype" : img.mime
        , "uploadedBy" : meta.uploadedBy
        , "your-rating" : rate
        , "average-rating" : img.ratingsAverage
        , "is-admin?" : isAdmin
        , "can-delete" : isAdmin || auth.can_delete(meta, req.user.emails[0].value) ? "true" : ""
    };

    data = yield bind.thunkFile("static/image.tpl", result);
    return res.end(data);
  }
}
