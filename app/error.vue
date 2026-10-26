<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

useSeoMeta({ title: () => `${props.error.statusMessage ?? 'Something went wrong'} · Shopwise` })
</script>

<template>
  <UApp>
    <UError :error="error" :clear="{ label: 'Back to the store', to: '/' }" />
  </UApp>
</template>
