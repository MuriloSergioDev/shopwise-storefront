import { describe, expect, it } from 'vitest'
import { toSessionTokens } from '../../server/utils/tokens'

describe('toSessionTokens', () => {
  it('stores the access token expiry as an absolute time', () => {
    const pair = {
      tokenType: 'Bearer' as const,
      accessToken: 'access',
      expiresIn: 900,
      refreshToken: 'refresh',
      refreshExpiresIn: 2_592_000,
    }

    expect(toSessionTokens(pair, 1_000)).toEqual({
      accessToken: 'access',
      accessExpiresAt: 901_000,
      refreshToken: 'refresh',
    })
  })
})
