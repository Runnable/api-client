'use strict';

var BaseFsList = require('../../base-fs-list');
var util = require('util');
module.exports = FsList;
function FsList () {
  BaseFsList.apply(this, arguments);
}
util.inherits(FsList, BaseFsList);
FsList.prototype.urlPath = 'files';
FsList.prototype.FileModel = require('../../../models/context/version/file');
FsList.prototype.DirModel = require('../../../models/context/version/dir');