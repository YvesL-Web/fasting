import pino, { LoggerOptions } from 'pino'
import { env } from '../config/env'

const options: LoggerOptions = {
  name: 'fasting-backend',
  level: env.LOG_LEVEL,
  base: undefined,
  // un timestamp lisible en prod, sans pretty
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      // headers
      'req.headers.authorization',
      'req.headers.Authorization',
      'req.headers.cookie',
      'req.headers.Cookie',
      // cookies signés éventuels
      'req.cookies',
      'req.signedCookies',
      // corps potentiellement sensibles
      'req.body.password',
      'req.body.passwordConfirm',
      'req.body.token',
      'password',
      'passwordHash',
      'token',
      // réponses
      'res.headers["set-cookie"]'
    ],
    censor: '[REDACTED]'
  },
  transport: env.IS_DEV
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: true
        }
      }
    : undefined
}

export const logger = pino(options)
