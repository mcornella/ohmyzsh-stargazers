// Load .env settings
require('dotenv').config()

const path = require('path')
const express = require('express')
const app = express();

const verify = require('./verify')

const PORT = process.env.PORT || 3000
const WEBHOOK_URL = process.env.WEBHOOK_URL
if (!WEBHOOK_URL) throw new Error('missing webhook URL')


// SET UP INITIAL SERVER STATE

let STATE = {
    stars: 0,
    clients: 0
}

const fetch = require('node-fetch')
fetch('https://api.github.com/repos/ohmyzsh/ohmyzsh')
    .then(res => res.json())
    .then(json => { STATE.stars = json.stargazers_count || 0; })


// SET UP EXPRESS SERVER

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

        // Update global object
        STATE.stars = stars;

        // Broadcast stars change
        let json = JSON.stringify(STATE, null, 0)
        wss.clients.forEach(function each(client) {
            client.send(json)
        })
    }
    res.status(200).send()
})


// SET UP WEBSOCKET ENDPOINT

const fs = require('fs')
const https = require('https')
const server = https.createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
}, app)

const WebSocket = require('ws')
const wss = new WebSocket.Server({ server, path: '/ws' })

wss.on('connection', (ws) => {
    console.log('[wss]', `New client. Connected: ${wss.clients.size}`)
    STATE.clients = wss.clients.size
    ws.send(JSON.stringify(STATE, null, 0))
})

server.listen(PORT, function () {
    console.log(`Server listening on port ${PORT}`)
})


// SET UP SMEE.IO CONNECTION

const SmeeClient = require('smee-client')

// mock console to silence smee console output
const fakelogger = {};
for (let key of Object.keys(console)) {
    if (typeof console[key] === 'function')
        fakelogger[key] = () => { }
}

const smee = new SmeeClient({
    source: WEBHOOK_URL,
    target: `https://localhost:${PORT}/events`,
    logger: fakelogger
})

smee.start();
