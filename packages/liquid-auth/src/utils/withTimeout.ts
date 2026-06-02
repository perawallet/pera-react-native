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
 * Races `promise` against a timeout. Rejects with `onTimeout()` if the timer
 * fires first; the timer is always cleared. The underlying promise is not
 * cancelled — the caller must decide what to do with a late resolution (e.g.
 * the signal client discards a channel that resolves after close()).
 */
export const withTimeout = <T>(
    promise: Promise<T>,
    ms: number,
    onTimeout: () => Error,
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms)
    })
    return Promise.race([promise, timeout]).finally(() => {
        if (timer !== undefined) clearTimeout(timer)
    }) as Promise<T>
}

/**
 * Resolves with the first value produced by `promise`, or `fallback()` if `ms`
 * elapses first. Never rejects on timeout (unlike {@link withTimeout}); used
 * for best-effort waits like the negotiated-identity race.
 */
export const withTimeoutFallback = <T>(
    promise: Promise<T>,
    ms: number,
    fallback: () => T,
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<T>(resolve => {
        timer = setTimeout(() => resolve(fallback()), ms)
    })
    return Promise.race([promise, timeout]).finally(() => {
        if (timer !== undefined) clearTimeout(timer)
    }) as Promise<T>
}
