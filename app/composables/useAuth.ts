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

  async function login(credentials: Credentials) {
    await $fetch('/api/auth/login', { method: 'POST', body: credentials })
    await refreshSession()
  }

  async function register(registration: Registration) {
    await $fetch('/api/auth/register', { method: 'POST', body: registration })
    await refreshSession()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await refreshSession()
  }

  return { loggedIn, user, login, register, logout }
}
