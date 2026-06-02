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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTimeout, withTimeoutFallback } from '../withTimeout'

describe('withTimeout', () => {
    afterEach(() => vi.useRealTimers())

    it('resolves with the promise value when it settles first', async () => {
        await expect(
            withTimeout(Promise.resolve('ok'), 1000, () => new Error('late')),
        ).resolves.toBe('ok')
    })

    it('rejects with onTimeout() when the timer fires first', async () => {
        vi.useFakeTimers()
        const promise = withTimeout(
            new Promise<string>(() => {}),
            1000,
            () => new Error('timed out'),
        )
        const assertion = expect(promise).rejects.toThrow('timed out')
        await vi.advanceTimersByTimeAsync(1000)
        await assertion
    })
})

describe('withTimeoutFallback', () => {
    afterEach(() => vi.useRealTimers())

    it('resolves with the promise value when it settles first', async () => {
        await expect(
            withTimeoutFallback(
                Promise.resolve('real'),
                1000,
                () => 'fallback',
            ),
        ).resolves.toBe('real')
    })

    it('resolves with fallback() on timeout (never rejects)', async () => {
        vi.useFakeTimers()
        const promise = withTimeoutFallback(
            new Promise<string>(() => {}),
            1000,
            () => 'fallback',
        )
        await vi.advanceTimersByTimeAsync(1000)
        await expect(promise).resolves.toBe('fallback')
    })
})
