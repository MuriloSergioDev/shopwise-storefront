<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { loggedIn, user, logout } = useAuth()
const toast = useToast()
const route = useRoute()

async function signOut() {
  await logout()
  toast.add({ title: 'Signed out', icon: 'i-lucide-log-out' })
  await navigateTo('/')
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <UDropdownMenu v-if="loggedIn && user" :items="items">
    <UButton color="neutral" variant="ghost" icon="i-lucide-user" :label="user.name" />
  </UDropdownMenu>
  <UButton
    v-else
    :to="{ path: '/login', query: { redirect: route.fullPath } }"
    color="neutral"
    variant="ghost"
    icon="i-lucide-log-in"
    label="Sign in"
  />
</template>
