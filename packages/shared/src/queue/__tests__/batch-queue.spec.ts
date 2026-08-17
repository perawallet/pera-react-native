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

import { describe, it, expect, vi } from 'vitest'
import { BatchQueue } from '../batch-queue'

const wait = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms))

describe('BatchQueue', () => {
    it('coalesces concurrent enqueues for the same partition into one executor call', async () => {
        const executor = vi.fn().mockResolvedValue(
            new Map([
                ['a', 1],
                ['b', 2],
                ['c', 3],
            ]),
        )
        const queue = new BatchQueue<string, number, string>(executor)

        const [a, b, c] = await Promise.all([
            queue.enqueue('a', 'main'),
            queue.enqueue('b', 'main'),
            queue.enqueue('c', 'main'),
        ])

        expect(executor).toHaveBeenCalledTimes(1)
        const [keys, partition] = executor.mock.calls[0]
        expect(new Set(keys)).toEqual(new Set(['a', 'b', 'c']))
        expect(partition).toBe('main')
        expect(a).toBe(1)
        expect(b).toBe(2)
        expect(c).toBe(3)
    })

    it('deduplicates concurrent enqueues for the same key but resolves all waiters', async () => {
        const executor = vi.fn().mockResolvedValue(new Map([['a', 42]]))
        const queue = new BatchQueue<string, number, string>(executor)

        const results = await Promise.all([
            queue.enqueue('a', 'main'),
            queue.enqueue('a', 'main'),
            queue.enqueue('a', 'main'),
        ])

        expect(executor).toHaveBeenCalledTimes(1)
        const [keys] = executor.mock.calls[0]
        expect(keys).toEqual(['a'])
        expect(results).toEqual([42, 42, 42])
    })

    it('isolates partitions: different partitions trigger separate executor calls', async () => {
        const executor = vi
            .fn()
            .mockImplementation(async (keys: string[], partition: string) => {
                return new Map(keys.map(k => [k, `${partition}:${k}`]))
            })
        const queue = new BatchQueue<string, string, string>(executor)

        const [main, test] = await Promise.all([
            queue.enqueue('a', 'main'),
            queue.enqueue('a', 'test'),
        ])

        expect(executor).toHaveBeenCalledTimes(2)
        const partitions = executor.mock.calls.map(c => c[1]).sort()
        expect(partitions).toEqual(['main', 'test'])
        expect(main).toBe('main:a')
        expect(test).toBe('test:a')
    })

    it('resolves waiters with undefined for keys missing from the executor result', async () => {
        const executor = vi.fn().mockResolvedValue(new Map([['a', 1]]))
        const queue = new BatchQueue<string, number, string>(executor)

        const [a, b] = await Promise.all([
            queue.enqueue('a', 'main'),
            queue.enqueue('b', 'main'),
        ])

        expect(a).toBe(1)
        expect(b).toBeUndefined()
    })

    it('rejects every waiter when the executor throws', async () => {
        const executor = vi.fn().mockRejectedValue(new Error('boom'))
        const queue = new BatchQueue<string, number, string>(executor)

        await expect(queue.enqueue('a', 'main')).rejects.toThrow('boom')
        await expect(queue.enqueue('b', 'main')).rejects.toThrow('boom')
    })

    it('starts a new batch after the previous one drains', async () => {
        const executor = vi.fn().mockImplementation(async (keys: string[]) => {
            return new Map(keys.map(k => [k, k.toUpperCase()]))
        })
        const queue = new BatchQueue<string, string, string>(executor)

        const first = await queue.enqueue('a', 'main')
        const second = await queue.enqueue('b', 'main')

        expect(executor).toHaveBeenCalledTimes(2)
        expect(first).toBe('A')
        expect(second).toBe('B')
    })

    it('supports void partition for unscoped queues', async () => {
        const executor = vi.fn().mockResolvedValue(new Map([['k', 'v']]))
        const queue = new BatchQueue<string, string>(executor)

        const value = await queue.enqueue('k', undefined as void)
        expect(value).toBe('v')
        expect(executor).toHaveBeenCalledTimes(1)
    })

    it('coalesces enqueues that arrive within the configured delay window', async () => {
        // The classic use case: two enqueues separated by a few ms (e.g.
        // React commits or async cache lookups) should still merge into
        // one executor call as long as both land within `delayMs`.
        const executor = vi.fn().mockImplementation(async (keys: string[]) => {
            return new Map(keys.map(k => [k, k.toUpperCase()]))
        })
        const queue = new BatchQueue<string, string, string>(executor, 50)

        const p1 = queue.enqueue('a', 'main')
        await wait(20) // less than 50ms delay
        const p2 = queue.enqueue('b', 'main')

        const [a, b] = await Promise.all([p1, p2])

        expect(executor).toHaveBeenCalledTimes(1)
        const [keys] = executor.mock.calls[0]
        expect(new Set(keys)).toEqual(new Set(['a', 'b']))
        expect(a).toBe('A')
        expect(b).toBe('B')
    })

    it('starts a new batch for enqueues that arrive AFTER the delay window', async () => {
        const executor = vi.fn().mockImplementation(async (keys: string[]) => {
            return new Map(keys.map(k => [k, k.toUpperCase()]))
        })
        const queue = new BatchQueue<string, string, string>(executor, 20)

        const a = await queue.enqueue('a', 'main')
        await wait(40)
        const b = await queue.enqueue('b', 'main')

        expect(executor).toHaveBeenCalledTimes(2)
        expect(a).toBe('A')
        expect(b).toBe('B')
    })

    it('processes enqueues that arrive while the executor is running in a follow-up batch', async () => {
        // While runBatch is awaiting the executor, new enqueues land in the
        // fresh `current` bucket. After the first batch settles, the queue
        // schedules another flush for the new bucket.
        let resolveFirst!: (results: Map<string, string>) => void
        const executor = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<Map<string, string>>(resolve => {
                        resolveFirst = resolve
                    }),
            )
            .mockImplementationOnce(async (keys: string[]) => {
                return new Map(keys.map(k => [k, k.toUpperCase()]))
            })
        const queue = new BatchQueue<string, string, string>(executor, 0)

        const first = queue.enqueue('a', 'main')
        await wait(5) // let the first batch start

        // Second enqueue arrives during the first executor's await
        const second = queue.enqueue('b', 'main')

        // Resolve the first batch
        resolveFirst(new Map([['a', 'A']]))

        const [a, b] = await Promise.all([first, second])
        expect(a).toBe('A')
        expect(b).toBe('B')
        expect(executor).toHaveBeenCalledTimes(2)
        // Second call should contain only 'b'
        expect(executor.mock.calls[1][0]).toEqual(['b'])
    })
})

describe('BatchQueue debounce', () => {
    const upperExecutor = () =>
        vi
            .fn()
            .mockImplementation(
                async (keys: string[]) =>
                    new Map(keys.map(k => [k, k.toUpperCase()])),
            )

    it('defers dispatch while enqueues keep arriving', async () => {
        const executor = upperExecutor()
        const queue = new BatchQueue<string, string, string>(executor, {
            delayMs: 30,
            debounce: true,
        })

        const pending = [queue.enqueue('a', 'main')]
        // Each step is shorter than delayMs, so a fixed window would have
        // dispatched partway through; debouncing must not.
        for (const key of ['b', 'c', 'd']) {
            await wait(15)
            pending.push(queue.enqueue(key, 'main'))
            expect(executor).not.toHaveBeenCalled()
        }

        await Promise.all(pending)

        expect(executor).toHaveBeenCalledTimes(1)
        expect(new Set(executor.mock.calls[0][0])).toEqual(
            new Set(['a', 'b', 'c', 'd']),
        )
    })

    it('dispatches once the enqueues stop', async () => {
        const executor = upperExecutor()
        const queue = new BatchQueue<string, string, string>(executor, {
            delayMs: 20,
            debounce: true,
        })

        const value = await queue.enqueue('a', 'main')

        expect(value).toBe('A')
        expect(executor).toHaveBeenCalledTimes(1)
    })

    it('dispatches immediately at maxBatchSize without waiting out the timer', async () => {
        const executor = upperExecutor()
        const queue = new BatchQueue<string, string, string>(executor, {
            // Long enough that a timer-driven dispatch would fail the test.
            delayMs: 5000,
            debounce: true,
            maxBatchSize: 3,
        })

        const results = await Promise.all([
            queue.enqueue('a', 'main'),
            queue.enqueue('b', 'main'),
            queue.enqueue('c', 'main'),
        ])

        expect(executor).toHaveBeenCalledTimes(1)
        expect(results).toEqual(['A', 'B', 'C'])
    })

    // The starvation case debounce alone cannot handle: enqueues arriving
    // slightly faster than delayMs restart the timer forever, and a count cap
    // never trips because the batch stays small.
    it('dispatches at maxWaitMs even while enqueues keep arriving', async () => {
        const executor = upperExecutor()
        const queue = new BatchQueue<string, string, string>(executor, {
            delayMs: 30,
            debounce: true,
            maxWaitMs: 60,
            maxBatchSize: 100,
        })

        queue.enqueue('a', 'main')
        for (const key of ['b', 'c', 'd', 'e', 'f']) {
            await wait(20)
            queue.enqueue(key, 'main')
        }

        expect(executor).toHaveBeenCalled()
    })

    // maxWaitMs is measured per window; a fresh window must get the full
    // budget rather than inheriting the previous window's spent one.
    it('gives each window its own maxWait budget', async () => {
        const executor = upperExecutor()
        const queue = new BatchQueue<string, string, string>(executor, {
            delayMs: 20,
            debounce: true,
            maxWaitMs: 50,
        })

        await queue.enqueue('a', 'main')
        expect(executor).toHaveBeenCalledTimes(1)

        // Second window: still debounced, so an enqueue inside delayMs
        // coalesces rather than dispatching instantly.
        const second = queue.enqueue('b', 'main')
        await wait(10)
        const third = queue.enqueue('c', 'main')
        await Promise.all([second, third])

        expect(executor).toHaveBeenCalledTimes(2)
        expect(new Set(executor.mock.calls[1][0])).toEqual(new Set(['b', 'c']))
    })

    it('keeps the positional delayMs form working', async () => {
        const executor = upperExecutor()
        const queue = new BatchQueue<string, string, string>(executor, 10)

        expect(await queue.enqueue('a', 'main')).toBe('A')
        expect(executor).toHaveBeenCalledTimes(1)
    })
})
