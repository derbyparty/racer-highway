var racer = require('racer');
var extend = require('extend');
var Socket = require('./socket');
var CLIENT_OPTIONS = JSON.parse('{{clientOptions}}');

var overrideOptions = {};

racer.overrideClientOptions = function(options) {
  overrideOptions = options;
};

racer.Model.prototype._createSocket = function(bundle) {
  return new Socket(extend({}, CLIENT_OPTIONS, overrideOptions));
};

