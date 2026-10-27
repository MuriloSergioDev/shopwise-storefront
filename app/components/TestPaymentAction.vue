<script setup lang="ts">
// Dev only (test-card mode): payments' fake gateway holds a pm_card_threeDSecure2Required payment in requires_action
// like Stripe would. There is no bank challenge to show, so these buttons play the bank: the BFF settles it through
// payments' dev endpoint and the status page picks up the outcome on its next poll.
const props = defineProps<{ checkoutId: string }>()

const busy = ref(false)
const failure = ref<string>()

async function finish(outcome: 'succeeded' | 'failed') {
  busy.value = true
  failure.value = undefined
  try {
    await $fetch(`/api/checkout/${props.checkoutId}/test-payment-action`, { method: 'POST', body: { outcome } })
  } catch (error) {
    failure.value = errorMessageOf(error, 'The test 3-D Secure step could not be finished.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UAlert
    color="info"
    variant="subtle"
    icon="i-lucide-flask-conical"
    title="Test mode: 3-D Secure"
    data-test="test-payment-action"
  >
    <template #description>
      <p class="mb-3">The fake gateway is waiting for the bank. Choose what the bank answers.</p>
      <div class="flex flex-wrap gap-2">
        <UButton label="Complete 3-D Secure" :loading="busy" @click="finish('succeeded')" />
        <UButton label="Fail 3-D Secure" color="neutral" variant="outline" :disabled="busy" @click="finish('failed')" />
      </div>
      <p v-if="failure" class="mt-2 text-sm text-error">{{ failure }}</p>
    </template>
  </UAlert>
</template>
