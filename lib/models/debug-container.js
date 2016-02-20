'use strict';

var util = require('util');
var exists = require('101/exists');
var Base = require('./base');

module.exports = DebugContainer;

function DebugContainer () {
  return Base.apply(this, arguments);
}

util.inherits(DebugContainer, Base);

DebugContainer.prototype.id = function (id) {
  var idVal = Base.prototype.id.apply(this, arguments);
  if (exists(id)) {
    this.rootDir = this.newDir('/');
  }
  return idVal;
};

require('../extend-with-factories')(DebugContainer, 'debug-container');

DebugContainer.prototype.urlPath = 'debug-containers';
