import http from 'http'

import { createApp } from "./app";
import { env } from "./config/env";

import { appDataSource } from "./infra/db";
import { logger } from './utils/logger';


async function bootstrap() {
  // ----- Gestion d’erreurs globales -----
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'UnhandledRejection — exiting')
    process.exit(1)
  })
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'UncaughtException — exiting')
    process.exit(1)
  })

  // ----- Initialisation DB -----
  await appDataSource.initialize()
  logger.info('DataSource initialized')

  // ----- Création app Express -----
  const app = createApp()
  const port = env.PORT
  const httpServer = http.createServer(app)

  // Sécurise contre les clients lents (slowloris)
  httpServer.keepAliveTimeout = 75_000
  httpServer.headersTimeout = 76_000
  httpServer.requestTimeout = 60_000

  // ----- Lancement serveur HTTP -----
  const server = httpServer.listen(port, () => {
    logger.info(`Server ready on http://localhost:${port}`)
  })

  server.on('error', (err) => logger.error({ err }, 'HTTP server error'))

  // ----- Shutdown propre -----
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully...`)
    server.close(async () => {
      if (appDataSource.isInitialized) await appDataSource.destroy()
      process.exit(0)
    })
    setTimeout(async () => {
      if (appDataSource.isInitialized) await appDataSource.destroy()
      process.exit(0)
    }, 5000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

// ----- Lancement global -----
bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Boot failed')
  process.exit(1)
})