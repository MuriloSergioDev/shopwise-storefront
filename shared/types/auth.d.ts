// Session shape for nuxt-auth-utils. `user` reaches the browser; `secure` never leaves the server.
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    roles: Array<'customer' | 'admin'>
  }

  interface SecureSessionData {
    accessToken: string
    /** Epoch milliseconds. */
    accessExpiresAt: number
    refreshToken: string
  }
}

export {}
