import "dotenv/config";
import { z } from "zod";

const LogLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])

const envSchema = z.object({
  // Mode
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: LogLevel.optional(), // sera dérivé plus bas si non défini

  PORT: z.string().default("4000"),

  // Autoriser string OU liste séparée par virgules
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string(),
  DB_PASS: z.string(),
  DB_NAME: z.string(),

 // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

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


// if (!parsed.success) {
//   console.error("❌ Invalid environment variables:", parsed.error.format());
//   process.exit(1);
// }

export const env = {
  ...raw,
  IS_DEV: isDev as boolean,
  IS_PROD: isProd as boolean,
  IS_TEST: isTest as boolean,
  CORS_ORIGIN: corsOrigin,
  LOG_LEVEL: resolvedLogLevel
} as const

