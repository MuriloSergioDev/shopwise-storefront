import { describe, expect, it } from 'vitest'
import { failureMessage, isFinal, isPlaced, stepLabel } from '../../shared/utils/checkout'

describe('checkout helpers', () => {
  it('treats completed and failed as final', () => {
    expect(isFinal({ status: 'completed' })).toBe(true)
    expect(isFinal({ status: 'failed' })).toBe(true)
    expect(isFinal({ status: 'compensating' })).toBe(false)
    expect(isFinal({ status: 'paying' })).toBe(false)
  })

  it('counts the order as placed once it exists, before the cart is closed', () => {
    expect(isPlaced({ status: 'closing_cart', orderId: '01order' })).toBe(true)
    expect(isPlaced({ status: 'completed', orderId: '01order' })).toBe(true)
    expect(isPlaced({ status: 'placing_order', orderId: null })).toBe(false)
  })

  it("uses payments' message for a declined card", () => {
    expect(
      failureMessage({
        failureReason: 'payment_failed',
        paymentFailure: { reason: 'card_declined', message: 'Your card was declined.' },
      }),
    ).toBe('Your card was declined. You have not been charged.')
    expect(failureMessage({ failureReason: 'payment_failed', paymentFailure: null })).toBe(
      'Your payment was declined. You have not been charged.',
    )
  })

  it('words every other failure and says nothing while there is none', () => {
    expect(failureMessage({ failureReason: 'out_of_stock' })).toMatch(/sold out/)
    expect(failureMessage({ failureReason: 'timeout' })).toMatch(/refunded/)
    expect(failureMessage({ failureReason: null })).toBeNull()
    expect(stepLabel('paying')).toBe('Taking payment…')
  })
})
