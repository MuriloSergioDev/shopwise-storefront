// Session shape for nuxt-auth-utils. `user` reaches the browser; `secure` never leaves the server.
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    roles: Array<'customer' | 'admin'>
  }

  interface SecureSessionData {
    /** Set while a customer is signed in. `accessExpiresAt` is epoch milliseconds. */
    tokens?: { accessToken: string; accessExpiresAt: number; refreshToken: string }
    /**
     * A guest cart: reachable by its id alone, so the id is a secret and stays here. Kept after sign-in only while
     * merging it into the customer's cart has not succeeded yet.
     */
    guestCartId?: string
  }
}

export {}
