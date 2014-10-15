var racer = require('racer');
var BCSocket = require('browserchannel/dist/bcsocket-uncompressed').BCSocket;

var CLIENT_OPTIONS = JSON.parse('{{clientOptions}}');

racer.Model.prototype._createSocket = function(bundle) {
  return new Socket(CLIENT_OPTIONS);
};

function Socket(options) {
  var self = this;

  self.options = options;
  self.messageQueue = [];
  self.connectedOnce = false;
  self.attemptNum = 0;
  self.url = getWebSocketURL(options);

  if (supportWebSockets() && !options.browserChannelOnly) {
    self._createWebSocket();
  } else {
    self._createBrowserChannel();
  }
}

Socket.prototype._createWebSocket = function() {

  this.type = 'websocket';
  this.open = this._createWebSocket.bind(this);

  this.socket = new WebSocket(this.url);
  this.readyState = 0;

  this.socket.onmessage = this._ws_onmessage.bind(this);
  this.socket.onopen = this._ws_onopen.bind(this);
  this.socket.onclose = this._ws_onclose.bind(this);
  
};

Socket.prototype._createBrowserChannel = function() {
  this.type = 'browserchannel';
  this.open = this._createBrowserChannel.bind(this);

  this.socket = BCSocket(this.options.base, this.options);
  this.readyState = 0;

  this.socket.onmessage = this._bc_onmessage.bind(this);
  this.socket.onopen = this._bc_onopen.bind(this);
  this.socket.onclose = this._bc_onclose.bind(this);
};

Socket.prototype._ws_onmessage = function(message) {
  this.readyState = this.socket.readyState;
  message.data = JSON.parse(message.data);
  this.onmessage && this.onmessage(message);
};

Socket.prototype._ws_onopen = function(event) {
  this.attemptNum = 0;

  this.readyState = this.socket.readyState;
  this.connectedOnce = true;

  this._flushQueue();
  this.onopen && this.onopen(event);
};

Socket.prototype._ws_onclose = function(event) {
  var self = this;
  self.readyState = self.socket.readyState;
  console.log('WebSocket: connection is broken', event);
  self.onclose && self.onclose(event);

  if (!self.connectedOnce) {
    return self._createBrowserChannel();
  }

  if (self.options.reconnect && !event.wasClean) {
    setTimeout(self._createWebSocket.bind(self), getTimeout());
  }
  self.attemptNum++;

  function getTimeout(){
    var base = (self.options.timeout || 10000);
    var increment = (self.options.timeoutIncrement || 10000) * self.attemptNum;
    return  base + increment;
  }
};

Socket.prototype._bc_onmessage = function(data) {
  this.readyState = this.socket.readyState;
  this.onmessage && this.onmessage(data);
};

Socket.prototype._bc_onopen = function(event) {
  this.readyState = this.socket.readyState;
  this.onopen && this.onopen(event);
};

Socket.prototype._bc_onclose = function(event) {
  self.readyState = self.socket.readyState;
  self.onclose && self.onclose(event);
};

Socket.prototype._flushQueue = function(){
  while (this.messageQueue.length !== 0) {
    var data = this.messageQueue.shift();
    this._send(data);
  }
};

Socket.prototype._send = function(data){
  if (this.type === 'websocket' && (typeof data !== 'string')) data = JSON.stringify(data);

  this.socket.send(data);
};

Socket.prototype.send = function(data){
  if (this.type === 'websocket') {
    if (this.socket.readyState === WebSocket.OPEN && this.messageQueue.length === 0) {
      this._send(data);
    } else {
      this.messageQueue.push(data);
    }
  } else {
    this._send(data);
  }
};

Socket.prototype.close = function(){
  this.socket.close()
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

function getWebSocketURL(options){
  var protocol  = window.location.protocol === 'https:' ? 'wss:' : 'ws:',
      port      = null;

  if (protocol === 'ws:' && options.srvPort) {
    port = ":" + options.srvPort;
  } else if (protocol === 'wss:' && options.srvSecurePort) {
    port = ":" + options.srvSecurePort;
  }
  return protocol + '//' + window.location.host + (port || "") + options.base;
}

// Maybe need to use reconnection timing algorithm from
// http://blog.johnryding.com/post/78544969349/how-to-reconnect-web-sockets-in-a-realtime-web-app


