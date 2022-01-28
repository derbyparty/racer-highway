const WebSocket = require('ws')
const WebSocketServer = WebSocket.Server
const crypto = require('crypto')
const extend = require('extend')
const createWebSocketStream = require('./createWebSocketStream')

const bundle = require('./bundle')

const defaultServerOptions = {
  session: null,
  base: '/channel',
  noPing: false,
  pingInterval: 30000
}

module.exports = function (backend, serverOptions, clientOptions) {
  serverOptions = serverOptions || {}
  serverOptions = extend({}, defaultServerOptions, serverOptions)

  // ws-module specific options
  serverOptions.path = serverOptions.base
  serverOptions.noServer = true

  // add the client side script to the Browserify bundle
  backend.on('bundle', bundle(clientOptions))

  const wss = new WebSocketServer(serverOptions)

  wss.on('connection', function (client) {
    client.id = crypto.randomBytes(16).toString('hex')

    // Some proxy drop out long connections
    // so do ping periodically to prevent this
    // interval = 30s by default
    if (!serverOptions.noPing) {
      client.timer = setInterval(function () {
        if (client.readyState === WebSocket.OPEN) {
          client.ping()
        } else {
          clearInterval(client.timer)
        }
      }, serverOptions.pingInterval)
    }

    let rejected = false
    let rejectReason

    function reject (reason) {
      rejected = true
      if (reason) rejectReason = reason
    }

    if (client.upgradeReq.session) client.connectSession = client.upgradeReq.session

    backend.emit('client', client, reject)
    if (rejected) {
      // Tell the client to stop trying to connect
      client.close(1001, rejectReason)
      return
    }

    const stream = createWebSocketStream(client)
    doneInitialization(backend, stream, client.upgradeReq)
  })

  function upgrade (req, socket, upgradeHead) {
    // copy upgradeHead to avoid retention of large slab buffers used in node core
    const head = Buffer.alloc(upgradeHead.length)
    upgradeHead.copy(head)

    if (serverOptions.session) {
      // https://github.com/expressjs/session/pull/57
      if (!req.originalUrl) req.originalUrl = req.url
      serverOptions.session(req, {}, next)
    } else {
      next()
    }

    function next () {
      wss.handleUpgrade(req, socket, head, function (client) {
        wss.emit('connection' + req.url, client)
        wss.emit('connection', client)
      })
    }
  }

  if (serverOptions.session) {
    backend.use('connect', function (shareRequest, next) {
      const req = shareRequest.req
      const agent = shareRequest.agent

      if (!agent.connectSession && req && req.session) {
        agent.connectSession = req.session
      }

      next()
    })
  }

  return { upgrade: upgrade, wss: wss }
}

function doneInitialization (backend, stream, request) {
  backend.on('connect', function (data) {
    const agent = data.agent
    if (request.session) agent.connectSession = request.session
    backend.emit('share agent', agent, stream)
  })

  backend.listen(stream, request)
}
