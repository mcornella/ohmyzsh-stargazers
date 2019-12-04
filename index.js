// Load .env settings
require('dotenv').config()

const express = require('express')
const app = express();

const verify = require('./verify')

const PORT = process.env.PORT || 3000
const WEBHOOK_URL = process.env.WEBHOOK_URL
if (!WEBHOOK_URL) throw new Error('missing webhook URL')


// SET UP SERVER ENDPOINT

app.use(express.json())

app.post('/events', verify, function (req, res) {
    if (req.get('x-github-event') === 'star') {
        let stars = req.body.repository.stargazers_count
        let user = req.body.sender.login
        let action = req.body.action === "deleted" ? "removed" : "added"
        console.log(`Star ${action} by @${user}: ${stars}`)
    }
    res.status(200).send()
})

app.listen(PORT, function() {
    console.log(`Server listening on port ${PORT}`)
})


// SET UP SMEE.IO CONNECTION

const SmeeClient = require('smee-client')

// mock console to silence smee console output
const fakelogger = {};
for (let key of Object.keys(console)) {
    if (typeof console[key] === 'function')
        fakelogger[key] = () => {}
}

const smee = new SmeeClient({
    source: WEBHOOK_URL,
    target: `http://localhost:${PORT}/events`,
    logger: fakelogger
})

smee.start();
