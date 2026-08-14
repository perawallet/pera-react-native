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

import type { Nullable, Optional } from '../utils/types'

/**
 * Must return a Map of per-key results so the queue can resolve each waiter
 * individually. An absent key resolves its waiters with `undefined`, so an
 * executor can omit "not found" entries naturally.
 */
export type BatchExecutor<TKey, TResult, TPartition> = (
    keys: TKey[],
    partition: TPartition,
) => Promise<Map<TKey, TResult>>

type Waiter<TResult> = {
    resolve: (value: Optional<TResult>) => void
    reject: (error: unknown) => void
}

/** A bucket of keys + their waiters, grouped by partition. */
type Bucket<TKey, TResult, TPartition> = Map<
    TPartition,
    Map<TKey, Waiter<TResult>[]>
>

export type BatchQueueOptions = {
    /** Quiet period (or fixed window, when `debounce` is off) before dispatch. */
    delayMs?: number
    /**
     * Restart the timer on every enqueue, so a continuous stream of enqueues
     * dispatches once when it settles instead of once per `delayMs`. Trades
     * latency for far fewer dispatches — suitable when the result is
     * non-critical. Bound it with `maxWaitMs`.
     */
    debounce?: boolean
    /**
     * Dispatch immediately once any one partition holds this many distinct
     * keys, regardless of the timer. Size it to whatever the executor can
     * serve in a single call.
     */
    maxBatchSize?: number
    /**
     * Ceiling on how long `debounce` may defer a dispatch, measured from the
     * window's first enqueue. Without it, enqueues arriving slightly faster
     * than `delayMs` restart the timer indefinitely and nothing ever
     * dispatches. Ignored when `debounce` is off.
     */
    maxWaitMs?: number
}

/**
 * Groups keys enqueued close together into one dispatch. When the timer fires
 * the filled bucket is swapped aside for its executor to run (one call per
 * partition) while new enqueues accumulate in a fresh bucket, which schedules
 * the next round once the previous settles.
 *
 * By default the first enqueue starts a fixed `delayMs` window. With
 * `debounce`, each enqueue restarts it instead — see {@link BatchQueueOptions}.
 *
 * A key enqueued twice in one window dedups to a single fetch with multiple
 * waiters. Across adjacent windows it's two fetches, by design — widen the
 * window for longer dedup.
 *
 * Partitions suit a segmented API: NFD lookups are per-network, so different
 * networks fire separate executor calls in the same flush. Leave `TPartition`
 * defaulted for un-partitioned use.
 */
export class BatchQueue<TKey, TResult, TPartition = void> {
    private current: Bucket<TKey, TResult, TPartition> = new Map()
    private timer: Nullable<ReturnType<typeof setTimeout>> = null
    /** Start of the open window, for the `maxWaitMs` ceiling. */
    private windowStartedAt: Nullable<number> = null

    private readonly delayMs: number
    private readonly debounce: boolean
    private readonly maxBatchSize: Optional<number>
    private readonly maxWaitMs: Optional<number>

    /**
     * A bare number is the `delayMs` shorthand, keeping the original
     * two-argument form working.
     */
    constructor(
        private readonly executor: BatchExecutor<TKey, TResult, TPartition>,
        options: number | BatchQueueOptions = 0,
    ) {
        const resolved =
            typeof options === 'number' ? { delayMs: options } : options
        this.delayMs = resolved.delayMs ?? 0
        this.debounce = resolved.debounce ?? false
        this.maxBatchSize = resolved.maxBatchSize
        this.maxWaitMs = resolved.maxWaitMs
    }

    enqueue(key: TKey, partition: TPartition): Promise<Optional<TResult>> {
        let partitionMap = this.current.get(partition)
        if (!partitionMap) {
            partitionMap = new Map()
            this.current.set(partition, partitionMap)
        }

        const promise = new Promise<Optional<TResult>>((resolve, reject) => {
            const waiters = partitionMap!.get(key) ?? []
            waiters.push({ resolve, reject })
            partitionMap!.set(key, waiters)
        })

        this.scheduleFlush(partitionMap.size)

        return promise
    }

    /**
     * `pendingKeys` is the enqueueing partition's distinct-key count — the unit
     * `maxBatchSize` bounds, since the executor is called once per partition.
     */
    private scheduleFlush(pendingKeys: number): void {
        if (this.windowStartedAt === null) {
            this.windowStartedAt = Date.now()
        }

        if (
            this.maxBatchSize !== undefined &&
            pendingKeys >= this.maxBatchSize
        ) {
            this.clearTimer()
            void this.flush()
            return
        }

        if (this.timer !== null && !this.debounce) {
            return
        }

        this.clearTimer()

        let delay = this.delayMs
        if (this.debounce && this.maxWaitMs !== undefined) {
            const elapsed = Date.now() - this.windowStartedAt
            delay = Math.min(delay, Math.max(0, this.maxWaitMs - elapsed))
        }

        this.timer = setTimeout(() => void this.flush(), delay)
    }

    private clearTimer(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    private async flush(): Promise<void> {
        // Swap: take the filled bucket aside, start a fresh one for any
        // enqueues that arrive while the executor is running.
        const taken = this.current
        this.current = new Map()
        this.timer = null
        // Closes the window: enqueues arriving during the executor belong to
        // the next one, and must not inherit this window's spent maxWait
        // budget — otherwise every later batch would dispatch with zero delay.
        this.windowStartedAt = null

        // Run one executor invocation per partition. Failures in one
        // partition don't affect others.
        await Promise.all(
            Array.from(taken.entries()).map(([partition, keysMap]) =>
                this.runBatch(partition, keysMap),
            ),
        )

        // If anything accumulated in `current` while we were busy and no
        // timer was scheduled (e.g. those enqueues happened after the
        // executor started), kick off the next round.
        if (this.current.size > 0 && this.timer === null) {
            this.windowStartedAt = Date.now()
            this.timer = setTimeout(() => void this.flush(), this.delayMs)
        }
    }

    private async runBatch(
        partition: TPartition,
        keysMap: Map<TKey, Waiter<TResult>[]>,
    ): Promise<void> {
        const keys = Array.from(keysMap.keys())
        try {
            const results = await this.executor(keys, partition)
            for (const [key, waiters] of keysMap) {
                const value = results.get(key)
                for (const waiter of waiters) waiter.resolve(value)
            }
        } catch (error) {
            for (const waiters of keysMap.values()) {
                for (const waiter of waiters) waiter.reject(error)
            }
        }
    }
}
