'use strict';

var util = require('util');
var Base = require('../base');
var exists = require('101/exists');

module.exports = Branch;

function Branch () {
  Base.apply(this, arguments);
}

util.inherits(Branch, Base);

Branch.prototype.idAttribute = 'name';

// FIXME: model should not avoid calling parse when
// only given an id.. remove the constructor edgecase
// always call parse when attrs are being set including id
Branch.prototype.id = function (id) {
  var idSetForFirstTime =  exists(id) && !exists(this.id());
  var ret = Base.prototype.id.apply(this, arguments);
  if (idSetForFirstTime) {
    this.setupChildren();
  }
  return ret;
};

Branch.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  var id = attrs[this.idAttribute];
  if (exists(id)) {
    this.id(id); // id must be set before setting up children
  }
  return attrs;
};

Branch.prototype.setupChildren = function () {
  if (this.id()) {
    this.commits = this.commits ||
      this.opts.repo.newCommits([], { qs: {
        sha: this.id()
      }, reset: false });
  }
};

Branch.prototype.urlPath = 'branches';
