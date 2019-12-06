const crypto = require('crypto')

/// Secure way to generate random secret:
/// const crypto = require('crypto')
/// crypto.randomBytes(32).toString('hex')

const secret = process.env.WEBHOOK_SECRET
if (!secret) throw new Error('missing webhook secret')

module.exports = function verify(req, _, next) {
    const payload = JSON.stringify(req.body)
    if (!payload) return next('Empty payload')

    const hmac = crypto.createHmac('sha1', secret)
    const digest = 'sha1=' + hmac.update(payload).digest('hex')
    const checksum = req.get('X-Hub-Signature')

    if (!checksum || !digest) {
        return next('Empty checksum or digest')
    } else if (!crypto.timingSafeEqual(Buffer.from(checksum), Buffer.from(digest))) {
        return next('Request body digest did not match checksum')
    }

    return next()
}
