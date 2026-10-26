import { describe, expect, it, vi } from 'vitest'
import { createRefreshCoordinator } from '../../server/utils/refresh-coordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const retryable = (error: unknown) => (error as { statusCode?: number }).statusCode !== 401

describe('createRefreshCoordinator', () => {
  it('exchanges a refresh token once for concurrent callers', async () => {
    const coordinator = createRefreshCoordinator<string>({ graceMs: 1000, isRetryable: retryable })
    const pending = deferred<string>()
    const exchange = vi.fn(() => pending.promise)

    const first = coordinator.refresh('r1', exchange)
    const second = coordinator.refresh('r1', exchange)
    pending.resolve('pair-2')

    expect(await Promise.all([first, second])).toEqual(['pair-2', 'pair-2'])
    expect(exchange).toHaveBeenCalledTimes(1)
  })

  it('hands late callers the same result within the grace window, then forgets it', async () => {
    let now = 0
    const coordinator = createRefreshCoordinator<string>({ graceMs: 1000, isRetryable: retryable, now: () => now })
    const exchange = vi.fn(async (token: string) => `after-${token}`)

    await coordinator.refresh('r1', exchange)
    now = 900
    expect(await coordinator.refresh('r1', exchange)).toBe('after-r1')
    expect(exchange).toHaveBeenCalledTimes(1)

    now = 2000
    await coordinator.refresh('r2', exchange)
    expect(coordinator.size).toBe(1)
  })

  it('forgets retryable failures so the next caller tries again', async () => {
    const coordinator = createRefreshCoordinator<string>({ graceMs: 1000, isRetryable: retryable })
    const exchange = vi.fn().mockRejectedValueOnce({ statusCode: 502 }).mockResolvedValueOnce('pair-2')

    await expect(coordinator.refresh('r1', exchange)).rejects.toEqual({ statusCode: 502 })
    expect(await coordinator.refresh('r1', exchange)).toBe('pair-2')
    expect(exchange).toHaveBeenCalledTimes(2)
  })

  it('keeps a definitive rejection for the grace window', async () => {
    const coordinator = createRefreshCoordinator<string>({ graceMs: 1000, isRetryable: retryable })
    const exchange = vi.fn().mockRejectedValue({ statusCode: 401 })

    await expect(coordinator.refresh('r1', exchange)).rejects.toEqual({ statusCode: 401 })
    await expect(coordinator.refresh('r1', exchange)).rejects.toEqual({ statusCode: 401 })
    expect(exchange).toHaveBeenCalledTimes(1)
  })
})
