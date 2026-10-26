<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })
useSeoMeta({ title: 'Create account · Shopwise' })

const { register } = useAuth()
const errorMessage = ref<string>()

const fields: AuthFormField[] = [
  { name: 'name', type: 'text', label: 'Name', required: true },
  { name: 'email', type: 'email', label: 'Email', placeholder: 'you@example.com', required: true },
  { name: 'password', type: 'password', label: 'Password', required: true },
]

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
})

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof schema>>) {
  errorMessage.value = undefined
  try {
    await register(data)
    await navigateTo('/')
  } catch (error) {
    errorMessage.value = errorMessageOf(error, 'Registration failed. Try again.')
  }
}
</script>

<template>
  <UContainer class="flex justify-center py-16">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        title="Create an account"
        icon="i-lucide-user-plus"
        :submit="{ label: 'Create account' }"
        @submit="onSubmit"
      >
        <template #description>
          Already have one? <ULink to="/login" class="font-medium text-primary">Sign in</ULink>
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
