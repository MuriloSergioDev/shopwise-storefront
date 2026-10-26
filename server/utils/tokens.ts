import type { SecureSessionData } from '#auth-utils'
import type { TokenPair } from '#shared/types/contracts'

export function toSessionTokens(pair: TokenPair, now: number): SecureSessionData {
  return {
    accessToken: pair.accessToken,
    accessExpiresAt: now + pair.expiresIn * 1000,
    refreshToken: pair.refreshToken,
  }
}
