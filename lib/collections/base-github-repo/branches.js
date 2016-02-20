'use strict';

var Base = require('../base-github');
var util = require('util');

module.exports = Branches;

function Branches () {
  Base.apply(this, arguments);
}

util.inherits(Branches, Base);

Branches.prototype.Model =
  require('../../models/base-github-repo/branch');

Branches.prototype.urlPath = 'branches';