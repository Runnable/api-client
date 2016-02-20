var expect = require('chai').expect;
var noop = require('101/noop');
var last = require('101/last');
var put = require('101/put');
var User = require('../lib/models/user');
var Instance = require('../lib/models/instance');
var ContextVersion = require('../lib/models/context/version');
var modelStore = require('../lib/stores/model-store');
var collectionStore = require('../lib/stores/collection-store');
var keypather = require('keypather')();
var sinon = require('sinon');

var mockClient = {
  post: noop,
  patch: noop,
  del: noop
};
var userContentDomain = 'runnableapp.com';
var modelOpts = {
  client: mockClient,
  userContentDomain: userContentDomain
};

describe('ContextVersion', function () {

  describe('MainAppCodeVersion getter', function () {
    var githubUsername = 'tjmehta';
    var branchName = 'branch-name';
    var repoName = 'repo-name';
    var contextVersion;
    beforeEach(function (done) {
      contextVersion = new ContextVersion({
        _id: 1,
        context: '1234',
        appCodeVersions: [{
          _id: 3,
          additionalRepo: true,
          repo: githubUsername + '/' + repoName + '2',
          branch: branchName + '2'
        }, {
          _id: 2,
          additionalRepo: false,
          repo: githubUsername + '/' + repoName,
          branch: branchName
        }]
      }, modelOpts);

      done();
    });

    it('should return the main branch (2nd one)', function () {
      expect(contextVersion.getMainAppCodeVersion().attrs.branch).to.equal(branchName);
    });

    it('should return the main repo name', function () {
      expect(contextVersion.getMainAppCodeVersion().attrs.repo).to.equal(githubUsername + '/' + repoName);
    });
  });
});