'use strict';

var Base = require('../base-github');
var util = require('util');
module.exports = Commits;

function Commits () {
  Base.apply(this, arguments);
}

util.inherits(Commits, Base);
Commits.prototype.urlPath = 'commits';
Commits.prototype.Model = require('../../models/base-github-repo/commit');
