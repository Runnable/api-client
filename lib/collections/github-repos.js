'use strict';

var Base = require('./base-github-repos');
var util = require('util');
module.exports = GithubRepos;

function GithubRepos () {
  Base.apply(this, arguments);
}

util.inherits(GithubRepos, Base);

GithubRepos.prototype.query = function (qs) {
  if (arguments.length === 1){
    qs = qs || {};
    qs.type = 'owner';
  }
  return Base.prototype.query.apply(this, arguments);
};

GithubRepos.prototype.urlPath = 'github/user/repos';

GithubRepos.prototype.Model = require('../models/github-repo');
