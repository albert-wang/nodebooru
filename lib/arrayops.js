(function() {
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

  module.exports.difference = arrayDifference;
}());
