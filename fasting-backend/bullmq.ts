// src/config/bullmq.ts
import { Queue, Worker, , QueueEvents, JobsOptions, WorkerOptions } from 'bullmq'
import type { Redis } from 'ioredis'

import { redis } from './src/config/ioredis'
import { env } from './src/config/env'

// Namespace pour éviter les collisions dans Redis
const QUEUE_PREFIX = env.REDIS_PREFIX ?? 'fasting'

// Options de connexion partagées
const connection: Redis = redis

export type BullQueue<T> = Queue<T>
export type BullWorker<T> = Worker<T>

export function createQueue<T>(name: string, defaultJobOptions?: JobsOptions): BullQueue<T> {
  const queue = new Queue<T>(name, {
    connection,
    prefix: `${QUEUE_PREFIX}:bull`,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 500,
      removeOnFail: 500,
      ...defaultJobOptions
    }
  })

  // Scheduler nécessaire pour les jobs delayed / repeatable
  new QueueScheduler(name, {
    connection,
    prefix: `${QUEUE_PREFIX}:bull`
  })

  return queue
}

export function createWorker<T>(
  name: string,
  processor: (job: import('bullmq').Job<T>) => Promise<unknown>,
  opts: WorkerOptions = {}
): BullWorker<T> {
  const worker = new Worker<T>(name, processor, {
    connection,
    prefix: `${QUEUE_PREFIX}:bull`,
    concurrency: opts.concurrency ?? 5,
    maxStalledCount: 2,
    ...opts
  })

  const events = new QueueEvents(name, {
    connection,
    prefix: `${QUEUE_PREFIX}:bull`
  })

  worker.on('completed', (job) => {
    console.info(`✅ [queue:${name}] job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(
      `❌ [queue:${name}] job ${job?.id} failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  })

  worker.on('error', (err) => {
    console.error(`🔥 [worker:${name}] error: ${err instanceof Error ? err.message : String(err)}`)
  })

  events.on('waiting', ({ jobId }) => {
    console.debug(`⏳ [queue:${name}] job ${jobId} waiting`)
  })

  events.on('stalled', ({ jobId }) => {
    console.warn(`⚠️ [queue:${name}] job ${jobId} stalled`)
  })

  return worker
}

// Helper pour enregistrer un shutdown propre de tous les workers
export function registerQueueGracefulShutdown(workers: BullWorker<any>[]) {
  const shutdown = async (signal: string) => {
    console.info(`🔻 [bullmq] graceful shutdown (${signal})`)
    try {
      await Promise.all(
        workers.map((w) =>
          w.close().catch((err) => {
            console.error(`[worker:${w.name}] close error`, err)
          })
        )
      )
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}
