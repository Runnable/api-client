'use strict';

var BaseFs = require('./base-fs');
var util = require('util');
var modelStore = require('../stores/model-store');
module.exports = BaseDir;

function BaseDir() {
  BaseFs.apply(this, arguments);
  if (!this.FsList) {
    throw new Error('Dirs are expected to have an FsList Class');
  }
  this.contents = new this.FsList([], {
    qs: { path: this.id() },
    parentPath: this.opts.parentPath,
    client: this.opts.client,
    user: this.opts.user
  });
}

util.inherits(BaseDir, BaseFs);

BaseDir.prototype.setNewPath = function (newPath) {
  var dir = this;
  modelStore.remove(dir);
  dir.attrs.path = newPath;
  modelStore.add(dir);
  dir.contents.setNewQuery({ path: dir.id() });
};

BaseDir.prototype.setNewName = function (newName) {
  var dir = this;
  modelStore.remove(dir);
  dir.attrs.name = newName;
  modelStore.add(dir);
  dir.contents.setNewQuery({ path: dir.id() });
};