export type SessionRecord = {
  id: string
  userId: string

  createdAt: string // ISO
  lastSeenAt: string // ISO

  ip: string | null
  userAgent: string | null

  revoked: boolean
  revokedAt?: string | null
  revokedReason?: string | null

  rotatedFrom?: string | null
  rotatedAt?: string | null
}
