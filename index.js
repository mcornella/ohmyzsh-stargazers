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
const https = require('https')
const server = https.createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
}, app)

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

const SmeeClient = require('smee-client')

const WEBHOOK_URL = process.env.WEBHOOK_URL
if (!WEBHOOK_URL) throw new Error('missing webhook URL')

const smee = new SmeeClient({
    source: WEBHOOK_URL,
    target: `https://localhost:${PORT}/events`,
    logger: console
})

smee.start();
