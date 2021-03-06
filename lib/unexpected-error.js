var util = require('util');
var Boom = require('boom');

var UnexpectedError = module.exports = function () {
  return UnexpectedError.create.apply(this, arguments);
};

UnexpectedError.create = function (res, body) {
  var defaultMessage = UnexpectedError.defaultMessage;
  var err = Boom.create(res.statusCode, body ? body.message || defaultMessage : defaultMessage, { res: res });
  err.isUnexpected = true;
  return err;
};

UnexpectedError.defaultMessage = 'An unknown error occurred';