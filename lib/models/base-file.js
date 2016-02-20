'use strict';

var BaseFs = require('./base-fs');
var util = require('util');
var isString = require('101/is-string');
var intercept = require('../intercept');

module.exports = BaseFile;

function BaseFile() {
  BaseFs.apply(this, arguments);
  this.useETags = true;
}

util.inherits(BaseFile, BaseFs);

BaseFile.prototype.update = function (id, opts, cb) {
  var args = this.formatArgs(arguments);
  id = args.id;
  opts = args.opts;
  opts = opts.json || opts.body || opts.qs || opts.headers ?
    opts : { json: opts }; // assume opts are json if no json/body/qs key
  cb = args.cb;
  if (!isString(id) || id.length === 0) {
    return cb(new TypeError('id is required'));
  }
  opts.statusCodes = opts.statusCodes || {
    200: true,
    400: false,
    401: false,
    404: false,
    409: false
  };
  var self = this;
  var lastAttrs = this.attrs;
  if (opts.put) {
    this.reset(opts.json);
  }
  else {
    this.extend(opts.json);
  }
  return this.client[opts.put ? 'put' : 'patch'](this.path(id), opts, intercept(revert, function (body, code) {
    self.extend(body);
    cb(null, body, code);
  }));
  function revert (err) {
    self.reset(lastAttrs);
    cb(err);
  }
};