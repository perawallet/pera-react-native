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
