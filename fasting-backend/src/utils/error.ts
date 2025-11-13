import { ZodError } from 'zod'
import { treeifyErrorSafe } from './zod-error'

export const ERR = {
  INVALID_INPUT: { status: 400, code: 'INVALID_INPUT', message: 'Invalid request input.' },
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: 'Not allowed.' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Resource not found.' },
  CONFLICT: { status: 409, code: 'CONFLICT', message: 'Conflict.' },
  EMAIL_TAKEN: { status: 409, code: 'EMAIL_TAKEN', message: 'Email already registered.' },
  INVALID_CREDENTIALS: {
    status: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials.'
  },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests.' },
  SERVER_ERROR: { status: 500, code: 'SERVER_ERROR', message: 'Something went wrong.' }
} as const

export type ErrKey = keyof typeof ERR

export class AppError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(
    err: { status: number; code: string; message: string },
    details?: unknown,
    cause?: unknown
  ) {
    super(err.message)
    this.name = 'AppError'
    this.status = err.status
    this.code = err.code
    this.details = details

    // garder instanceof fiable
    Object.setPrototypeOf(this, new.target.prototype)
    // attacher la cause si supportée (Node 16+)
    if (cause && !('cause' in this)) {
      try {
        ;(this as any).cause = cause
      } catch {}
    }
    // stack utile
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  static fromZod(e: ZodError) {
    // arborescent, stable, sans APIs dépréciées
    return new AppError(ERR.INVALID_INPUT, treeifyErrorSafe(e))
  }

  withDetails(details: unknown) {
    this.details = details
    return this
  }
}
