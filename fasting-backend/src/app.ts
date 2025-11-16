import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { env } from './config/env.js'
import { healthRouter } from './modules/health/health.router.js'
import { notFoundHandler } from './middlewares/not-found.js'
import { errorHandler } from './middlewares/error-handler.js'
import { requestLogger } from './middlewares/request-logger.js'
import compression from 'compression'
import { authRouter } from './modules/auth/auth.router.js'

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

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // Perf & observabilité
  app.use(compression())
  app.use(requestLogger)

  // Routes
  app.use('/health', healthRouter)
  app.use('/auth', authRouter)

  // 404
  app.use(notFoundHandler)

  // error handler
  app.use(errorHandler)

  return app
}
