var Duplex = require('stream').Duplex;
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;
var BrowserChannelServer = require('browserchannel').server;
var through = require('through');
var path = require('path');
var crypto = require('crypto');

var extend = require('extend');

var defaultClientOptions = {
  base: '/channel',
  reconnect: true,
  browserChannelOnly: false,
  srvProtocol: undefined,
  srvHost: undefined,
  srvPort: undefined,
  srvSecurePort: undefined,
  timeout: 10000,
  timeoutIncrement: 10000
};

var defaultServerOptions = {
  session: null,
  base: '/channel',
  noPing: false,
  pingInterval: 30000
};

module.exports = function(store, serverOptions, clientOptions) {

  serverOptions = serverOptions || {};
  clientOptions = clientOptions || {};

  clientOptions = extend({}, defaultClientOptions, clientOptions);
  serverOptions = extend({}, defaultServerOptions, serverOptions);

  // ws-module specific options
  serverOptions.path = serverOptions.base;
  serverOptions.noServer = true;

  var clientOptionsJson = JSON.stringify(clientOptions);

  serverOptions.noServer = true;

  // Add the client side script to the Browserify bundle. Set the clientOptions
  // needed to connect to the corresponding server by injecting them into the
  // file during bundling
  store.on('bundle', function(bundle) {
    var browserFilename = path.join(__dirname, 'browser.js');
    bundle.transform(function(filename) {
      if (filename !== browserFilename) return through();
      var file = '';
      return through(
        function write(data) {
          file += data;
        }
        , function end() {
          var rendered = file.replace('{{clientOptions}}', clientOptionsJson);
          this.queue(rendered);
          this.queue(null);
        }
      );
    });
    bundle.add(browserFilename);
  });


  var middleware = BrowserChannelServer(serverOptions, function(client, connectRequest) {

    if (serverOptions.session) {
      // https://github.com/expressjs/session/pull/57
      if (!connectRequest.originalUrl) connectRequest.originalUrl = connectRequest.url;
      serverOptions.session(connectRequest, {}, startBrowserChannel);
    } else {
      startBrowserChannel();
    }

    function startBrowserChannel() {
      var rejected = false;
      var rejectReason;
      function reject(reason) {
        rejected = true;
        if (reason) rejectReason = reason;
      }

      if (connectRequest.session) client.connectSession = connectRequest.session;

      store.emit('client', client, reject);
      if (rejected) {
        // Tell the client to stop trying to connect
        client.stop(function() {
          client.close(rejectReason);
        });
        return;
      }
      var stream = createBrowserChannelStream(client, store.logger);
      var agent = store.shareClient.listen(stream, connectRequest);
      if (connectRequest.session) agent.connectSession = connectRequest.session;
      store.emit('share agent', agent, stream);
    }
  });

  var wss = new WebSocketServer(serverOptions);

  wss.on('connection', function (client) {

    client.id = crypto.randomBytes(16).toString('hex');

    // Some proxy drop out long connections
    // so do ping periodically to prevent this
    // interval = 30s by default
    if (!serverOptions.noPing){
      client.timer = setInterval(function(){

        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        } else {
          clearInterval(client.timer);
        }
      }, serverOptions.pingInterval);
    }

    var rejected = false;
    var rejectReason;

    function reject(reason) {
      rejected = true;
      if (reason) rejectReason = reason;
    }

    if (client.upgradeReq.session) client.connectSession = client.upgradeReq.session;

    store.emit('client', client, reject);
    if (rejected) {
      // Tell the client to stop trying to connect
      client.close(1001, rejectReason);
      return;
    }

    var stream = createWebSocketStream(client, store.logger);
    var agent = store.shareClient.listen(stream, client.upgradeReq);
    if (client.upgradeReq.session) agent.connectSession = client.upgradeReq.session;
    store.emit('share agent', agent, stream);
  });

  function upgrade(req, socket, upgradeHead){
    //copy upgradeHead to avoid retention of large slab buffers used in node core
    var head = new Buffer(upgradeHead.length);
    upgradeHead.copy(head);

    if (serverOptions.session) {
      // https://github.com/expressjs/session/pull/57
      if (!req.originalUrl) req.originalUrl = req.url;
      serverOptions.session(req, {}, next);
    } else {
      next();
    }

    function next() {
      wss.handleUpgrade(req, socket, head, function(client) {
        wss.emit('connection'+req.url, client);
        wss.emit('connection', client);
      });
    }


  }

  if (serverOptions.session) {
    store.shareClient.use('connect',  handleConnect);

    function handleConnect(shareRequest, next) {
      var req = shareRequest.req;
      var agent = shareRequest.agent;

      if (!agent.connectSession) {
        if (req && req.session) {
          agent.connectSession = req.session;
        } else if (req) {
          serverOptions.session(req, {}, function(){
            agent.connectSession = req.session;
            return next();
          });
        }
      }
      next();
    }
  }

  return {upgrade: upgrade, middleware: middleware};
};


function createWebSocketStream(client, logger) {
  var stream = new Duplex({objectMode: true});

  stream._write = function _write(chunk, encoding, callback) {
    // Silently drop messages after the session is closed
    if (client.state !== 'closed') {
      client.send(JSON.stringify(chunk), function(err){
        if (err) console.error(err);
      });

      if (logger) {
        logger.write({type: 'S->C', chunk: chunk, client: client});
      }

    }
    callback();
  };
  // Ignore. You can't control the information, man!
  stream._read = function _read() {};

  client.on('message', function onMessage(data) {

    try {
      data = JSON.parse(data);
    } catch(e) {
      console.warn('Invalid message from client', data);
      return;
    }
    // Ignore Racer channel messages
    if (data && data.racer) return;
    stream.push(data);
    if (logger) {
      logger.write({type: 'C->S', chunk: data, client: client});
    }

  });

  stream.on('error', function onError() {
    client.stop();
  });

  client.on('close', function onClose() {
    stream.end();
    stream.emit('close');
    stream.emit('end');
    stream.emit('finish');
  });

  return stream;
}

function createBrowserChannelStream(client, logger) {
  var stream = new Duplex({objectMode: true});

  stream._write = function _write(chunk, encoding, callback) {
    // Silently drop messages after the session is closed
    if (client.state !== 'closed') {
      client.send(chunk);
      if (logger) {
        logger.write({type: 'S->C', chunk: chunk, client: client});
      }
    }
    callback();
  };
  // Ignore. You can't control the information, man!
  stream._read = function _read() {};

  client.on('message', function onMessage(data) {
    // Ignore Racer channel messages
    if (data && data.racer) return;
    stream.push(data);
    if (logger) {
      logger.write({type: 'C->S', chunk: data, client: client});
    }
  });

  stream.on('error', function onError() {
    client.stop();
  });

  client.on('close', function onClose() {
    stream.end();
    stream.emit('close');
    stream.emit('end');
    stream.emit('finish');
  });

  return stream;
}
