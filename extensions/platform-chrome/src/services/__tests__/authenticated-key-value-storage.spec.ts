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

import { beforeEach, describe, expect, it } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { sealKvRecord } from '../../kv-record'
import { AuthenticatedKeyValueStorage } from '../authenticated-key-value-storage'
import { ChromeKeyValueStorageService } from '../key-value-storage'

const KEY = new Uint8Array(32).fill(7)
const PAYLOAD = '{"state":{"mode":"live"},"version":3}'
const AUTHENTICATED = ['network-store']

describe('AuthenticatedKeyValueStorage', () => {
    let fake: ChromeFake
    let inner: ChromeKeyValueStorageService
    let storage: AuthenticatedKeyValueStorage

    beforeEach(async () => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        inner = new ChromeKeyValueStorageService()
        await inner.hydrate()
        storage = new AuthenticatedKeyValueStorage(inner, AUTHENTICATED)
    })

    it('stores a sealed record and reads the value back', () => {
        storage.setAuthKey(KEY)

        storage.setItem('network-store', PAYLOAD)

        expect(inner.getItem('network-store')).toBe(
            sealKvRecord(KEY, 'network-store', PAYLOAD),
        )
        expect(storage.getItem('network-store')).toBe(PAYLOAD)
        expect(storage.getJSON('network-store')).toEqual(JSON.parse(PAYLOAD))
    })

    it('reads an untagged envelope as absent', () => {
        storage.setAuthKey(KEY)
        inner.setItem('network-store', PAYLOAD)

        expect(storage.getItem('network-store')).toBeNull()
    })

    it('reads a forged tag as absent', () => {
        storage.setAuthKey(KEY)
        const forged = JSON.parse(sealKvRecord(KEY, 'network-store', PAYLOAD))
        forged.payload = PAYLOAD.replace('live', 'developer')
        inner.setItem('network-store', JSON.stringify(forged))

        expect(storage.getItem('network-store')).toBeNull()
    })

    it('reads a valid record as absent while locked and drops writes', () => {
        inner.setItem(
            'network-store',
            sealKvRecord(KEY, 'network-store', PAYLOAD),
        )
        const before = inner.getItem('network-store')

        storage.setItem('network-store', '{"state":{"mode":"developer"}}')

        expect(storage.hasAuthKey()).toBe(false)
        expect(storage.getItem('network-store')).toBeNull()
        expect(inner.getItem('network-store')).toBe(before)
    })

    it('stops serving records once the key is cleared', () => {
        storage.setAuthKey(KEY)
        storage.setItem('network-store', PAYLOAD)

        storage.setAuthKey(null)

        expect(storage.getItem('network-store')).toBeNull()
    })

    it('does not alias the caller key, so zeroing it leaves the storage working', () => {
        const caller = new Uint8Array(KEY)
        storage.setAuthKey(caller)
        storage.setItem('network-store', PAYLOAD)

        caller.fill(0)

        expect(storage.getItem('network-store')).toBe(PAYLOAD)
    })

    it('passes other keys and removal through untouched', () => {
        storage.setItem('other', 'plain')

        expect(inner.getItem('other')).toBe('plain')
        expect(storage.getItem('other')).toBe('plain')

        storage.setAuthKey(KEY)
        storage.setItem('network-store', PAYLOAD)
        storage.removeItem('network-store')

        expect(inner.getItem('network-store')).toBeNull()
        expect([...storage.getAllKeys()]).toEqual(['other'])
    })
})
