import { NextFunction, Request, Response } from 'express'

import { ZodError } from 'zod'
import { treeifyErrorSafe } from '../utils/zod-error'
import { AppError } from '../utils/error'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    // évite un double envoi si des headers ont déjà été écrits
    return
  }

  if (err instanceof AppError) {
    // log minimal (évite les payloads sensibles)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      details: err.details ?? null
    })
  }

  if (err instanceof ZodError) {
    const details = treeifyErrorSafe(err)
    // log synthétique
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Invalid request input.',
      details
    })
  }

  if (typeof err === 'object' && err !== null && (err as any).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'INVALID_JSON', message: 'Malformed JSON body.' })
  }

  return res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong.' })
}
