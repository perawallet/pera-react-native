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

/**
 * Calculates the next backoff interval using exponential backoff.
 * @param currentInterval The current interval in milliseconds.
 * @param multiplier The multiplier for each backoff step (default: 2).
 * @param maxInterval The maximum interval in milliseconds (default: 30000).
 * @returns The next backoff interval, capped at maxInterval.
 */
export function calculateBackoff(
    currentInterval: number,
    multiplier = 2,
    maxInterval = 30_000,
): number {
    return Math.min(currentInterval * multiplier, maxInterval)
}

/**
 * Defers the execution of a function to a future event loop cycle and returns a Promise.
 * This is useful for allowing the UI to update (e.g., showing a spinner)
 * before starting a heavy synchronous task, or for scheduling delayed work.
 * @param callback The function to be executed.
 * @param delay The delay in milliseconds (default: 0).
 * @returns A Promise that resolves with the callback result.
 */
export function deferToNextCycle<T>(
    callback: () => T | Promise<T>,
    delay?: number,
): Promise<T>
/**
 * Defers execution to a future event loop cycle and returns a Promise that resolves after the delay.
 * Works like a sleep/delay function.
 * @param delay The delay in milliseconds (default: 0).
 * @returns A Promise that resolves after the delay.
 */
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
 * Wrap a promise with a timeout. If the promise does not settle within
 * `ms` milliseconds, the returned promise rejects with the value returned
 * by `rejectWith(operation, ms)` (or a default `Error` if not provided).
 *
 * The timer is cleared when the underlying promise settles so fast-finishing
 * calls don't leave a pending setTimeout pinning the rejection closure for
 * the full timeout window. Callers are expected to handle cleanup of any
 * late-resolving resource themselves — see the hardware-wallet strategy for
 * an example that disconnects a BLE link that arrives after the timeout.
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
