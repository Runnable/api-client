'use strict';

var Base = require('./base');
var util = require('util');
var path = require('path');
var exists = require('101/exists');
var modelStore = require('../stores/model-store');
var find = require('101/find');
var hasKeypaths = require('101/has-keypaths');

module.exports = BaseFs;

function BaseFs() {
  Base.apply(this, arguments);
}
util.inherits(BaseFs, Base);

BaseFs.prototype.id = function (filepath) {
  if (exists(filepath)) {
      // setter
    this.attrs.path = path.dirname(filepath);
    this.attrs.name = path.basename(filepath);
    if (this.attrs.name === '') {
      this.attrs.name = '/';
      this.attrs.path = '';
    }
  }
  return this.filepath();
};

BaseFs.prototype.filepath = function () {
  if (!exists(this.attrs.path)) {
    return;
  }
  else if (!exists(this.attrs.name)) {
    return;
  }
  else if (this.attrs.isDir) {
    return path.join(this.attrs.path, this.attrs.name, '/');
  }
  else { // when assuming success, with create we must to string the values
    return path.join(this.attrs.path+'', this.attrs.name+'');
  }
};

BaseFs.prototype.isRootDir = function () {
  return this.isDir() && this.id() === '/';
};

BaseFs.prototype.isDir = function () {
  return this.attrs.isDir;
};

BaseFs.prototype.destroy = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  cb = args.cb;
  opts.json = this.json();
  return Base.prototype.destroy.call(this, id, opts, cb);
};

BaseFs.prototype.urlPath = 'files';

BaseFs.prototype.moveToDir = function (dir, cb) {
  var fs = this;
  var oldId = fs.id();
  var oldPath = fs.attrs.path;
  var oldDirContents = fs.fsList;
  var newPath = dir.id();
  assumeSuccess();
  fs.update(oldId, { path: newPath }, function (err) {
    if (err) { revertOnFailure(); }
    cb.apply(null, arguments);
  });
  function assumeSuccess () {
    if (oldDirContents) {
      oldDirContents.remove(fs);
    }
    fs.setNewPath(newPath);
    dir.contents.add(fs);
  }
  function revertOnFailure () {
    dir.contents.remove(fs);
    fs.setNewPath(oldPath);
    if (oldDirContents) {
      oldDirContents.add(fs);
    }
  }
};

BaseFs.prototype.rename = function (newName, cb) {
  // slash is an invalid char
  if (newName.indexOf('/') > -1) {
    return cb(new Error('Filename cannot contain /'));
  }
  var fs = this;
  var oldId = fs.id();
  assumeSuccess();
  fs.update(oldId, { name: newName, isDir: this.isDir() }, function (err) {
    if (err) { revertOnFailure(); }
    cb.apply(null, arguments);
  });
  var oldName;
  function assumeSuccess () {
    oldName = fs.attrs.name;
    fs.setNewName(newName);
  }
  function revertOnFailure () {
    fs.setNewName(oldName);
  }
};

BaseFs.prototype.setNewPath = function (newPath) {
  var fs = this;
  modelStore.remove(fs);
  fs.attrs.path = newPath;
  modelStore.add(fs);
};

BaseFs.prototype.setNewName = function (newName) {
  var fs = this;
  modelStore.remove(fs);
  fs.attrs.name = newName;
  modelStore.add(fs);
};
