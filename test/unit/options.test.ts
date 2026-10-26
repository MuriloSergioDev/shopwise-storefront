import { describe, expect, it } from 'vitest'
import { findVariant, optionValues } from '../../app/utils/options'
import { safeRedirect } from '../../app/utils/navigation'

const variant = (sku: string, options: Record<string, string>) => ({ id: sku, sku, name: sku, options, active: true })

const variants = [
  variant('TEE-BLK-M', { color: 'Black', size: 'M' }),
  variant('TEE-BLK-L', { color: 'Black', size: 'L' }),
  variant('TEE-NVY-M', { color: 'Navy', size: 'M' }),
]

describe('variant options', () => {
  it('lists each option name with its distinct values in order', () => {
    expect(optionValues(variants)).toEqual({ color: ['Black', 'Navy'], size: ['M', 'L'] })
  })

  it('finds the variant matching every selected option', () => {
    expect(findVariant(variants, { color: 'Navy', size: 'M' })?.sku).toBe('TEE-NVY-M')
    expect(findVariant(variants, { color: 'Navy', size: 'L' })).toBeUndefined()
  })

  it('treats a product without options as one variant', () => {
    const single = [variant('SKILLET', {})]

    expect(optionValues(single)).toEqual({})
    expect(findVariant(single, {})?.sku).toBe('SKILLET')
  })
})

describe('safeRedirect', () => {
  it('only allows same-site paths', () => {
    expect(safeRedirect('/products?q=tee')).toBe('/products?q=tee')
    expect(safeRedirect('//evil.example')).toBe('/')
    expect(safeRedirect('https://evil.example')).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
  })
})
