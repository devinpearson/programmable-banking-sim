/**
 * An error with an HTTP status, for handlers to throw. The error handler
 * turns it into a { errorMessage } response with that status.
 */
export class AppError extends Error {
  public readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
  }
}
