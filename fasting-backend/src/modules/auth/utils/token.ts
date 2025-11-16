import crypto from 'crypto'
import argon2 from 'argon2'

export const generateRandomToken = (lengthBytes = 32): string => {
  return crypto.randomBytes(lengthBytes).toString('hex')
}

export const hashToken = (token: string): Promise<string> => {
  return argon2.hash(token)
}

export const verifyTokenHash = (hash: string, token: string): Promise<boolean> => {
  return argon2.verify(hash, token)
}
