import crypto from 'crypto'
import { redis } from '../../config/ioredis'
import { env } from '../../config/env'

export type SessionData = {
  userId: string
  createdAt: string
  userAgent?: string
  ip?: string
}

const SESSION_PREFIX = 'sess:'

function makeSessionKey(sessionId: string) {
  return `${SESSION_PREFIX}${sessionId}`
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function createSession(data: SessionData): Promise<string> {
  const sessionId = generateSessionId()
  const key = makeSessionKey(sessionId)
  const ttl = env.SESSION_TTL_SECONDS

  await redis.set(key, JSON.stringify(data), 'EX', ttl)

  return sessionId
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const key = makeSessionKey(sessionId)
  const raw = await redis.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const key = makeSessionKey(sessionId)
  await redis.del(key)
}

export async function touchSession(sessionId: string): Promise<void> {
  const key = makeSessionKey(sessionId)
  const ttl = env.SESSION_TTL_SECONDS
  await redis.expire(key, ttl)
}
