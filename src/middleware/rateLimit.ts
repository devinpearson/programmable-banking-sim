import { rateLimit } from 'express-rate-limit'
import { formatErrorResponse } from '../app.js'

// Requests per minute, per client IP, for the endpoints that check a
// password or client secret (sign-in and /identity). Generous for a person
// or a test suite; it stops unlimited credential guessing.
const DEFAULT_LIMIT = 300

function configuredLimit() {
  const value = Number(process.env.AUTH_RATE_LIMIT)
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_LIMIT
}

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: configuredLimit(),
  // RateLimit-* and Retry-After headers, as the IETF draft describes.
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) =>
    formatErrorResponse(req, res, 429, 'Too many sign-in attempts. Try again in a minute.'),
})
