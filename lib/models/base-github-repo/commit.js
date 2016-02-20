'use strict';

var util = require('util');
var Base = require('../base');
var path = require('path');
var isString = require('101/is-string');
var isFunction = require('101/is-function');

module.exports = Commit;

function Commit () {
  Base.apply(this, arguments);
}

util.inherits(Commit, Base);

Commit.prototype.idAttribute = 'sha';

Commit.prototype.urlPath = 'commits';

/* compare a commit against this commit. it will tell you how far ahead/behing
 * the current commit is to the one comparing against.
 * e.g.:
 * repo.newCommit('hash1').compare('hash3', function (err, data) {
 *   // data = { ... behind_by: 2, ...}
 * })
 */
Commit.prototype.compare = function (base, opts, cb) {
  if (isFunction(opts)) {
    cb = opts;
    opts = {};
  }
  var id = this.id();
  if (!isString(base) || base.length === 0) {
    return cb(new TypeError('base is required'));
  }
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    404: false
  };
  var newPath = this.urlPath.replace(/commits$/, 'compare');
  var comparePath = path.join(newPath, base + '...' + id);
  return this.client.get(comparePath, opts, cb);
};

Commit.prototype.commitOffset = function (base, cb) {
  var commit = this;
  commit.compare(base, {}, function (err, diff) {
    if (err) { return cb(err); }
    else {
      // diff.status;
      // diff.ahead_by;
      // diff.behind_by;
      cb(null, diff);
    }
  });
};
