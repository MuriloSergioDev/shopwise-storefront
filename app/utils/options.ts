import type { Variant } from '#shared/types/contracts'

/** Option names with their distinct values, in the order the variants list them. */
export function optionValues(variants: Variant[]): Record<string, string[]> {
  const values: Record<string, string[]> = {}
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.options)) {
      const list = (values[name] ??= [])
      if (!list.includes(value)) {
        list.push(value)
      }
    }
  }

  return values
}

/** The variant whose options match every selected value, if there is exactly that combination. */
export function findVariant(variants: Variant[], selected: Record<string, string>): Variant | undefined {
  return variants.find((variant) => Object.entries(variant.options).every(([name, value]) => selected[name] === value))
}

export function optionLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}
