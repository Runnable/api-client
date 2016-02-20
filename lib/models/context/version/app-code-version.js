'use strict';

var util = require('util');
var Base = require('../../base');
var exists = require('101/exists');
var keypather = require('keypather')();
var path = require('path');

module.exports = AppCodeVersion;

function AppCodeVersion (/* attrs, opts */) {
  return Base.apply(this, arguments);
}

util.inherits(AppCodeVersion, Base);

AppCodeVersion.prototype.parse = function (attrs) {
  attrs = Base.prototype.parse.call(this, attrs); // always call base parse for loopback toJSON
  this.setupChildren(attrs);
  return attrs;
};

AppCodeVersion.prototype.setupChildren = function (attrs) {
  var id = attrs[this.idAttribute];
  if (!this.id() && exists(id)) {
    this.id(id); // id needs to be set before any factory method is used
  }
  if (attrs.repo) {
    if (!this.githubRepo) {
      this.initGithubRepo(attrs);
    }
  }
};

AppCodeVersion.prototype.urlPath = 'appCodeVersions';

AppCodeVersion.prototype.initGithubRepo = function (attrs) {
  var split = attrs.repo.split('/');
  var ownerName = split[0];
  var repoName = split[1];
  var repo;

  // in serverside (loopback) model the user attrs are not completely set so the
  // following check must be made else it will error
  if (keypather.get(this.opts.user, 'attrs.accounts.github.username.toLowerCase()')) {
    if (ownerName.toLowerCase() === this.opts.user.attrs.accounts.github.username.toLowerCase()) {
      repo = this.opts.user.newGithubRepo(repoName, {
        ownername: ownerName
      });
    } else {
      repo = this.opts.user.newGithubOrg(ownerName).newRepo(repoName, {
        ownername: ownerName
      });
    }
  }
  this.githubRepo = repo;
};

/**
 * Saves transform rules to an appCodeVersion.
 * @example
 * appCodeVersion.setTransformRules({
 *   // Global file excludes:
 *   exclude: ['fileA.txt', 'npm_modules/'],
 *
 *   // Search and Replace
 *   replace: [
 *     { action: 'replace', search: 'hello', replace: 'goodbye' }
 *   ],
 *
 *   // File renames
 *   rename: [
 *     { action: 'rename', source: 'B.txt', dest: 'sub/D.txt' }
 *   ]
 * }, function (err) {
 *   // `err` will be set if there was a problem.
 * });
 *
 * @param {object} rules Rules to set for the appCodeVersion.
 * @param {function} cb Callback to execute after the rules have been saved.
 */
AppCodeVersion.prototype.setTransformRules = function (rules, cb) {
  this.update({ transformRules: rules }, cb);
};

/**
 * Runs transform rules via optimus and returns the results.
 * @param {function} cb Callback to execute with the results of the transform
 *   rules currently saved on the appCodeVersion.
 */
AppCodeVersion.prototype.runTransformRules = function (cb) {
  var opts = {
    json: true,
    statusCodes: {
      200: true,
      304: false,
      401: false,
      404: false,
      409: false
    }
  };
  var runPath = path.join(this.path(), 'actions', 'applyTransformRules');
  return this.client.post(runPath, opts, cb);
};

/**
 * Given a new rule not currently saved on the appCodeVersion this will yield
 * the results of a transform with the new rule in place. Conceptually one can
 * think of this as appending (but not saving) a new rule to the rule set and
 * then testing the transform rules.
 * @param {object} rule New rule to test.
 * @param {function} cb Callback to execute once the rules have been tested.
 */
AppCodeVersion.prototype.testTransformRule = function (rule, cb) {
  var opts = {
    json: true,
    body: rule,
    statusCodes: {
      200: true,
      304: false,
      401: false,
      404: false,
      409: false
    }
  };
  var testPath = path.join(this.path(), 'actions', 'testTransformRule');
  return this.client.post(testPath, opts, cb);
};
