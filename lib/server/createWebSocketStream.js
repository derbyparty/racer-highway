const { Duplex } = require('stream')
const WebSocket = require('ws')

module.exports = createWebSocketStream

/**
 * @param {EventEmitters} client is a browserchannel client session for a given
 * browser window/tab that is has a connection
 * @return {Duplex} stream
 */
function createWebSocketStream (client) {
  const stream = new ClientStream(client)

  client.on('message', function onMessage (message) {
    let data
    try {
      data = JSON.parse(message)
    } catch (err) {
      stream.emit('error', err)
      return
    }
    stream.push(data)
  })

  client.on('close', function () {
    // Signal data writing is complete. Emits the 'end' event
    stream.push(null)
  })

  return stream
}

class ClientStream extends Duplex {
  constructor (client) {
    super({ objectMode: true })
    this.client = client

    const self = this

    this.on('error', function (error) {
      console.warn('WebSocket client message stream error', error)
      self._stopClient()
    })

    // The server ended the writable stream. Triggered by calling stream.end()
    // in agent.close()
    this.on('finish', function () {
      self._stopClient()
    })
  }

  _read () {}

  _write (chunk, encoding, callback) {
    // Silently drop messages after the session is closed
    if (this.client.readyState !== WebSocket.OPEN) return callback()
    this.client.send(JSON.stringify(chunk), function (err) {
      if (err) console.error('[racer-highway] send:', err)
    })
    callback()
  }

  _stopClient () {
    this.client.close()
  }
}
