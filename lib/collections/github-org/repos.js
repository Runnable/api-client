'use strict';

var Base = require('../base-github-repos');
var util = require('util');
module.exports = Repos;

function Repos (attrs, opts) {
  opts.parentPath = opts.parentPath.replace('user/', '');
  Base.apply(this, arguments);
}

util.inherits(Repos, Base);

Repos.prototype.urlPath = 'repos';

Repos.prototype.Model = require('../../models/github-org/repo');
