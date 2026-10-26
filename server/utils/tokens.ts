import type { SecureSessionData } from '#auth-utils'
import type { TokenPair } from '#shared/types/contracts'

export type SessionTokens = NonNullable<SecureSessionData['tokens']>

export function toSessionTokens(pair: TokenPair, now: number): SessionTokens {
  return {
    accessToken: pair.accessToken,
    accessExpiresAt: now + pair.expiresIn * 1000,
    refreshToken: pair.refreshToken,
  }
}
