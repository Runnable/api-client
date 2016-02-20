'use strict';

console.warn = console.warn || console.log;

module.exports = warn;

function warn (/* args */) {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('(runnable-api-client) warning:');
  var msg = args.join(' ');
  console.warn.call(console, msg);
  console.warn(new Error('warning trace').stack.replace(/Error.*\n/, ''));
}