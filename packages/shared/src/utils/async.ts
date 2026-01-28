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
