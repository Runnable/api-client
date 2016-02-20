'use strict';

var Base = require('../base');
var util = require('util');
module.exports = Containers;

function Containers () {
  Base.apply(this, arguments);
  // this.rootDir = this.newDir('/', {
  //   parentModel: this
  // });
}

util.inherits(Containers, Base);
require('../../extend-with-factories')(Containers, 'instance/container');

Containers.prototype.urlPath = 'containers';

Containers.prototype.Model = require('../../models/instance/container');