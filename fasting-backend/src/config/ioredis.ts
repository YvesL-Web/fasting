import IORedis, { Redis, RedisOptions } from 'ioredis'
import { env } from './env'

declare global {
  var __REDIS__: Redis | undefined
}

const options: RedisOptions = {
  // Réglages “fail fast” : à conserver si assumé
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,

  connectTimeout: 50_000,
  connectionName: `fasting-backend-${env.NODE_ENV}`,
  noDelay: true,

  retryStrategy(times) {
    const base = Math.min(1000 * 2 ** Math.max(0, times - 1), 30_000)
    const jitter = Math.floor(base * 0.25 * Math.random())
    return base + jitter
  },

  reconnectOnError(err) {
    return !!(err && err.message && /ETIMEDOUT|ECONNRESET/i.test(err.message))
  }
}

const client = globalThis.__REDIS__ || new IORedis(env.REDIS_URL, options)
if (env.NODE_ENV !== 'production') globalThis.__REDIS__ = client

function attachLogsOnce(r: Redis) {
  const key = Symbol.for('ioredis-logs-attached')
  const anyR = r as any
  if (anyR[key]) return
  anyR[key] = true

  r.on('connect', () => console.info('✅ [redis] connect'))
  r.on('ready', () => console.info('🟢 [redis] ready'))
  r.on('reconnecting', (d: number) => console.warn(`🔄 [redis] reconnecting in ${d}ms`))
  r.on('end', () => console.warn('🔚 [redis] end'))
  r.on('error', (e) => console.error(`❌ [redis] error: ${e instanceof Error ? e.message : e}`))
}
attachLogsOnce(client)

export const redis: Redis = client

let ensurePromise: Promise<void> | null = null
export async function ensureRedis(): Promise<void> {
  if (redis.status === 'end' || redis.status === 'close') {
    // Recrée une connexion si nécessaire
    // (si tu préfères lazy, instancie avec { lazyConnect: true } et appelle redis.connect() ici)
    await redis.connect()
  }

  if (redis.status !== 'ready') {
    ensurePromise ||= new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup()
        resolve()
      }
      const onError = (e: unknown) => {
        cleanup()
        reject(e)
      }
      const cleanup = () => {
        ensurePromise = null
        redis.off('ready', onReady)
        redis.off('error', onError as any)
      }
      redis.once('ready', onReady)
      redis.once('error', onError as any)
    })
    await ensurePromise
  }

  // Petit healthcheck borné
  await Promise.race([
    redis.ping(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('PING timeout')), 2_000))
  ])
}

export async function closeRedis(timeoutMs = 2_000): Promise<void> {
  try {
    await Promise.race([
      redis.quit(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('QUIT timeout')), timeoutMs))
    ])
  } catch {
    redis.disconnect()
  }
}
