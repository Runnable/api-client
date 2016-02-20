var User = require('../index');
var expect = require('chai').expect;
var keypather = require('keypather')();

describe('github branches', function() {
  afterEach(function (done) {
    ctx = {};
    done();
  });
  describe('org branches', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User();
      ctx.repo = user
        .newGithubOrg('orgname')
        .newRepo({
          name: 'reponame',
          owner: {
            login: 'orgname'
          }
        });
      done();
    });
    it('should have the right url', function(done) {
      expect(ctx.repo.newBranch('branch').path())
        .to.equal('github/repos/orgname/reponame/branches/branch');
      done();
    });
    it('should have correct url for collection', function (done) {
      expect(ctx.repo.newBranches([], {
        qs: {}
      }).path())
        .to.equal('github/repos/orgname/reponame/branches');
      done();
    });
  });
  describe('user branches', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User();
      keypather.set(user,
        'attrs.accounts.github.username',
        'username');
      ctx.repo = user.newGithubRepo({
        name: 'reponame',
        owner: {
          login: 'username'
        }
      });
      done();
    });
    it('should have the right url', function(done) {
      expect(ctx.repo.newBranch('branch').path())
        .to.equal('github/repos/username/reponame/branches/branch');
      done();
    });
    it('should have correct url for collection', function (done) {
      expect(ctx.repo.newBranches([], {
        qs: {}
      }).path())
        .to.equal('github/repos/username/reponame/branches');
      done();
    });
  });
});
