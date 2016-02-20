'use strict';

var util = require('util');
var BaseGithubRepo = require('../base-github-repo');

module.exports = Repo;

function Repo (attrs, opts) {
  var parentPath = opts.parentPath;
  delete opts.parentPath;
  opts.ownername = parentPath.split('/')[3];
  BaseGithubRepo.apply(this, arguments);
}

util.inherits(Repo, BaseGithubRepo);

Repo.prototype.urlPath = 'repos';
