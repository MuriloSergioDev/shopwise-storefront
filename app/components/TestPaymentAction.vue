<script setup lang="ts">
// Dev only (test-card mode): payments' fake gateway holds a pm_card_threeDSecure2Required payment in requires_action
// like Stripe would. There is no bank challenge to show, so this explains how to finish it locally.
defineProps<{ checkoutId: string }>()
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
      <p>
        The fake gateway is waiting for the 3-D Secure step of checkout <code>{{ checkoutId }}</code
        >. Finish it with the fake gateway (see shopwise-payments' AGENTS.md); this page updates by itself. Left alone,
        the payment is cancelled when it expires.
      </p>
    </template>
  </UAlert>
</template>
