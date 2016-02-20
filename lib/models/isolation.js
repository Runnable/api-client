'use strict';

var util = require('util');
var Base = require('./base');

module.exports = Isolation;

function Isolation () {
  return Base.apply(this, arguments);
}

util.inherits(Isolation, Base);

require('../extend-with-factories')(Isolation);

Isolation.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  if (this.id()) {
    var qs = {
      isIsolationGroupMaster: false,
      isolated: this.id(),
      githubUsername: attrs.ownerUsername
    };
    this.instances = this.user.newInstances([], {
      qs: qs,
      reset: false
    });
  }
  return attrs;
};

Isolation.prototype.urlPath = 'isolations';
