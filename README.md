# racer-highway

This is a plugin to use racer over a websocket and browserchannel connection.

## Usage

In the server part of your app:

```js
var racerHighway = require('racer-highway'); 

// ...
// var server = http.createServer
// ...

// ...
// var store  = racer.createStore 
// or
// var store  = derby.createStore
// ...

highwayHandlers = racerHighway(store);

express.App.use(highwayHandlers.browserChannelMiddlware);

server.on('upgrade', highwayHandlers.webSocketUpgrade);
```

If you use `racer-ws` with derby make sure this is before any calls to `app.writeScripts`.

## MIT License
Copyright (c) 2014 by Artur Zayats

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
