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

import { describe, test, expect, vi } from 'vitest'
import { hydrateLockoutState } from '../lockoutHydration'
import { PIN_RECORD_VERSION, serializePinRecord } from '../pinRecord'

const recordBytes = (): Uint8Array =>
    serializePinRecord({
        version: PIN_RECORD_VERSION,
        salt: '00'.repeat(16),
        hash: '11'.repeat(32),
        duressSalt: '22'.repeat(16),
        duressHash: '33'.repeat(32),
        duressEnabled: 0,
        failedAttempts: 5,
        lockoutEndTime: 1_000,
    })

const makeKms = () => {
    const read = vi.fn()
    return {
        read,
        withSecret: async <T>(
            _id: string,
            handler: (bytes: Uint8Array) => T | Promise<T>,
        ): Promise<T | null> => {
            read()
            return handler(recordBytes())
        },
        commitSecret: vi.fn(async () => undefined),
        removeSecret: vi.fn(async () => undefined),
    }
}

describe('hydrateLockoutState', () => {
    test('concurrent callers share one record read', async () => {
        const kms = makeKms()

        const [first, second] = await Promise.all([
            hydrateLockoutState(kms),
            hydrateLockoutState(kms),
        ])

        expect(kms.read).toHaveBeenCalledTimes(1)
        expect(first).toEqual({ failedAttempts: 5, lockoutEndTime: 1_000 })
        expect(second).toEqual(first)
    })

    test('a caller after the read settles reads the record again', async () => {
        const kms = makeKms()

        await hydrateLockoutState(kms)
        await hydrateLockoutState(kms)

        expect(kms.read).toHaveBeenCalledTimes(2)
    })
})
