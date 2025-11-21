import 'dotenv/config'
import { z } from 'zod'

const toBool = (s: string) => {
  const v = s.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off', ''].includes(v)) return false
  throw new Error(`Invalid boolean: "${s}" (use true/false)`)
}

const BoolFromEnv = z.string().default('false').transform(toBool)

const LogLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])

const envSchema = z.object({
  // Mode
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: LogLevel.optional(), // sera dérivé plus bas si non défini

  PORT: z.string().default('4000'),

  // Autoriser string OU liste séparée par virgules
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string(),
  DB_PASS: z.string(),
  DB_NAME: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Auth
  EMAIL_VERIFICATION_TTL_SECONDS: z.coerce.number().default(900), // 15 minutes
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().default(900), // 15 minutes

  // Emails
  EMAIL_FROM: z.string().optional(),
  MAILTRAP_HOST: z.string(),
  MAILTRAP_USER: z.string(),
  MAILTRAP_PASS: z.string(),
  MAILTRAP_PORT: z.coerce.number(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('app/uploads'),

  // Session
  SESSION_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7), // 7 jours
  SESSION_COOKIE_NAME: z.string().default('sid'),
  SESSION_COOKIE_SECURE: BoolFromEnv, // en dev http tu peux mettre false
  SESSION_COOKIE_DOMAIN: z.string().optional(),

  // Frontend
  FRONTEND_BASE_URL: z.string().default('http://localhost:3000')
})

const raw = envSchema.parse(process.env)

// Dérivés utiles pour le code
const isProd = raw.NODE_ENV === 'production'
const isDev = raw.NODE_ENV === 'development'
const isTest = raw.NODE_ENV === 'test'
const resolvedLogLevel = raw.LOG_LEVEL ?? (isDev ? 'debug' : 'info')

// Support multi-origins: "http://a.com,http://b.com"
const corsOrigin = raw.CORS_ORIGIN.includes(',')
  ? raw.CORS_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : raw.CORS_ORIGIN

export const env = {
  ...raw,
  IS_DEV: isDev as boolean,
  IS_PROD: isProd as boolean,
  IS_TEST: isTest as boolean,
  CORS_ORIGIN: corsOrigin,
  LOG_LEVEL: resolvedLogLevel
} as const
