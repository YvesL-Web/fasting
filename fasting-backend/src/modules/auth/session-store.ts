import crypto from 'crypto'
import { ensureRedis, redis } from '../../config/ioredis'
import { env } from '../../config/env'

const SESSION_TTL_SECONDS = env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7 // 7 jours par défaut
const SESSION_ROTATION_MS = 48 * 60 * 60 * 1000

type SessionData = {
  userId: string
  createdAt: string
  ip?: string | null
  userAgent?: string | null
}

export type SessionInfo = SessionData & {
  id: string
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

export async function listUserSessions(userId: string): Promise<SessionInfo[]> {
  await ensureRedis()
  const ids = await redis.smembers(userSessionsKey(userId))
  if (ids.length === 0) return []

  const multi = redis.multi()
  for (const id of ids) {
    multi.get(sessionKey(id))
  }
  const results = await multi.exec()

  const sessions: SessionInfo[] = []
  results?.forEach((res, idx) => {
    const [err, value] = res as [Error | null, string | null]
    if (err || !value) return
    try {
      const data = JSON.parse(value) as SessionData
      sessions.push({ id: ids[idx], ...data })
    } catch {
      // ignore malformed
    }
  })
  return sessions
}

/**
 * 🔁 Rotation de session si elle est trop vieille.
 *
 * - Si la session a moins de 48h → on renvoie la même.
 * - Si elle a plus de 48h → on crée un nouveau sessionId, copie les données,
 *   met à jour ip/userAgent si fournis, supprime l’ancienne et met à jour le set user-sessions.
 */
export async function rotateSessionIfNeeded(
  sessionId: string,
  session: SessionData,
  meta?: { ip?: string | null; userAgent?: string | null }
): Promise<{ sessionId: string; session: SessionData; rotated: boolean }> {
  const createdAt = new Date(session.createdAt)
  const ageMs = Date.now() - createdAt.getTime()

  // si la date est invalide ou age < 48h → pas de rotation
  if (!Number.isFinite(ageMs) || ageMs < SESSION_ROTATION_MS) {
    return { sessionId, session, rotated: false }
  }

  await ensureRedis()

  const newSessionId = crypto.randomBytes(32).toString('hex')
  const newSession: SessionData = {
    ...session,
    createdAt: new Date().toISOString(),
    ip: meta?.ip ?? session.ip ?? null,
    userAgent: meta?.userAgent ?? session.userAgent ?? null
  }

  const oldKey = sessionKey(sessionId)
  const newKey = sessionKey(newSessionId)
  const userKey = userSessionsKey(session.userId)

  const multi = redis.multi()
  // nouvelle session avec TTL complet
  multi.set(newKey, JSON.stringify(newSession), 'EX', SESSION_TTL_SECONDS)
  // ajouter le nouveau dans l'ensemble de l'utilisateur
  multi.sadd(userKey, newSessionId)
  // retirer l'ancien
  multi.srem(userKey, sessionId)
  // supprimer la clé de l'ancienne session
  multi.del(oldKey)
  // rafraîchir le TTL du set (pas obligatoire mais cohérent)
  multi.expire(userKey, SESSION_TTL_SECONDS)
  await multi.exec()

  return { sessionId: newSessionId, session: newSession, rotated: true }
}
