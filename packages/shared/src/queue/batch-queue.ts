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

/**
 * Groups keys enqueued within `delayMs` of each other into one dispatch. The
 * first enqueue starts the timer; when it fires the filled bucket is swapped
 * aside for its executor to run (one call per partition) while new enqueues
 * accumulate in a fresh bucket, which schedules the next round once the
 * previous settles.
 *
 * A key enqueued twice in one window dedups to a single fetch with multiple
 * waiters. Across adjacent windows it's two fetches, by design — raise
 * `delayMs` for longer dedup.
 *
 * Partitions suit a segmented API: NFD lookups are per-network, so different
 * networks fire separate executor calls in the same flush. Leave `TPartition`
 * defaulted for un-partitioned use.
 */
export class BatchQueue<TKey, TResult, TPartition = void> {
    private current: Bucket<TKey, TResult, TPartition> = new Map()
    private timer: Nullable<ReturnType<typeof setTimeout>> = null

    /** Larger `delayMs` means more coalescing and more latency. */
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
