import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodTypeAny, z } from 'zod'
import { formatErrorResponse } from '../app.js'

interface RequestSchemas {
  body?: ZodTypeAny
  params?: ZodTypeAny
  query?: ZodTypeAny
}

type Location = keyof RequestSchemas

export interface ValidationIssue {
  location: Location
  path: string
  message: string
}

// Express 5 makes req.query a read-only getter, so parsed values are kept on
// res.locals and read back with the helpers below.
const VALIDATED = 'validated'

/**
 * Validate the request's params, query and body against zod schemas. Invalid
 * requests get a 400 listing every problem; valid ones continue with the
 * parsed (coerced, defaulted, unknown-keys-stripped) values available through
 * validatedBody/validatedQuery.
 */
// Typed loosely (any params) so routes keep the params Express infers from
// their path, e.g. { accountId: string } for '/:accountId/balance'.
// biome-ignore lint/suspicious/noExplicitAny: see above
export function validateRequest(schemas: RequestSchemas): RequestHandler<any> {
  return (req: Request, res: Response, next: NextFunction) => {
    const validated: Partial<Record<Location, unknown>> = {}
    const issues: ValidationIssue[] = []

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location]
      if (!schema) continue
      // Express 5 leaves req.body undefined when nothing was sent.
      const result = schema.safeParse(req[location] ?? {})
      if (result.success) {
        validated[location] = result.data
      } else {
        issues.push(
          ...result.error.issues.map(issue => ({
            location,
            path: issue.path.join('.') || location,
            message: issue.message,
          })),
        )
      }
    }

    if (issues.length > 0) {
      return formatErrorResponse(req, res, 400, describeIssues(issues), { details: issues })
    }
    res.locals[VALIDATED] = validated
    next()
  }
}

// One readable line, e.g. "transferList.0.amount: Expected number".
function describeIssues(issues: ValidationIssue[]) {
  const [first, ...rest] = issues
  const more = rest.length > 0 ? ` (and ${rest.length} more)` : ''
  return `${first.path}: ${first.message}${more}`
}

export function validatedBody<S extends ZodTypeAny>(res: Response, _schema: S): z.infer<S> {
  return res.locals[VALIDATED]?.body
}

export function validatedQuery<S extends ZodTypeAny>(res: Response, _schema: S): z.infer<S> {
  return res.locals[VALIDATED]?.query
}
