(function() {
  var booru = require("../obooru")
    , flow = require("flow")
    , arrayops = require("./arrayops")
    , util = require("util")

  var datastore;

  module.exports.init = function(ds) {
    datastore = ds;
  }

  function getComments(datastore, images, cb) {
    var comments = new booru.KeyPredicate("Comment");
    comments.relationKeys("comments", images);
    return datastore.getWithPredicate(comments, cb);
  }

	function getRatings(datastore, images, cb) {
    var ratings = new booru.KeyPredicate("Rating");
    ratings.relationKeys("ratings", images);
    ratings.limit(200);
		return datastore.getWithPredicate(ratings, cb);
	}

  function getTags(datastore, images) {
    var tags = new booru.KeyPredicate("Tag");
    tags.relationKeys("ImageTags", images);
    tags.limit(50);
    return datastore.harmony.getWithPredicate(tags, { resolveSets: false, select: true, count: false });
  }

  function* tagCount(datastore, tag) {
    var kp = new booru.KeyPredicate("Tag");
    kp.relationKeys("ImageTags", [tag]);
    kp.limit(1);

    var res = yield datastore.harmony.getWithPredicate(kp, { resolveSets: false, select: false, count: true });
    return res.total;
  }

  function* tagCounts(datastore, tags) {
    var result = {}
    for (var k in tags) {
      result[tags[k].name] = yield tagCount(datastore, tags[k]);
    }

    return result;
  }

  function tagRepresentation(tag, count) {
    return {
      url_name: tag.name
      , display_name: tag.name.replace("_", " ")
      , count : count || "??"
      , 'class' : "default"
    };
  }

  function recomputeRatings(datastore, img) {
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
      return getTags(datastore, [image[0]], function(e, total, tags) {
        var ts = [];
        for (var i = 0; i < tags.length; ++i) {
          ts.push(tags[i].name);
        }

        var diff = arrayops.difference(ts, newtags);

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

  module.exports.getComments = getComments;
	module.exports.getRatings = getRatings;
  module.exports.getTags = getTags;
  module.exports.tagCount = tagCount;
  module.exports.tagCounts = tagCounts;
  module.exports.tagRepresentation = tagRepresentation;
  module.exports.recomputeRatings = recomputeRatings;
  module.exports.setTagCollection = setTagCollection;
}());
