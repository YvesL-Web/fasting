import nodemailer from 'nodemailer'
import { env } from '../config/env'

export const transport = nodemailer.createTransport({
  host: env.MAILTRAP_HOST,
  port: env.MAILTRAP_PORT,
  auth: {
    user: env.MAILTRAP_USER,
    pass: env.MAILTRAP_PASS
  },
  pool: true
})
