import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/AppError.js'
import { formatErrorResponse } from '../app.js'

/**
 * Last-resort error handler. Express 5 forwards rejected promises from async
 * handlers here, so an unexpected error still gets a JSON response (and a
 * dashboard log line) instead of Express's default HTML page.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return formatErrorResponse(req, res, err.statusCode, err.message)
  }
  // A body the JSON parser could not read.
  if (err instanceof SyntaxError && 'body' in err) {
    return formatErrorResponse(req, res, 400, 'Request body is not valid JSON')
  }
  console.log(err)
  return formatErrorResponse(req, res, 500, 'Internal server error')
}
