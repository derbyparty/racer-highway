const racer = require('racer')
const Socket = require('./socket')
const CLIENT_OPTIONS = JSON.parse('{{clientOptions}}')

racer.Model.prototype._createSocket = function (bundle) {
  return new Socket(CLIENT_OPTIONS)
}
