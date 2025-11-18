import { Queue, QueueEvents } from 'bullmq'
import { bullConnection } from '../config/bullmq'

// Queues
export const emailQueue = new Queue('email', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000 // 5 seconds
    },
    removeOnComplete: true,
    removeOnFail: 10 // 10 attempts
  }
})

// Events
export const emailEvents = new QueueEvents('email', { connection: bullConnection })
