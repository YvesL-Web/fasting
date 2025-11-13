import pinoHttp from 'pino-http'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'

export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/ready'
  },

  genReqId: (req, res) => {
    const idHeader = req.headers['x-request-id']
    const reqId = (Array.isArray(idHeader) ? idHeader[0] : idHeader) || randomUUID()
    res.setHeader('x-request-id', reqId)
    return reqId
  },

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // IP “réelle” (si trust proxy est activé)
      ip: (req as any).ip || req.socket?.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  },

  customSuccessMessage: (req, res) => {
    const ms = (res as any).responseTime
    const time = ms ? ` (${Math.round(Number(ms))} ms)` : ''
    return `[${req.id}] ${req.method} ${req.url} -> ${res.statusCode}${time}`
  },

  customErrorMessage: (req, res, err) =>
    `[${req.id}] ${req.method} ${req.url} -> ${res.statusCode} (${err?.message})`,

  customLogLevel: (_req, res, err) => {
    if (err) return 'error'
    const status = res?.statusCode ?? 200
    if (status >= 500) return 'error'
    if (status >= 400) return 'warn'
    return 'info'
  },

  customProps: (req, res) => ({
    reqId: req.id,
    responseTime: (res as any).responseTime,
    // si un middleware auth attache req.user
    userId: (req as any).user?.id ?? undefined
  })
})
