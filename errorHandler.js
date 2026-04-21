/**
 * Global Error Handler Middleware
 * ---------------------------------
 * In Express, any function with 4 parameters
 * (err, req, res, next) is treated as an error handler.
 * All routes can call next(err) to reach this handler.
 *
 * VOCABULARY:
 *   middleware — a function that processes a request
 *                before the final response is sent.
 *   stack      — the full error object, including
 *                file name, line number, etc.
 *                Never send this to users in production!
 */

'use strict';

/**
 * Central error handler.
 * Formats all errors consistently before sending to the client.
 *
 * @param {Error}  err  - the thrown error
 * @param {Object} req  - the HTTP request
 * @param {Object} res  - the HTTP response
 * @param {Function} next - next middleware (required for Express to recognize this as error handler)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isDev = process.env.NODE_ENV !== 'production';

  // Log the error internally (use a proper logger like Winston in production)
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  if (isDev) console.error(err.stack);

  // Determine HTTP status code
  let statusCode = err.statusCode || err.status || 500;

  // Map common error types to appropriate status codes
  if (err.message?.toLowerCase().includes('not found'))    statusCode = 404;
  if (err.message?.toLowerCase().includes('private'))      statusCode = 403;
  if (err.message?.toLowerCase().includes('rate limit'))   statusCode = 429;
  if (err.message?.toLowerCase().includes('invalid url'))  statusCode = 400;

  // Build the error response
  const response = {
    success: false,
    message: err.message || 'An unexpected error occurred. Please try again.',
  };

  // In development, include the stack trace for debugging
  if (isDev && err.stack) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}

module.exports = { errorHandler };
