<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const links: NavigationMenuItem[] = [{ label: 'Products', to: '/products' }]
</script>

<template>
  <div>
    <UHeader title="Shopwise" to="/">
      <UNavigationMenu :items="links" />

      <template #right>
        <SearchInput class="hidden md:block" />
        <CartButton />
        <UserMenu />
      </template>

      <template #body>
        <SearchInput class="mb-4" />
        <UNavigationMenu :items="links" orientation="vertical" />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">Shopwise demo store. Nothing here is for sale.</p>
      </template>
    </UFooter>
  </div>
</template>
