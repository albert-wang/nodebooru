(function() {
  var mime = require("mime");
  mime.define({ "audio/mp3" : ["mp3"] });

  function requiresThumbnail(type) {
    var splitMimes = type.split("/");
    return splitMimes[0] === "image";
  }

  function viewForMime(type, path) {
    var splitMimes = type.split("/");

    if (splitMimes[0] === "image") {
      return "<a href='" + path + "'><img src='" + path + "'></a>";
    }
    else if (splitMimes[0] === "video") {
      return "<video controls='controls'><source src='" + path + "' type='" + type + "'> Video Unsupported :( </video><br/><a href='" + path + "'>Download</a>";
    }
    else if (splitMimes[0] === "audio") {
      return "<audio controls='controls'><source src='" + path + "' type='" + type + "'> Audio Unsupported :( </audio><br/><a href='" + path + "'>Download</a>";
    }

    return "<a href='" + path + "'>Download</a>";
  }

  module.exports = mime;
  module.exports.requiresThumbnail = requiresThumbnail;
  module.exports.viewForMime = viewForMime;
}());
