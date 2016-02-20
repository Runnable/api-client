'use strict';

var Base = require('./base-github');
var util = require('util');
var modelStore = require('../stores/model-store');

module.exports = BaseGithubRepos;

function BaseGithubRepos () {
  Base.apply(this, arguments);
}

util.inherits(BaseGithubRepos, Base);

BaseGithubRepos.prototype.newModel = function (attrs) {
  var opts = this.newModelOpts();
  opts.ownername = this.opts.ownername;
  var model = new this.Model(attrs, opts);
  return modelStore.check(model);
};
