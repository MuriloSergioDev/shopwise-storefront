<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })
useSeoMeta({ title: 'Sign in · Shopwise' })

const { login } = useAuth()
const route = useRoute()
const errorMessage = ref<string>()

const fields: AuthFormField[] = [
  { name: 'email', type: 'email', label: 'Email', placeholder: 'you@example.com', required: true },
  { name: 'password', type: 'password', label: 'Password', required: true },
]

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof schema>>) {
  errorMessage.value = undefined
  try {
    await login(data)
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (error) {
    errorMessage.value = errorMessageOf(error, 'Sign in failed. Try again.')
  }
}
</script>

<template>
  <UContainer class="flex justify-center py-16">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        title="Sign in"
        icon="i-lucide-log-in"
        :submit="{ label: 'Sign in' }"
        @submit="onSubmit"
      >
        <template #description>
          New here? <ULink to="/register" class="font-medium text-primary">Create an account</ULink>
        </template>
        <template #validation>
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
          />
        </template>
      </UAuthForm>
    </UPageCard>
  </UContainer>
</template>
