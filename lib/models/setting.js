'use strict';

var util = require('util');
var Base = require('./base');

module.exports = Setting;

function Setting () {
  return Base.apply(this, arguments);
}

util.inherits(Setting, Base);

require('../extend-with-factories')(Setting);

Setting.prototype.urlPath = 'settings';
