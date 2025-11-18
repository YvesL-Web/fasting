import { readFileSync } from 'fs'

import { transport } from './mailtrap.config'
import { env } from '../config/env'

type SendOpts = {
  to: string
  subject: string
  html?: string
  text?: string

  /** Option 1: lire une PJ depuis le disque */
  attachmentPath?: string
  attachmentFilename?: string

  /** Option 2: passer la PJ en base64 directement */
  attachmentBase64?: string
  attachmentContentType?: string
}

export async function sendEmail(opts: SendOpts) {
  const from = env.EMAIL_FROM

  // préparation PJ (facile et sûre)
  let attachments: { content: Buffer; filename?: string; contentType?: string }[] | undefined

  if (opts.attachmentBase64) {
    try {
      const buf = Buffer.from(opts.attachmentBase64, 'base64')
      attachments = [
        {
          content: buf,
          filename: opts.attachmentFilename,
          contentType: opts.attachmentContentType
        }
      ]
    } catch (e: any) {
      console.error(`Email attachment base64 decode error: ${e?.message || e}`)
      const err: any = new Error(`Attachment base64 decode failed: ${e?.message || e}`)
      err.nonRetryable = true
      throw err
    }
  } else if (opts.attachmentPath) {
    try {
      const content = readFileSync(opts.attachmentPath)
      attachments = [{ content, filename: opts.attachmentFilename }]
    } catch (e: any) {
      console.error(`Email attachment read error: ${e?.message || e}`)
      const err: any = new Error(`Attachment read failed: ${e?.message || e}`)
      err.nonRetryable = true
      throw err
    }
  }

  try {
    const info = await transport.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html ?? '',
      text: opts.text ?? '',
      attachments
    })

    console.info(`Email sent: ${info?.messageId}`)
    return info?.messageId ?? false
  } catch (error: any) {
    const status = typeof error?.responseCode === 'number' ? error.responseCode : null
    const message = error?.message ?? String(error)

    const err: any = new Error(`Failed to send email: ${message}`)
    // Simple: on considère retriable si code SMTP 4xx/5xx ou erreur réseau courante
    const networkCodes = new Set([
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EAI_AGAIN',
      'ENOTFOUND'
    ])
    if (networkCodes.has(error?.code) || (typeof status === 'number' && status >= 400)) {
      err.nonRetryable = false
      console.warn(
        `Transient email error (${status ?? error?.code ?? 'n/a'}) -> can retry: ${message}`
      )
    } else {
      err.nonRetryable = true
      console.error(`Permanent email error (${status ?? 'n/a'}) -> do not retry: ${message}`)
    }
    throw err
  }
}

// const transientStatus = new Set([421, 450, 451, 452]) // par ex.

// if (networkCodes.has(error?.code) || transientStatus.has(status ?? 0) || (status && status >= 500)) {
//   err.nonRetryable = false // retry
// } else {
//   err.nonRetryable = true // permanent
// }
