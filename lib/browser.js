var racer = require('racer');
var BCSocket = require('browserchannel/dist/bcsocket-uncompressed').BCSocket;

var CLIENT_OPTIONS = JSON.parse('{{clientOptions}}');

racer.Model.prototype._createSocket = function(bundle) {
  return new Socket(CLIENT_OPTIONS);
};

// Options:

// base               - string  - base url part ('/channel' by default)
// browserChannelOnly - boolean - don't use websockets (false by default)
// srvPort            - number  - port for http (undefined by default)
// srvSecurePort      - number  - port for https (undefined by default)
// timeout            - number  - base timeout for reconnection (10000 ms by default)
// timeoutIncrement   - number  - additional part of timeout (add every
//                                new attempt - 10000 ms by default)

function Socket(options) {
  this._options = options;
  this._messageQueue = [];
  this._connectedOnce = false;
  this._attemptNum = 0;
  this._url = getWebSocketURL(options.base, options.srvPort, options.srvSecurePort);

  if (supportWebSockets() && !options.browserChannelOnly) {
    this._createWebSocket();
  } else {
    this._createBrowserChannel();
  }
}

Socket.prototype._createWebSocket = function() {

  this._type = 'websocket';
  this._socket = new WebSocket(this._url);

  this.open = this._createWebSocket.bind(this);
  this._syncState();

  this._socket.onmessage = this._ws_onmessage.bind(this);
  this._socket.onopen = this._ws_onopen.bind(this);
  this._socket.onclose = this._ws_onclose.bind(this);
  
};

Socket.prototype._createBrowserChannel = function() {
  this._type = 'browserchannel';
  this._socket = BCSocket(this._options.base, this._options);

  this.open = this._createBrowserChannel.bind(this);
  this._syncState();

  this._socket.onmessage = this._bc_onmessage.bind(this);
  this._socket.onopen = this._bc_onopen.bind(this);
  this._socket.onclose = this._bc_onclose.bind(this);
};

Socket.prototype._ws_onmessage = function(message) {
  this._syncState();
  message.data = JSON.parse(message.data);
  this.onmessage && this.onmessage(message);
};

Socket.prototype._ws_onopen = function(event) {
  this._attemptNum = 0;
  this._connectedOnce = true;

  this._syncState();
  this._flushQueue();

  this.onopen && this.onopen(event);
};

Socket.prototype._ws_onclose = function(event) {
  this._syncState();
  console.log('WebSocket: connection is broken', event);
  
  this.onclose && this.onclose(event);

  if (!this._connectedOnce) {
    return this._createBrowserChannel();
  }

  if (this._options.reconnect && !event.wasClean) {
    setTimeout(this._createWebSocket.bind(this), this._getTimeout());
  }
  this._attemptNum++;
};

Socket.prototype._getTimeout = function(){
  var base = (this._options.timeout || 10000);
  var increment = (this._options.timeoutIncrement || 10000) * this._attemptNum;
  return  base + increment;
};

Socket.prototype._bc_onmessage = function(data) {
  this._syncState();
  this.onmessage && this.onmessage(data);
};

Socket.prototype._bc_onopen = function(event) {
  this._syncState();
  this.onopen && this.onopen(event);
};

Socket.prototype._bc_onclose = function(event) {
  this._syncState();
  this.onclose && this.onclose(event);
};

Socket.prototype._flushQueue = function(){
  while (this._messageQueue.length !== 0) {
    var data = this._messageQueue.shift();
    this._send(data);
  }
};

Socket.prototype._send = function(data){
  if (this._type === 'websocket' && (typeof data !== 'string')) data = JSON.stringify(data);

  this._socket.send(data);
};

Socket.prototype.send = function(data){
  if (this._type === 'websocket') {
    if (this._socket.readyState === WebSocket.OPEN && this._messageQueue.length === 0) {
      this._send(data);
    } else {
      this._messageQueue.push(data);
    }
  } else {
    this._send(data);
  }
};

Socket.prototype.close = function(){
  this._socket.close();
};

Socket.prototype._syncState = function(){
  this.readyState = this._socket.readyState;
};

// ShareJS constants
Socket.prototype.canSendWhileConnecting = true;
Socket.prototype.canSendJSON = true;

// WebSocket constants
Socket.prototype.CONNECTING = 0;
Socket.prototype.OPEN = 1;
Socket.prototype.CLOSING = 2;
Socket.prototype.CLOSED = 3;

function supportWebSockets(){
  // The condition is from Modernizr
  // https://github.com/Modernizr/Modernizr/blob/master/feature-detects/websockets.js#L28
  return 'WebSocket' in window && window.WebSocket.CLOSING === 2;
}

function getWebSocketURL(base, srvPort, srvSecurePort){
  var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:', port;

  if (protocol === 'ws:' && srvPort) {
    port = ":" + srvPort;
  } else if (protocol === 'wss:' && srvSecurePort) {
    port = ":" + srvSecurePort;
  }
  return protocol + '//' + window.location.host + (port || "") + base;
}

// Maybe need to use reconnection timing algorithm from
// http://blog.johnryding.com/post/78544969349/how-to-reconnect-web-sockets-in-a-realtime-web-app


