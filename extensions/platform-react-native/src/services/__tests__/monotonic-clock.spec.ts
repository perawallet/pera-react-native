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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RNMonotonicClockService } from '../monotonic-clock'

const nativeClockMock = vi.hoisted(() => ({
    current: null as { now: () => unknown } | null,
}))

vi.mock('expo', () => ({
    requireOptionalNativeModule: (name: string) =>
        name === 'PeraMonotonicClock' ? nativeClockMock.current : null,
}))

describe('RNMonotonicClockService', () => {
    beforeEach(() => {
        nativeClockMock.current = null
    })

    it('returns null when the native module is absent', () => {
        const service = new RNMonotonicClockService()

        expect(service.now()).toBeNull()
    })

    it('returns the native reading', () => {
        nativeClockMock.current = {
            now: () => ({ bootId: '42', elapsedMs: 1234.5 }),
        }
        const service = new RNMonotonicClockService()

        expect(service.now()).toEqual({ bootId: '42', elapsedMs: 1234.5 })
    })

    it.each([
        ['an empty boot id', { bootId: '', elapsedMs: 1 }],
        ['a negative elapsed time', { bootId: '1', elapsedMs: -1 }],
        ['a non-finite elapsed time', { bootId: '1', elapsedMs: Infinity }],
        ['a string elapsed time', { bootId: '1', elapsedMs: '5' }],
        ['a non-object payload', 'reading'],
    ])('returns null for %s', (_label, payload) => {
        nativeClockMock.current = { now: () => payload }
        const service = new RNMonotonicClockService()

        expect(service.now()).toBeNull()
    })

    it('returns null when the native call throws', () => {
        nativeClockMock.current = {
            now: () => {
                throw new Error('sysctl failed')
            },
        }
        const service = new RNMonotonicClockService()

        expect(service.now()).toBeNull()
    })
})
