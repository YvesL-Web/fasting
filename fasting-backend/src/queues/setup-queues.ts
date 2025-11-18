import { emailEvents, emailQueue } from './queues'

export async function setupQueues() {
  emailEvents.on('completed', (e) => console.info('[email] completed', e))
  emailEvents.on('failed', (e) => console.error('[email] failed', e))
  emailEvents.on('error', (err) => console.error('[email] events error', err))
}

export async function closeQueues() {
  await Promise.all([emailQueue.close(), emailEvents.close()])
}
