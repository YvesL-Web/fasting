import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import { env } from './config/env'
import { healthRouter } from './modules/health/health.router'
import { notFoundHandler } from './middlewares/not-found'
import { errorHandler } from './middlewares/error-handler'
import { requestLogger } from './middlewares/request-logger'
import compression from 'compression'
import { authRouter } from './modules/auth/auth-router'
import { fastRouter } from './modules/fasts/fast.router'

export const createApp = () => {
  const app = express()

  // En-têtes et proxy
  app.disable('x-powered-by')

  app.use(helmet())

  app.use(
    cors({
      origin: env.CORS_ORIGIN, // string | string[]
      credentials: true
    })
  )
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // Perf & observabilité
  app.use(compression())
  app.use(requestLogger)

  // Routes
  app.use('/auth', authRouter)
  app.use('/fasts', fastRouter)
  app.use('/health', healthRouter)

  // 404
  app.use(notFoundHandler)

  // error handler
  app.use(errorHandler)

  return app
}
