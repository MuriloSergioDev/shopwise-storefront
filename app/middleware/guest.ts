// Sign-in and registration pages are for signed-out visitors only.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (loggedIn.value) {
    return navigateTo('/')
  }
})
