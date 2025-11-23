// src/modules/auth/session-store.ts
import crypto from 'crypto'
import { ensureRedis, redis } from '../../config/ioredis'
import { env } from '../../config/env'

const SESSION_TTL_SECONDS = env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7 // 7 jours par défaut

type SessionData = {
  userId: string
  createdAt: string
  // optionnel: tu peux rajouter ip, userAgent, etc.
  ip?: string | null
  userAgent?: string | null
}

const sessionKey = (id: string) => `session:${id}`
const userSessionsKey = (userId: string) => `user-sessions:${userId}`

export async function createSession(
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null }
): Promise<string> {
  await ensureRedis()

  const sessionId = crypto.randomBytes(32).toString('hex')
  const data: SessionData = {
    userId,
    createdAt: new Date().toISOString(),
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent ?? null
  }

  const key = sessionKey(sessionId)
  const userKey = userSessionsKey(userId)

  // on peut tout faire en pipeline
  const multi = redis.multi()
  multi.set(key, JSON.stringify(data), 'EX', SESSION_TTL_SECONDS)
  multi.sadd(userKey, sessionId)
  multi.expire(userKey, SESSION_TTL_SECONDS) // pour ne pas garder le set éternellement
  await multi.exec()

  return sessionId
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  await ensureRedis()
  const json = await redis.get(sessionKey(sessionId))
  if (!json) return null
  try {
    return JSON.parse(json) as SessionData
  } catch {
    return null
  }
}

export async function destroySession(sessionId: string): Promise<void> {
  await ensureRedis()
  const key = sessionKey(sessionId)
  const json = await redis.get(key)
  if (!json) {
    await redis.del(key)
    return
  }

  let userId: string | null = null
  try {
    const data = JSON.parse(json) as SessionData
    userId = data.userId
  } catch {
    // on ignore
  }

  const multi = redis.multi()
  multi.del(key)
  if (userId) {
    multi.srem(userSessionsKey(userId), sessionId)
  }
  await multi.exec()
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await ensureRedis()
  const userKey = userSessionsKey(userId)
  const sessionIds = await redis.smembers(userKey)
  if (sessionIds.length === 0) {
    await redis.del(userKey)
    return
  }

  const multi = redis.multi()
  for (const id of sessionIds) {
    multi.del(sessionKey(id))
  }
  multi.del(userKey)
  await multi.exec()
}
