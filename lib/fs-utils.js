'use strict';

var fs = require('fs');
var path = require('path');

module.exports = {
  isFile: isFile,
  isDir: isDir,
  fullPath: fullPath,
  isNotDotFile: isNotDotFile
};

function fullPath (dirpath) {
  return function (filename) {
    return path.join(dirpath, filename);
  };
}
function isFile (filepath) {
  try {
    return fs.statSync(filepath).isFile();
  }
  catch (err) {
    return false;
  }
}
function isDir (filepath) {
  try {
    return fs.statSync(filepath).isDirectory();
  }
  catch (err) {
    return false;
  }
}
function isNotDotFile (filename) {
  return filename[0] !== '.';
}