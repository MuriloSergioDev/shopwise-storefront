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
  const toast = useToast()

  // Signing in merges the guest cart and signing out leaves the customer's, so the cart changes with the session.
  async function sessionChanged() {
    await refreshSession()
    await refreshNuxtData('cart')
  }

  // A cart holds 50 lines: guest items that did not fit into the customer cart are named, not silently lost.
  function reportDropped(droppedSkus: string[] | undefined) {
    if (droppedSkus?.length) {
      toast.add({
        title: 'Some items did not fit in your cart',
        description: `Your cart holds up to 50 different items. Not added: ${droppedSkus.join(', ')}.`,
        color: 'warning',
        icon: 'i-lucide-circle-alert',
      })
    }
  }

  async function login(credentials: Credentials) {
    const { meta } = await $fetch('/api/auth/login', { method: 'POST', body: credentials })
    await sessionChanged()
    reportDropped(meta.droppedSkus)
  }

  async function register(registration: Registration) {
    const { meta } = await $fetch('/api/auth/register', { method: 'POST', body: registration })
    await sessionChanged()
    reportDropped(meta.droppedSkus)
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await sessionChanged()
  }

  return { loggedIn, user, login, register, logout }
}
