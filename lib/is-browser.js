'use strict';

var isBrowser = typeof window !== 'undefined' ||
  process.env.NODE_ENV === 'browser' ||
  process.env.NODE_ENV === 'browser-test';

module.exports = isBrowser;