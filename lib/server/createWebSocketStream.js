var Duplex = require('stream').Duplex;
var util = require('util');
var WebSocket = require('ws');

module.exports = createWebSocketStream;

/**
 * @param {EventEmitters} client is a browserchannel client session for a given
 * browser window/tab that is has a connection
 * @return {Duplex} stream
 */
function createWebSocketStream(client) {
  var stream = new ClientStream(client);

  client.on('message', function onMessage(data) {
    stream.push(data);
  });

  client.on('close', function() {
    // Signal data writing is complete. Emits the 'end' event
    stream.push(null);
  });

  return stream;
}

function ClientStream(client) {
  Duplex.call(this, {objectMode: true});

  this.client = client;

  var self = this;

  this.on('error', function(error) {
    console.warn('BrowserChannel client message stream error', error);
    self._stopClient();
  });

  // The server ended the writable stream. Triggered by calling stream.end()
  // in agent.close()
  this.on('finish', function() {
    self._stopClient();
  });
}
util.inherits(ClientStream, Duplex);

ClientStream.prototype._read = function() {};

ClientStream.prototype._write = function(chunk, encoding, callback) {
  // Silently drop messages after the session is closed
  if (this.client.readyState !== WebSocket.OPEN) return callback();
  this.client.send(JSON.stringify(chunk), function(err){
    if (err) console.error('[racer-highway] send:', err);
  });
  callback();
};

ClientStream.prototype._stopClient = function() {
  var client = this.client;
  client.stop(function() {
    client.close();
  });
};