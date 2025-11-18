import { Job, Worker } from 'bullmq'
import { bullConnection } from '../config/bullmq'

export function makeWorker<T = any>(name: string, handler: (job: Job<T>) => Promise<any>) {
  const concurrency = 5
  const worker = new Worker<T>(name, handler, {
    connection: bullConnection,
    concurrency
  })
  worker.on('error', (err) => console.error(`${name} worker error`, err))
  worker.on('failed', (job, err) => console.error(`${name} job ${job?.id} failed`, err))
  worker.on('completed', (job) => console.info(`${name} job ${job.id} completed`))
  return worker
}
