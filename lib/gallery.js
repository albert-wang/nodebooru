"use strict";

var booru = require("../obooru")
  , tar = require("./metadata")
  , fs = require("fs")
  , bind = require("bind")
  , flow = require("flow")
  , thunk = require("thunkify")
  ;

var statThunk = thunk(fs.stat);

function* getImageSet(datastore, tags, page, cb) {
  var images = new booru.KeyPredicate("Image");

  images.relationKeys("ImageTags", tags);
  images.offset(page * 20);
  images.limit(20);
  images.orderBy("uploadedDate", true);
  images.bridgeRelationIsLogicalOr(false);

  return yield datastore.harmony.getWithPredicate(images);
}

function* renderEmpty(datastore, res) {
  return renderGallery(datastore, res, [], 0, 0, []);
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

function* renderGallery(datastore, res, images, page, imageCount, tags, optInTags) {
  page = parseInt(page);

  var tagCounts = yield tar.tagCounts(datastore, tags);
  var isEmpty = (imageCount === 0);
  var result = [];

  for (var i = 0; i < images.length; ++i) {
    var splitMimes = images[i].mime.split("/");

    //The image path is the thumbnail path.
    var imgpath = "/thumb/temp_thumb.jpg";
    if (splitMimes[0] === "image") {
      try {
        if (yield statThunk("./thumb/" + images[i].filehash + "_thumb.jpg")) {
          imgpath = "/thumb/" + images[i].filehash + "_thumb.jpg";
        }
      } catch (e) {}

      try {
        if (yield statThunk("./thumb/" + images[i].filehash + "_thumb-0.jpg")) {
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
    var tr = tar.tagRepresentation(tags[i], tagCounts[tags[i].name]);

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

  var pageBuffer = 5;

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
    , "version" : "0.0.1"
  };

  return res.end(yield bind.thunkFile("static/gallery.tpl", data));
}

function* renderTagPage(datastore, req, res, tag, page) {
  var inputTags = tag.split(",");
  if (inputTags.length == 0) {
    return renderEmpty(datastore, res);
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

  for (var k in splitTags) {
    var tag = splitTags[k];

    var tagQuery = new booru.KeyPredicate("Tag");
    tagQuery.where("name = '" + tag.replace(/^\s+|\s+$/g, "") + "'");

    var tags = yield datastore.harmony.getWithPredicate(tagQuery, { select: true, count: false });
    result = result.concat(tags);
  }

  if (result.length == 0 || result.length != splitTags.length) {
    return yield renderEmpty(datastore, res);
  }

  var images = yield getImageSet(datastore, result, page);
  if (images.length == 0) {
    return yield renderEmpty(datastore, res);
  }

  var tags = yield tar.getTags(datastore, images);
  return yield renderGallery(datastore, res, images, page, images.total, tags, splitTags);
}

module.exports.imageSet = getImageSet;
module.exports.renderGallery = renderGallery;
module.exports.renderEmpty = renderEmpty;
module.exports.renderTagPage = renderTagPage;