/* global WebSocket */
module.exports = Socket

function Socket (options) {
  this._options = options
  this._messageQueue = []
  this._connectedOnce = false
  this._attemptNum = 0
  this._url = getWebSocketURL(options)

  this._createWebSocket()
}

Socket.prototype._createWebSocket = function () {
  this._type = 'websocket'
  this._socket = new WebSocket(this._url)

  this.open = this._createWebSocket.bind(this)
  this._syncState()

  this._socket.onmessage = this._ws_onmessage.bind(this)
  this._socket.onopen = this._ws_onopen.bind(this)
  this._socket.onclose = this._ws_onclose.bind(this)
}

Socket.prototype._ws_onmessage = function (message) {
  this._syncState()
  this.onmessage && this.onmessage(message)
}

Socket.prototype._ws_onopen = function (event) {
  this._attemptNum = 0
  this._connectedOnce = true

  this._syncState()
  this._flushQueue()

  this.onopen && this.onopen(event)
}

Socket.prototype._ws_onclose = function (event) {
  this._syncState()
  console.log('WebSocket: connection is broken', event)

  this.onclose && this.onclose(event)

  const socket = this

  if (this._options.reconnect && !event.wasClean) {
    setTimeout(function () {
      if (socket.readyState === socket.CLOSED) {
        socket._createWebSocket()
      }
    }, this._getTimeout())
  }
  this._attemptNum++
}

Socket.prototype._getTimeout = function () {
  const base = this._options.timeout
  const increment = this._options.timeoutIncrement * this._attemptNum
  const maxTimeout = base + increment
  return getRandom(maxTimeout / 3, maxTimeout)
}

Socket.prototype._flushQueue = function () {
  while (this._messageQueue.length !== 0) {
    const data = this._messageQueue.shift()
    this._send(data)
  }
}

Socket.prototype._send = function (data) {
  if (typeof data !== 'string') data = JSON.stringify(data)

  this._socket.send(data)
}

Socket.prototype.send = function (data) {
  if (this._socket.readyState === WebSocket.OPEN && this._messageQueue.length === 0) {
    this._send(data)
  } else {
    this._messageQueue.push(data)
  }
}

Socket.prototype.close = function () {
  this._socket.close()
}

Socket.prototype._syncState = function () {
  this.readyState = this._socket.readyState
}

Socket.prototype.reconnect = function () {
  if (this.readyState === this.CLOSED) {
    this._createWebSocket()
  }
}

// ShareJS constants
Socket.prototype.canSendWhileConnecting = true
Socket.prototype.canSendJSON = true

// WebSocket constants
Socket.prototype.CONNECTING = 0
Socket.prototype.OPEN = 1
Socket.prototype.CLOSING = 2
Socket.prototype.CLOSED = 3

function getRandom (min, max) {
  return Math.random() * (max - min) + min
}

function getWebSocketURL (options) {
  let port = typeof window !== 'undefined' && window.location && window.location.port
  let host = typeof window !== 'undefined' && window.location && window.location.hostname
  let protocol = typeof window !== 'undefined' && window.location && window.location.protocol

  host = options.srvHost || host
  protocol = options.srvProtocol || protocol

  if (protocol === 'https:' || protocol === 'wss:') {
    protocol = 'wss:'
    port = options.srvSecurePort || options.srvPort || port
  } else {
    protocol = 'ws:'
    port = options.srvPort || port
  }

  return protocol + '//' + host + (port ? ':' + port : '') + options.base
}

// Maybe need to use reconnection timing algorithm from
// http://blog.johnryding.com/post/78544969349/how-to-reconnect-web-sockets-in-a-realtime-web-app
