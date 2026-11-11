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

import type { Optional } from './types'

export const isPromiseLike = <T>(
    value: T | PromiseLike<T>,
): value is PromiseLike<T> =>
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'

/** Exponential backoff, in milliseconds, capped at `maxInterval`. */
export function calculateBackoff(
    currentInterval: number,
    multiplier = 2,
    maxInterval = 30_000,
): number {
    return Math.min(currentInterval * multiplier, maxInterval)
}

/** `intervalMs` is a duration; `nextEligibleAt` is epoch ms from `Date.now()`. */
export interface Backoff {
    intervalMs: number
    nextEligibleAt: number
}

export type NextBackoffOptions = {
    firstIntervalMs: number
    multiplier?: number
    maxIntervalMs: number
}

/**
 * The wait after one more failure: `firstIntervalMs` after the first, then
 * `multiplier` times the last, capped at `maxIntervalMs`. `startedAtMs` is when
 * the failed attempt began, so a loop that arms its timer only once an attempt
 * settles finds a wait of one loop interval due on its next run.
 */
export const nextBackoff = (
    previous: Optional<Backoff>,
    startedAtMs: number,
    { firstIntervalMs, multiplier = 2, maxIntervalMs }: NextBackoffOptions,
): Backoff => {
    const intervalMs = previous
        ? calculateBackoff(previous.intervalMs, multiplier, maxIntervalMs)
        : firstIntervalMs
    return { intervalMs, nextEligibleAt: startedAtMs + intervalMs }
}

// A wait longer than the interval itself means the device clock moved back;
// without this the caller would stall for the whole skew.
export const isBackoffDue = (
    backoff: Optional<Backoff>,
    nowMs: number,
): boolean =>
    backoff === undefined ||
    backoff.nextEligibleAt <= nowMs ||
    backoff.nextEligibleAt - nowMs > backoff.intervalMs

/**
 * Lets the UI paint (e.g. a spinner) before a heavy synchronous task starts.
 */
export function deferToNextCycle<T>(
    callback: () => T | Promise<T>,
    delay?: number,
): Promise<T>
/** Sleep overload: resolves after `delay` ms. */
export function deferToNextCycle(delay?: number): Promise<void>
export function deferToNextCycle<T>(
    callbackOrDelay?: (() => T | Promise<T>) | number,
    delay: number = 0,
): Promise<T | void> {
    const callback =
        typeof callbackOrDelay === 'function' ? callbackOrDelay : undefined
    const finalDelay =
        typeof callbackOrDelay === 'number' ? callbackOrDelay : delay

    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                if (callback) {
                    const result = await callback()

                    resolve(result)
                } else {
                    resolve()
                }
            } catch (error) {
                reject(error)
            }
        }, finalDelay)
    })
}

/**
 * `Promise.allSettled(items.map(fn))` with at most `limit` in flight: a bare
 * `allSettled` bursts one request per item, which a rate limiter answers with
 * 429s. Results stay positionally aligned with `items`. `limit` is floored at 1
 * so a config-derived 0 cannot deadlock.
 */
export const mapWithConcurrency = async <T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
    const results: PromiseSettledResult<R>[] = new Array(items.length)
    let nextIndex = 0

    const worker = async (): Promise<void> => {
        for (;;) {
            const index = nextIndex++
            if (index >= items.length) return
            try {
                results[index] = {
                    status: 'fulfilled',
                    value: await mapper(items[index], index),
                }
            } catch (reason) {
                results[index] = { status: 'rejected', reason }
            }
        }
    }

    const workerCount = Math.max(1, Math.min(limit, items.length))
    await Promise.all(Array.from({ length: workerCount }, worker))

    return results
}

export type ConcurrencyLimit = <T>(task: () => Promise<T>) => Promise<T>

/**
 * A gate that runs at most `limit` tasks at once across every caller sharing
 * it, queuing the rest in call order: for a backend several independent
 * batches hit together, where a per-batch `mapWithConcurrency` would still
 * burst. `limit` is floored at 1.
 */
export const createConcurrencyLimit = (limit: number): ConcurrencyLimit => {
    const max = Math.max(1, limit)
    let running = 0
    const queue: (() => void)[] = []

    return async task => {
        // A finished task hands its slot straight to the next in the queue,
        // so a caller arriving in between can't take it and overshoot `max`.
        if (running >= max) {
            await new Promise<void>(resolve => queue.push(resolve))
        } else {
            running++
        }
        try {
            return await task()
        } finally {
            const next = queue.shift()
            if (next) next()
            else running--
        }
    }
}

const heldLocks = new Set<string>()

/**
 * Runs `fn` under the lock `name`, or resolves `undefined` if another holder has
 * it. Web Locks span every page and worker of an origin; without them the lock
 * holds within this realm only.
 */
export const withLockIfFree = async <T>(
    name: string,
    fn: () => Promise<T>,
): Promise<Optional<T>> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request(
            name,
            { ifAvailable: true },
            async lock => (lock ? fn() : undefined),
        )
    }
    if (heldLocks.has(name)) return undefined
    heldLocks.add(name)
    try {
        return await fn()
    } finally {
        heldLocks.delete(name)
    }
}

/**
 * Runs `read` on every item at once. A read that fails while others answer
 * resolves to `fallback`; when every read fails, rejects with the first
 * failure, so an unreachable batch isn't mistaken for one that answered.
 */
export const settleBatch = async <T, R>(
    items: readonly T[],
    read: (item: T) => Promise<R>,
    fallback: R,
): Promise<R[]> => {
    const reads = await Promise.allSettled(items.map(item => read(item)))
    const [first] = reads
    if (
        first?.status === 'rejected' &&
        reads.every(result => result.status === 'rejected')
    ) {
        throw first.reason
    }
    return reads.map(result =>
        result.status === 'fulfilled' ? result.value : fallback,
    )
}

/**
 * The timer is cleared on settle so a fast call does not pin the rejection
 * closure for the full window. Cleaning up a late-resolving resource is the caller's job.
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    operation: string,
    rejectWith?: (operation: string, ms: number) => Error,
): Promise<T> {
    let timerId: Optional<ReturnType<typeof setTimeout>>
    return new Promise<T>((resolve, reject) => {
        timerId = setTimeout(() => {
            const error = rejectWith
                ? rejectWith(operation, ms)
                : new Error(`${operation} timed out after ${ms}ms`)
            reject(error)
        }, ms)
        promise.then(resolve, reject)
    }).finally(() => {
        if (timerId !== undefined) clearTimeout(timerId)
    })
}

/** Named `TimeoutError` so the expected-error filter treats a missed deadline as connectivity, not a defect. */
export const timeoutErrorOf = (operation: string, ms: number): Error => {
    const error = new Error(`${operation} timed out after ${ms}ms`)
    error.name = 'TimeoutError'
    return error
}

/**
 * Runs `run` with a signal that aborts when `ms` pass or `outer` aborts, so the
 * requests it started stop rather than run on after the deadline. A missed
 * deadline rejects with `timeoutErrorOf`; an `outer` abort rejects with
 * whatever `run` throws for it.
 */
export function withDeadline<T>(
    run: (signal: AbortSignal) => Promise<T>,
    ms: number,
    operation: string,
    outer?: AbortSignal,
): Promise<T> {
    const controller = new AbortController()
    const abortWithOuter = () => controller.abort(outer?.reason)
    if (outer?.aborted) abortWithOuter()
    else outer?.addEventListener('abort', abortWithOuter, { once: true })

    // Reject before aborting, so the deadline's error wins over the abort's.
    const deadline = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
            const error = timeoutErrorOf(operation, ms)
            reject(error)
            controller.abort(error)
        }, ms)
        controller.signal.addEventListener('abort', () => clearTimeout(timer), {
            once: true,
        })
    })
    const work = run(controller.signal)
    return Promise.race([work, deadline]).finally(() => {
        outer?.removeEventListener('abort', abortWithOuter)
        // Stops the timer once `work` has settled first.
        controller.abort()
    })
}
