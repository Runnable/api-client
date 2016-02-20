'use strict';

var Base = require('../base-fs-list');
var util = require('util');
module.exports = FsList;
function FsList () {
  Base.apply(this, arguments);
}
util.inherits(FsList, Base);
FsList.prototype.urlPath = 'files';
FsList.prototype.FileModel = require('../../models/debug-container/file');
FsList.prototype.DirModel  = require('../../models/debug-container/dir');
