const path = require('path')
const through = require('through')
const extend = require('extend')

const defaultClientOptions = {
  base: '/channel',
  reconnect: true,
  browserChannelOnly: false,
  srvProtocol: undefined,
  srvHost: undefined,
  srvPort: undefined,
  srvSecurePort: undefined,
  timeout: 10000,
  timeoutIncrement: 10000
}

module.exports = function (clientOptions) {
  clientOptions = clientOptions || {}
  clientOptions = extend({}, defaultClientOptions, clientOptions)

  const clientOptionsJson = JSON.stringify(clientOptions)

  // Add the client side script to the Browserify bundle. Set the clientOptions
  // needed to connect to the corresponding server by injecting them into the
  // file during bundling
  return function (bundle) {
    const browserFilename = path.join(__dirname, '../browser/index.js')
    bundle.transform(function (filename) {
      if (filename !== browserFilename) return through()
      let file = ''
      return through(
        function write (data) {
          file += data
        }
        , function end () {
          const rendered = file.replace('{{clientOptions}}', clientOptionsJson)
          this.queue(rendered)
          this.queue(null)
        }
      )
    })
    bundle.add(browserFilename)
  }
}
