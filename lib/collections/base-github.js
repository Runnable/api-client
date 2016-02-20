'use strict';

var Base = require('./base');
var util = require('util');

module.exports = BaseGithub;

function BaseGithub () {
  Base.apply(this, arguments);
}

util.inherits(BaseGithub, Base);

BaseGithub.prototype.query = function (qs) {
  if (arguments.length === 1){
    qs = qs || {};
    qs.per_page = 100;
  }
  return Base.prototype.query.apply(this, arguments);
};
