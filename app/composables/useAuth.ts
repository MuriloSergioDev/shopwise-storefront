interface Credentials {
  email: string
  password: string
}

interface Registration extends Credentials {
  name: string
}

/** Sign-in state plus the actions that change it. Tokens stay in the BFF's sealed cookie; the browser sees `user`. */
export function useAuth() {
  const { loggedIn, user, fetch: refreshSession } = useUserSession()

  // Signing in merges the guest cart and signing out leaves the customer's, so the cart changes with the session.
  async function sessionChanged() {
    await refreshSession()
    await refreshNuxtData('cart')
  }

  async function login(credentials: Credentials) {
    await $fetch('/api/auth/login', { method: 'POST', body: credentials })
    await sessionChanged()
  }

  async function register(registration: Registration) {
    await $fetch('/api/auth/register', { method: 'POST', body: registration })
    await sessionChanged()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await sessionChanged()
  }

  return { loggedIn, user, login, register, logout }
}
