var through = require('through2');

/**
 * create a log reporter
 * @param {Object} options reporter options
 *
 * available options are:
 *   - states: list of state to log (default to all)
 */

module.exports = function(options) {
  if (!options) options = {};

  var stream = through.obj(function (file, enc, cb) {
    var state;
    if (!file.s3) return cb(null, file);

    if (!file.s3.state) return cb(null, file);
    if (options.states &&
        options.states.indexOf(file.s3.state) === -1) return cb(null, file);
   
    if (!options.eachFile) return cb(null, file);
    options.eachFile(file);

    cb(null, file);
  });

  // force flowing mode
  // @see http://nodejs.org/docs/latest/api/stream.html#stream_event_end
  // @see https://github.com/pgherveou/gulp-awspublish/issues/13
  stream.resume();
  return stream;
};
