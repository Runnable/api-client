'use strict';

var util = require('util');
var Base = require('./base');
var path = require('path');
var exists = require('101/exists');
var keypather = require('keypather')();

module.exports = BaseGithubRepo;

function BaseGithubRepo (attrs, opts) {
  delete opts.parentPath;
  Base.apply(this, arguments);
}

util.inherits(BaseGithubRepo, Base);

require('../extend-with-factories')(BaseGithubRepo, 'base-github-repo');

var newBranch = BaseGithubRepo.prototype.newBranch;
var newBranches = BaseGithubRepo.prototype.newBranches;

BaseGithubRepo.prototype.newBranch = function (attrs, opts) {
  opts = opts || {};
  opts.repo = this;
  return newBranch.call(this, attrs, opts);
};

BaseGithubRepo.prototype.newBranches = function (models, opts) {
  opts = opts || {};
  opts.repo = this;
  opts.qs = {};
  return newBranches.call(this, models, opts);
};

BaseGithubRepo.prototype.fetchBranch = function (id) {
  var branch = this.newBranch(id);
  branch.fetch.apply(branch, arguments);
  return branch;
};

BaseGithubRepo.prototype.fetchBranches = function () {
  var branches = this.newBranches([]);
  branches.fetch.apply(branches, arguments);
  return branches;
};

// FIXME: model should not avoid calling parse when
// only given an id.. remove the constructor edgecase
// always call parse when attrs are being set including id
BaseGithubRepo.prototype.id = function (id) {
  var idSetForFirstTime =  exists(id) && !exists(this.id());
  var ret = Base.prototype.id.apply(this, arguments);
  if (idSetForFirstTime) {
    this.setupChildren();
  }
  return ret;
};

BaseGithubRepo.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  var id = attrs[this.idAttribute];
  if (exists(id)) {
    if (exists(attrs.owner)) {
      this.attrs = this.attrs || {};
      this.attrs.owner = attrs.owner; // owner must be setup before children
    }
    this.id(id); // id must be set before setting up children
  }
  return attrs;
};

BaseGithubRepo.prototype.setupChildren = function () {
  if (this.id()) {
    this.branches = this.branches || this.newBranches([], { qs: {}, reset: false, repo: this });
  }
};

BaseGithubRepo.prototype.path = function () {
  return path.join(
    BaseGithubRepo.prototype.urlPath,
    keypather.get(this, 'attrs.owner.login') || this.opts.ownername,
    this.id());
};

BaseGithubRepo.prototype.idAttribute = 'name';

BaseGithubRepo.prototype.urlPath = 'github/repos';
