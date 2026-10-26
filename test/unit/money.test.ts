import { describe, expect, it } from 'vitest'
import { formatMoney } from '../../shared/utils/money'

describe('formatMoney', () => {
  it('formats minor units with the currency symbol', () => {
    expect(formatMoney(4500, 'USD')).toBe('$45.00')
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56')
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })

  it('uses the currency’s own number of decimals', () => {
    expect(formatMoney(500, 'JPY')).toBe('¥500')
  })
})
