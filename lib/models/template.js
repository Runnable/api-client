'use strict';

var util = require('util');
var Base = require('./base');

module.exports = Template;

function Template () {
  return Base.apply(this, arguments);
}

util.inherits(Template, Base);

require('../extend-with-factories')(Template);

Template.prototype.urlPath = 'templates';
