var User = require('../index');
var expect = require('chai').expect;

describe('app-code-versions', function() {
  describe('org-repos', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User({
        accounts: {
          github: {
            username: 'cflynn07'
          }
        }
      });
      ctx.appCodeVersion =
        user.newContext('123456789012345678901234')
          .newVersion('123456789012345678901233')
          .newAppCodeVersion({
           _id: '123456789012345678901232',
           repo: 'codenow/101'
          });
      done();
    });

    it('should return correct githubRepo model', function (done) {
      expect(ctx.appCodeVersion.githubRepo.path()).to
        .equal('github/repos/codenow/101');
      done();
    });
  });

  describe('user-repos', function() {
    var ctx = {};
    beforeEach(function (done) {
      var user = new User({
        accounts: {
          github: {
            username: 'cflynn07'
          }
        }
      });
      ctx.appCodeVersion =
        user.newContext('123456789012345678901234')
          .newVersion('123456789012345678901233')
          .newAppCodeVersion({
            _id: '123456789012345678901232',
            repo: 'cflynn07/101'
          });
      done();
    });

    it('should return correct githubRepo model', function (done) {
      expect(ctx.appCodeVersion.githubRepo.path()).to
        .equal('github/repos/cflynn07/101');
      done();
    });
  });

});

