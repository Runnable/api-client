'use strict';

var util = require('util');
var Base = require('./base');
var keypather = require('keypather')();

module.exports = GithubOrg;

function GithubOrg () {
  Base.apply(this, arguments);
}

util.inherits(GithubOrg, Base);

GithubOrg.prototype.urlPath = 'github/user/orgs';

GithubOrg.prototype.idAttribute = 'login';

GithubOrg.prototype.gravitar = function () {
  return this.attrs.avatar_url;
};

GithubOrg.prototype.oauthName = function () {
  return this.attrs.login;
};

GithubOrg.prototype.oauthId = function () {
  return keypather.get(this, 'attrs.id');
};

require('../extend-with-factories')(GithubOrg, 'github-org');
