/*
 Copyright 2022-2025 Pera Wallet, LDA
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
 * Executes a coalesced batch of keys for a given partition. Implementations
 * are free to do whatever they want — fan out to a bulk HTTP endpoint, query
 * a local index, etc. — provided they return a Map of per-key results so the
 * queue can resolve each waiter with its own value.
 *
 * Keys absent from the returned Map cause their waiters to resolve with
 * `undefined`. This lets the executor omit "not found" entries naturally.
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

/**
 * Time-windowed batch queue.
 *
 * Keys enqueued within `delayMs` of each other are grouped into a single
 * batch and dispatched together. The model is intentionally simple:
 *
 *   1. There's a `current` bucket that accumulates keys.
 *   2. The first enqueue starts a timer for `delayMs`.
 *   3. While the timer is running, more enqueues land in `current`.
 *   4. When the timer fires, we swap: the filled bucket is taken aside
 *      to be processed, and `current` becomes a fresh empty bucket.
 *   5. The taken bucket's executor runs (one call per partition).
 *      Any new enqueues that arrive during the executor's HTTP call
 *      land in the fresh `current` bucket.
 *   6. After the previous batch settles, if `current` has anything in it,
 *      a new timer is scheduled for the next round.
 *
 * Same key enqueued multiple times within the same window: dedup'd in the
 * bucket (one entry, multiple waiters, all resolve from the single fetch).
 * Same key enqueued in adjacent windows: two separate fetches — by design.
 * If you want longer-window dedup, raise `delayMs`.
 *
 * The queue is generic over `TKey`, `TResult` and `TPartition`. Partitions
 * are useful when the underlying API is segmented (e.g. NFD lookups are
 * per-network, so the partition is the network — different networks fire
 * separate executor calls in the same flush). For un-partitioned use,
 * leave `TPartition` defaulted to `void` and pass `undefined`.
 */
export class BatchQueue<TKey, TResult, TPartition = void> {
    private current: Bucket<TKey, TResult, TPartition> = new Map()
    private timer: Nullable<ReturnType<typeof setTimeout>> = null

    /**
     * @param executor  How to fetch a batch. Receives the keys for one
     *                  partition and returns a Map of per-key results.
     * @param delayMs   How long to wait after the first enqueue before
     *                  flushing. Larger = more coalescing, more latency.
     *                  Defaults to 0 (next macrotask).
     */
    constructor(
        private readonly executor: BatchExecutor<TKey, TResult, TPartition>,
        private readonly delayMs: number = 0,
    ) {}

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

        if (this.timer === null) {
            this.timer = setTimeout(() => void this.flush(), this.delayMs)
        }

        return promise
    }

    private async flush(): Promise<void> {
        // Swap: take the filled bucket aside, start a fresh one for any
        // enqueues that arrive while the executor is running.
        const taken = this.current
        this.current = new Map()
        this.timer = null

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
