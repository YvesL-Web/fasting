import crypto from 'crypto'
import { ensureRedis, redis } from '../config/ioredis'

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

export type OtpScope = 'email_verify' | 'password_reset'

const otpKey = (scope: OtpScope, email: string) => `otp:${scope}:${sha256(email)}`
const triesKey = (scope: OtpScope, email: string) => `otp-tries:${scope}:${sha256(email)}`
const resendKey = (scope: OtpScope, email: string) => `otp-resend:${scope}:${sha256(email)}`

export async function setOtp(scope: OtpScope, email: string, code: string, ttlSec = 600) {
  await ensureRedis()
  const digest = sha256(code)
  const key = otpKey(scope, email)
  const tKey = triesKey(scope, email)
  await redis.set(key, digest, 'EX', ttlSec)
  await redis.set(tKey, '0', 'EX', ttlSec)
}

export async function verifyOtp(scope: OtpScope, email: string, code: string, maxTries = 5) {
  await ensureRedis()
  const key = otpKey(scope, email)
  const tKey = triesKey(scope, email)

  const [stored, triesStr] = await redis.mget(key, tKey)
  if (!stored) return { ok: false, reason: 'expired_or_missing' as const }

  const tries = Number(triesStr ?? '0')
  if (Number.isFinite(maxTries) && tries >= maxTries) {
    return { ok: false, reason: 'too_many_attempts' as const }
  }

  const ok = stored === sha256(code)
  if (!ok) {
    await redis.incr(tKey)
  } else {
    await redis.del(key, tKey)
  }

  return { ok, reason: ok ? ('ok' as const) : ('invalid' as const) }
}

/** 6 digits, 100000–999999 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Limite le nombre d'envois de code sur une fenêtre donnée.
 * Exemple: max 5 envois / heure.
 */
export async function checkOtpResendLimit(
  scope: OtpScope,
  email: string,
  maxPerWindow = 5,
  windowSec = 60 * 60
): Promise<boolean> {
  await ensureRedis()
  const key = resendKey(scope, email)

  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, windowSec)
  }

  return current <= maxPerWindow
}
