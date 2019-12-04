// Load .env settings
require('dotenv').config()

const path = require('path')
const express = require('express')
const app = express();

const verify = require('./verify')

const PORT = process.env.PORT || 3000
const WEBHOOK_URL = process.env.WEBHOOK_URL
if (!WEBHOOK_URL) throw new Error('missing webhook URL')


// SET UP WEBSOCKET ENDPOINT

const http = require('http')
const server = http.createServer(app)

const WebSocket = require('ws')
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws) => {
    console.log('[wss]', `New client. Connected: ${wss.clients.size}`)
    ws.send(JSON.stringify({ say: 'Hello World' }, null, 0))
})

server.listen(PORT + 1, function () {
    console.log(`WebSocket server started on port ${PORT + 1}`)
})


// SET UP SERVER ENDPOINT

let STARS = {
    count: 0,
    dir: 'up'
}

app.use(express.json())

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'index.html'))
})

app.post('/events', verify, function (req, res) {
    if (req.get('x-github-event') === 'star') {
        // Get star event data
        let user = req.body.sender.login
        let stars = req.body.repository.stargazers_count
        let action = req.body.action === "deleted" ? "removed" : "added"
        console.log(`Star ${action} by @${user}: ${stars}`)

        // Update global object
        STARS.dir = (STARS.count <= stars) ? 'up' : 'down'
        STARS.count = stars;

        // Broadcast stars change
        let json = JSON.stringify(STARS, null, 0)
        wss.clients.forEach(function each(client) {
            client.send(json)
        })
    }
    res.status(200).send()
})

app.listen(PORT, function () {
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
    target: `http://localhost:${PORT}/events`,
    logger: fakelogger
})

smee.start();
