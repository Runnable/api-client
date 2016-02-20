'use strict';

var Base = require('../../base');
var util = require('util');
var findIndex = require('101/find-index');
var hasProps = require('101/has-properties');

module.exports = AppCodeVersions;

function AppCodeVersions () {
  Base.apply(this, arguments);
}

util.inherits(AppCodeVersions, Base);

AppCodeVersions.prototype.urlPath = 'appCodeVersions';

AppCodeVersions.prototype.Model = require('../../../models/context/version/app-code-version');

AppCodeVersions.prototype.containsRepo = function (repo) {
  return ~findIndex(this.models, hasProps({ repo: repo }));
};