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

/**
 * React Native's AbortSignal comes from abort-controller@3, and Expo's runtime
 * patches in the `any` and `timeout` statics but not `throwIfAborted`. ky calls
 * it before every retry delay, so without this a retryable failure (5xx,
 * network error) surfaces as a TypeError instead of being retried.
 */
export const installAbortSignalThrowIfAborted = (
    abortSignal: typeof AbortSignal = globalThis.AbortSignal,
): void => {
    if (typeof abortSignal.prototype.throwIfAborted === 'function') return
    Object.defineProperty(abortSignal.prototype, 'throwIfAborted', {
        configurable: true,
        writable: true,
        enumerable: false,
        value(this: AbortSignal) {
            if (!this.aborted) return
            throw (
                this.reason ??
                new DOMException('This operation was aborted', 'AbortError')
            )
        },
    })
}
