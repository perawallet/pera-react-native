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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../test-utils/chrome'
import { sealKvRecord } from '../kv-record'

const KEY = new Uint8Array(32).fill(7)
const NETWORK = '{"state":{"mode":"developer"},"version":3}'
const CUSTOM = '{"state":{"networks":[]},"version":1}'

describe('key-value-singleton', () => {
    let fake: ChromeFake
    let singleton: typeof import('../key-value-singleton')

    beforeEach(async () => {
        vi.resetModules()
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        singleton = await import('../key-value-singleton')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('sealLegacyKvRecords', () => {
        it('seals both untagged records so they verify under the key', async () => {
            fake.data.set('kv:network-store', NETWORK)
            fake.data.set('kv:custom-network-store', CUSTOM)

            await singleton.sealLegacyKvRecords(KEY)

            expect(fake.data.get('kv:network-store')).toBe(
                sealKvRecord(KEY, 'network-store', NETWORK),
            )
            expect(fake.data.get('kv:custom-network-store')).toBe(
                sealKvRecord(KEY, 'custom-network-store', CUSTOM),
            )
        })

        it('leaves sealed records and absent keys alone', async () => {
            const sealed = sealKvRecord(KEY, 'network-store', NETWORK)
            fake.data.set('kv:network-store', sealed)
            const set = vi.spyOn(fake.chrome.storage.local, 'set')

            await singleton.sealLegacyKvRecords(KEY)

            expect(set).not.toHaveBeenCalled()
            expect(fake.data.get('kv:network-store')).toBe(sealed)
            expect(fake.data.has('kv:custom-network-store')).toBe(false)
        })

        it('rejects when the write fails', async () => {
            fake.data.set('kv:network-store', NETWORK)
            vi.spyOn(fake.chrome.storage.local, 'set').mockRejectedValue(
                new Error('quota'),
            )

            await expect(singleton.sealLegacyKvRecords(KEY)).rejects.toThrow(
                'quota',
            )
        })

        it('serves a sealed record after hydrate, then rejects an untagged overwrite', async () => {
            fake.data.set('kv:network-store', NETWORK)
            await singleton.hydratePlatform()
            await singleton.sealLegacyKvRecords(KEY)
            singleton.setKvAuthKey(KEY)

            expect(singleton.keyValueStorage.getItem('network-store')).toBe(
                NETWORK,
            )

            fake.emitExternalChange('kv:network-store', NETWORK)

            expect(
                singleton.keyValueStorage.getItem('network-store'),
            ).toBeNull()
        })
    })
})
