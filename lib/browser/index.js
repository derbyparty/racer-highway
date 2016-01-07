var racer = require('racer');
var Socket = require('./socket');


module.exports = function( racer, CLIENT_OPTIONS ){
  racer.Model.prototype._createSocket = function( bundle ) {
    return new Socket( CLIENT_OPTIONS );
  };
}
