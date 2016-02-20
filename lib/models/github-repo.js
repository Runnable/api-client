'use strict';

var util = require('util');
var BaseGithubRepo = require('./base-github-repo');

module.exports = GithubRepo;

function GithubRepo (attrs, opts) {
  BaseGithubRepo.call(this, attrs, opts);
  this.opts.ownername = this.opts.user.attrs.accounts.github.username;
}

util.inherits(GithubRepo, BaseGithubRepo);
