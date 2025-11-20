import { Job, UnrecoverableError } from 'bullmq'

import { makeWorker } from './worker'
import {
  VERIFICATION_EMAIL_TEMPLATE_HTML,
  VERIFICATION_EMAIL_TEMPLATE_TEXT
} from '../emails/templates/verificationEmailTemplate'
import {
  REQUEST_NEW_EMAIL_TEMPLATE_HTML,
  REQUEST_NEW_EMAIL_TEMPLATE_TEXT
} from '../emails/templates/requestNewEmailTemplate'
import {
  EMAIL_CHANGED_CONFIRMATION_TEMPLATE_HTML,
  EMAIL_CHANGED_CONFIRMATION_TEMPLATE_TEXT
} from '../emails/templates/emailChangedConfirmationTemplate'
import { sendEmail } from '../emails/emails'
import {
  PASSWORD_RESET_REQUEST_TEMPLATE_HTML,
  PASSWORD_RESET_REQUEST_TEMPLATE_TEXT
} from '../emails/templates/passwordResetRequestTemplate'

export const emailWorker = makeWorker('email', async (job: Job<any>) => {
  try {
    switch (job.name) {
      case 'sendVerificationEmail': {
        const p = job.data
        const name: string = p.name
        const to: string = p.to
        const code: string = p.code
        const subject = 'Verify your email'
        const html = VERIFICATION_EMAIL_TEMPLATE_HTML(code, name)
        const text = VERIFICATION_EMAIL_TEMPLATE_TEXT(code, name)

        await sendEmail({
          to,
          subject,
          html,
          text
        })

        return { sent: true }
      }

      case 'sendPasswordResetEmail': {
        const { name, to, code } = job.data as {
          name: string
          to: string
          code: string
        }
        const subject = 'Password Reset Request'
        const html = PASSWORD_RESET_REQUEST_TEMPLATE_HTML(code, name)
        const text = PASSWORD_RESET_REQUEST_TEMPLATE_TEXT(code, name)

        await sendEmail({ to, subject, html, text })
        return { sent: true }
      }

      case 'requestNewEmail': {
        const p = job.data
        const name: string = p.name
        const to: string = p.to
        const code: string = p.code
        const subject = 'Confirm your new email'
        const html = REQUEST_NEW_EMAIL_TEMPLATE_HTML(code, name)
        const text = REQUEST_NEW_EMAIL_TEMPLATE_TEXT(code, name)

        await sendEmail({
          to,
          subject,
          html,
          text
        })
        return { sent: true }
      }

      case 'emailChangedConfirmation': {
        const p = job.data
        const name: string = p.name
        const to: string = p.to
        const subject = 'Email Successfully Updated'
        const html = EMAIL_CHANGED_CONFIRMATION_TEMPLATE_HTML(name)
        const text = EMAIL_CHANGED_CONFIRMATION_TEMPLATE_TEXT(name)
        await sendEmail({
          to,
          subject,
          html,
          text
        })
        return { sent: true }
      }

      default:
        console.warn(`No handler for email job name: ${job.name}`)
        return { skipped: true }
    }
  } catch (error: any) {
    if (error?.nonRetryable) {
      console.error(`Non-retryable error for email job ${job.id}:`, error.message)
      throw new UnrecoverableError(error.message)
    }
    console.error('Retryable error for email job', job.id, error.message)
    throw error
  }
})
