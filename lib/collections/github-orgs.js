'use strict';

var Base = require('./base-github');
var util = require('util');
module.exports = GithubOrgs;

function GithubOrgs () {
  Base.apply(this, arguments);
}

util.inherits(GithubOrgs, Base);

GithubOrgs.prototype.urlPath = 'github/user/orgs';

GithubOrgs.prototype.Model = require('../models/github-org');
