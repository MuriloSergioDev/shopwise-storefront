import { describe, expect, it } from 'vitest'
import { toProductSearchQuery } from '../../server/utils/product-search'

describe('toProductSearchQuery', () => {
  it('passes known filters and option filters through to catalog', () => {
    expect(
      toProductSearchQuery({ q: ' tee ', category: 'tops', page: '2', perPage: '12', 'options[color]': 'Black' }),
    ).toEqual({ q: 'tee', category: 'tops', page: 2, perPage: 12, 'options[color]': 'Black' })
  })

  it('drops empty values and unknown keys', () => {
    expect(toProductSearchQuery({ q: '', category: '', 'options[size]': '', sort: 'price', debug: '1' })).toEqual({})
  })

  it('ignores option names catalog would not accept', () => {
    expect(toProductSearchQuery({ 'options[Color]': 'Black', 'options[a b]': 'x', 'options[]': 'y' })).toEqual({})
  })

  it('rejects out-of-range paging and oversized queries', () => {
    expect(() => toProductSearchQuery({ perPage: '100' })).toThrow()
    expect(() => toProductSearchQuery({ page: '0' })).toThrow()
    expect(() => toProductSearchQuery({ q: 'x'.repeat(101) })).toThrow()
    expect(() => toProductSearchQuery({ 'options[color]': 'x'.repeat(51) })).toThrow()
  })
})
