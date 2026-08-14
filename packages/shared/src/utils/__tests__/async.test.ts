/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    calculateBackoff,
    deferToNextCycle,
    mapWithConcurrency,
    withTimeout,
} from '../async'

describe('deferToNextCycle', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('defers execution to the next event loop cycle', async () => {
        const callback = vi.fn()
        deferToNextCycle(callback)

        expect(callback).not.toHaveBeenCalled()

        await vi.runAllTimersAsync()

        expect(callback).toHaveBeenCalled()
    })

    it('resolves the promise with the callback return value', async () => {
        const callback = vi.fn().mockReturnValue('result')
        const promise = deferToNextCycle(callback)

        await vi.runAllTimersAsync()

        const result = await promise
        expect(result).toBe('result')
        expect(callback).toHaveBeenCalled()
    })

    it('resolves the promise wrapping an async callback', async () => {
        const callback = vi.fn().mockResolvedValue('async-result')
        const promise = deferToNextCycle(callback)

        await vi.runAllTimersAsync()

        const result = await promise
        expect(result).toBe('async-result')
        expect(callback).toHaveBeenCalled()
    })

    it('rejects the promise if the callback throws', async () => {
        const error = new Error('test-error')
        const callback = vi.fn().mockImplementation(() => {
            throw error
        })

        // Catch the rejection as soon as it happens to avoid unhandled rejection warnings
        const promiseResult = deferToNextCycle(callback).catch(err => err)

        await vi.runAllTimersAsync()

        const caughtError = await promiseResult
        expect(caughtError).toBe(error)
        expect(callback).toHaveBeenCalled()
    })

    it('rejects the promise if the async callback rejects', async () => {
        const error = new Error('test-async-error')
        const callback = vi.fn().mockRejectedValue(error)

        // Catch the rejection as soon as it happens to avoid unhandled rejection warnings
        const promiseResult = deferToNextCycle(callback).catch(err => err)

        await vi.runAllTimersAsync()

        const caughtError = await promiseResult
        expect(caughtError).toBe(error)
        expect(callback).toHaveBeenCalled()
    })

    it('supports a custom delay', async () => {
        const callback = vi.fn()
        const delay = 500
        deferToNextCycle(callback, delay)

        vi.advanceTimersByTime(250)
        expect(callback).not.toHaveBeenCalled()

        vi.advanceTimersByTime(250)
        await vi.runAllTimersAsync()

        expect(callback).toHaveBeenCalled()
    })

    it('works as a sleep function when no callback is provided', async () => {
        const delay = 500
        const promise = deferToNextCycle(delay)

        vi.advanceTimersByTime(250)
        let resolved = false
        promise.then(() => {
            resolved = true
        })

        await Promise.resolve() // handle microtasks
        expect(resolved).toBe(false)

        vi.advanceTimersByTime(250)
        await vi.runAllTimersAsync()
        await promise

        expect(true).toBe(true) // Promise should have resolved
    })
})

describe('calculateBackoff', () => {
    it('doubles the interval by default', () => {
        expect(calculateBackoff(1000)).toBe(2000)
    })

    it('honors a custom multiplier', () => {
        expect(calculateBackoff(500, 3)).toBe(1500)
    })

    it('caps at the default maxInterval (30s)', () => {
        expect(calculateBackoff(20000)).toBe(30000)
    })

    it('honors a custom maxInterval', () => {
        expect(calculateBackoff(4000, 2, 5000)).toBe(5000)
    })
})

describe('withTimeout', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('resolves with the underlying promise value when it settles in time', async () => {
        const promise = withTimeout(Promise.resolve('ok'), 1000, 'op')
        await expect(promise).resolves.toBe('ok')
    })

    it('rejects with the default error after the timeout elapses', async () => {
        const pending = new Promise<string>(() => {})
        const wrapped = withTimeout(pending, 500, 'op').catch(error => error)

        await vi.advanceTimersByTimeAsync(500)

        const error = await wrapped
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('op timed out after 500ms')
    })

    it('uses a custom rejectWith factory when provided', async () => {
        class TimeoutError extends Error {
            constructor(
                public op: string,
                public ms: number,
            ) {
                super(`custom: ${op}/${ms}`)
            }
        }
        const pending = new Promise<string>(() => {})
        const wrapped = withTimeout(
            pending,
            250,
            'fetch',
            (op, ms) => new TimeoutError(op, ms),
        ).catch(error => error)

        await vi.advanceTimersByTimeAsync(250)

        const error = await wrapped
        expect(error).toBeInstanceOf(TimeoutError)
        expect((error as TimeoutError).op).toBe('fetch')
        expect((error as TimeoutError).ms).toBe(250)
    })

    it('clears the timer when the promise settles before timeout', async () => {
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout')

        await withTimeout(Promise.resolve('done'), 10000, 'op')

        expect(clearSpy).toHaveBeenCalled()
    })

    it('forwards rejections from the wrapped promise', async () => {
        const wrappedError = new Error('wrapped failed')
        await expect(
            withTimeout(Promise.reject(wrappedError), 1000, 'op'),
        ).rejects.toBe(wrappedError)
    })
})

describe('mapWithConcurrency', () => {
    /**
     * Mappers that block until released, so the test controls exactly when a
     * worker is free to claim its next item. `started` is the ground truth for
     * how many ran concurrently.
     */
    const gatedMapper = () => {
        const started: number[] = []
        const release: Array<() => void> = []
        const mapper = (item: number) => {
            started.push(item)
            return new Promise<number>(resolve => {
                release.push(() => resolve(item * 2))
            })
        }
        return {
            mapper,
            started,
            /** Release the oldest `count` in-flight mappers. */
            releaseNext: async (count: number) => {
                for (let i = 0; i < count; i++) release.shift()?.()
                // Let the freed workers claim their next item.
                await new Promise(resolve => setTimeout(resolve, 0))
            },
            /**
             * Release everything, including the replacements each release
             * admits — releasing only the currently-in-flight set would strand
             * the workers that pick up after it.
             */
            drain: async () => {
                while (release.length > 0) {
                    for (const resolve of release.splice(0, release.length)) {
                        resolve()
                    }
                    await new Promise(resolve => setTimeout(resolve, 0))
                }
            },
        }
    }

    // Asserts the exact ceiling in both directions: `<= limit` alone would also
    // pass a fully sequential implementation, which is the bug most likely to
    // hide here.
    it('saturates the limit and never exceeds it', async () => {
        const items = Array.from({ length: 20 }, (_, i) => i)
        const { mapper, started, releaseNext, drain } = gatedMapper()

        const pending = mapWithConcurrency(items, 3, mapper)
        await new Promise(resolve => setTimeout(resolve, 0))

        // Exactly the limit is in flight, and nothing more can start until one
        // of them settles.
        expect(started).toHaveLength(3)

        // Each completion admits exactly one replacement — never a burst.
        await releaseNext(1)
        expect(started).toHaveLength(4)
        await releaseNext(2)
        expect(started).toHaveLength(6)

        await drain()
        await pending
        expect(started).toHaveLength(20)
    })

    it('runs every item exactly once', async () => {
        const items = Array.from({ length: 20 }, (_, i) => i)
        const seen: number[] = []

        await mapWithConcurrency(items, 3, async item => {
            seen.push(item)
            return item
        })

        expect(seen).toHaveLength(20)
        expect(new Set(seen)).toEqual(new Set(items))
    })

    it('runs everything concurrently when the limit exceeds the item count', async () => {
        const { mapper, started } = gatedMapper()

        void mapWithConcurrency([1, 2, 3], 10, mapper)
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(started).toHaveLength(3)
    })

    // Callers map a result index back to its input to report which subject
    // failed, so drifting order would misattribute failures.
    it('aligns results positionally with the input, not with completion order', async () => {
        const results = await mapWithConcurrency(
            [10, 20, 30],
            2,
            async item => {
                // Invert the delay so completion order reverses input order.
                await new Promise(resolve => setTimeout(resolve, 30 - item))
                return item
            },
        )

        expect(results).toEqual([
            { status: 'fulfilled', value: 10 },
            { status: 'fulfilled', value: 20 },
            { status: 'fulfilled', value: 30 },
        ])
    })

    it('isolates a rejection without failing the batch', async () => {
        const boom = new Error('boom')

        const results = await mapWithConcurrency([1, 2, 3], 2, async item => {
            if (item === 2) throw boom
            return item
        })

        expect(results).toEqual([
            { status: 'fulfilled', value: 1 },
            { status: 'rejected', reason: boom },
            { status: 'fulfilled', value: 3 },
        ])
    })

    it('returns an empty array without invoking the mapper', async () => {
        const mapper = vi.fn()

        expect(await mapWithConcurrency([], 4, mapper)).toEqual([])
        expect(mapper).not.toHaveBeenCalled()
    })

    // A limit computed from config could arrive as 0; flooring at 1 keeps that
    // from hanging forever with no worker to drain the queue.
    it.each([0, -1])('still drains when the limit is %i', async limit => {
        const results = await mapWithConcurrency([1, 2], limit, async i => i)

        expect(results).toEqual([
            { status: 'fulfilled', value: 1 },
            { status: 'fulfilled', value: 2 },
        ])
    })
})
