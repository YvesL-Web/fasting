import { emailQueue } from '../../queues/queues'

type VerificationEmailJobPayload = {
  name: string
  to: string
  code: string
}

type PasswordResetEmailJobPayload = {
  name: string
  to: string
  code: string
}

export async function enqueueVerificationEmail(params: VerificationEmailJobPayload) {
  await emailQueue.add('sendVerificationEmail', params)
}

export async function enqueuePasswordResetEmail(params: PasswordResetEmailJobPayload) {
  await emailQueue.add('sendPasswordResetEmail', params)
}
