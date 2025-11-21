import { closeQueues, setupQueues } from './queues/setup-queues'
import { logger } from './utils/logger'
import { emailWorker } from './workers/email.worker' // ceci crée déjà le Worker via makeWorker

async function bootstrap() {
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '[email-worker] UnhandledRejection — exiting')
    process.exit(1)
  })
  process.on('uncaughtException', (err) => {
    logger.error({ err }, '[email-worker] UncaughtException — exiting')
    process.exit(1)
  })

  await setupQueues()

  logger.info('[email-worker] started')

  const shutdown = async (signal: string) => {
    logger.info(`[email-worker] ${signal} received — shutting down gracefully...`)
    try {
      await emailWorker.close()
      await closeQueues()
    } catch (err) {
      logger.error({ err }, '[email-worker] error during close')
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

bootstrap().catch((err) => {
  logger.error({ err }, '[email-worker] boot failed')
  process.exit(1)
})
