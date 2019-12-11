// Load .env settings
require('dotenv').config()

const PORT = process.env.PORT || 3000


// SET UP INITIAL SERVER STATE

let State = {
    stars: 0,
    clients: 0
}

const fetch = require('node-fetch')
fetch('https://api.github.com/repos/ohmyzsh/ohmyzsh')
    .then(res => res.json())
    .then(json => { State.stars = json.stargazers_count || 0; })


// STATE COMMUNICATION LOGIC

// debounce logic from https://davidwalsh.name/javascript-debounce-function
function debounce(func, wait, immediate) {
    var timeout
    return function() {
        var context = this, args = arguments
        var later = function() {
            timeout = null
            if (!immediate) func.apply(context, args)
        }
        var callNow = immediate && !timeout
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
        if (callNow) func.apply(context, args)
    }
}

const broadcastState = debounce(function() {
    let json = JSON.stringify(State, null, 0)
    wss.clients.forEach(function each(client) {
        client.send(json)
    })
}, 500)


// SET UP EXPRESS SERVER

const express = require('express')
const app = express();

const verify = require('./verify')

// static assets
app.use(express.static('static'))

// webhook endpoint
app.use('/events', express.json())
app.post('/events', verify, function (req, res) {
    if (req.get('x-github-event') === 'star') {
        // Get star event data
        let user = req.body.sender.login
        let stars = req.body.repository.stargazers_count
        let action = req.body.action === "deleted" ? "removed" : "added"
        console.log(`Star ${action} by @${user}: ${stars}`)

        // Update global state
        State.stars = stars

        // Broadcast
        broadcastState()
    }
    res.status(200).send()
})


// SET UP WEBSOCKET ENDPOINT

const fs = require('fs')

// Use provided certificate credentials (for production), or
// use ones generated for local development.
// If these provided ones aren't trusted, you should use
// NODE_TLS_REJECT_UNAUTHORIZED=0 in your `.env` file so that
// the smee.io client doesn't complain about untrusted certs.
//
// `server.key` and `server.crt` generated with the command:
/* openssl req -x509 -out server.crt -keyout server.key \
-newkey rsa:2048 -nodes -sha256 \
-subj '/CN=localhost' -extensions EXT -config \
<(printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n"\
"[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth") */

const credentials = {
    key: fs.readFileSync(process.env.KEY_PATH || 'server.key'),
    cert: fs.readFileSync(process.env.CERT_PATH || 'server.crt')
}

if (process.env.CA_PATH) {
    credentials["ca"] = fs.readFileSync(process.env.CA_PATH)
}

const https = require('https')
const server = https.createServer(credentials, app)

const WebSocket = require('ws')
const wss = new WebSocket.Server({ server, path: '/ws' })

wss.on('connection', (ws) => {
    console.log('[wss]', `New connection. Total: ${wss.clients.size}`)

    // Update global state
    State.clients = wss.clients.size

    // Broadcast
    broadcastState()
})

server.listen(PORT, function () {
    console.log(`Server listening on port ${PORT}`)
})


// SET UP SMEE.IO CONNECTION

// Assume prod environment if not found
const WEBHOOK_URL = process.env.WEBHOOK_URL
if (!WEBHOOK_URL) return

const SmeeClient = require('smee-client')

const smee = new SmeeClient({
    source: WEBHOOK_URL,
    target: `https://localhost:${PORT}/events`,
    logger: console
})

smee.start();
