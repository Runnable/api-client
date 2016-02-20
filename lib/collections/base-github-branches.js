'use strict';

var Base = require('./base');
var util = require('util');

module.exports = BaseGithubBranches;

function BaseGithubBranches() {
  Base.apply(this, arguments);
}

util.inherits(BaseGithubBranches, Base);

BaseGithubBranches.prototype.urlPath = 'branches';
