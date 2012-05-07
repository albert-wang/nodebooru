(function() {
  var booru = require("../obooru")
    , flow = require("flow");

  function getTags(datastore, images, cb) {
    var tags = new booru.KeyPredicate("Tag");
    tags.relationKeys("ImageTags", images);
    tags.limit(50);
    return datastore.getWithPredicate(tags, { resolveSets: false, select: true, count: false }, cb);
  }

  function tagCount(datastore, tag, cb) {
    var kp = new booru.KeyPredicate("Tag");
    kp.relationKeys("ImageTags", [tag]);
    kp.limit(1);

    return datastore.getWithPredicate(kp, { resolveSets: false, select: false, count: true }, function(e, count, t) {
      return cb(e, tag, count);
    });
  }

  function tagCounts(datastore, tags, cb) {
    var result = {};
    return flow.serialForEach(
      tags
      , function(val) {
        return tagCount(datastore, val, this)
      }
      , function(e, tag, count) {
        return result[tag.name] = count;
      }
      , function() {
        return cb(result);
      }
    );
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

  module.exports.getTags = getTags;
  module.exports.tagCount = tagCount;
  module.exports.tagCounts = tagCounts;
  module.exports.tagRepresentation = tagRepresentation;
  module.exports.recomputeRatings = recomputeRatings;
}());
