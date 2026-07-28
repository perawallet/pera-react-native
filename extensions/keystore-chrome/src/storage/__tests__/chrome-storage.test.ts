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

import { beforeEach, describe, expect, it } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { ChromeSecureEntryStorage } from '../chrome-storage'

describe('ChromeSecureEntryStorage', () => {
    let fake: ChromeFake
    let storage: ChromeSecureEntryStorage

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        storage = new ChromeSecureEntryStorage()
    })

    it('throws on read before hydrate()', () => {
        expect(() => storage.getString('k')).toThrow(/hydrate/)
    })

    it('round-trips entries and returns undefined for missing (MMKV parity)', async () => {
        await storage.hydrate()
        storage.set('key-1', 'encrypted-blob')
        expect(storage.getString('key-1')).toBe('encrypted-blob')
        expect(storage.getString('missing')).toBeUndefined()
        expect(storage.contains('key-1')).toBe(true)
        expect(storage.contains('missing')).toBe(false)
    })

    it('write-throughs under the keystore: prefix, apart from kv: entries', async () => {
        await storage.hydrate()
        storage.set('key-1', 'blob')
        expect(fake.data.get('keystore:key-1')).toBe('blob')
        storage.remove('key-1')
        expect(fake.data.has('keystore:key-1')).toBe(false)
    })

    it('hydrates existing keystore: entries and ignores foreign keys', async () => {
        fake.data.set('keystore:persisted', 'blob')
        fake.data.set('kv:app-state', 'not-ours')
        fake.data.set('device:id', 'not-ours')
        await storage.hydrate()
        expect(storage.getAllKeys()).toEqual(['persisted'])
    })

    it('applies changes from other extension contexts via onChanged', async () => {
        await storage.hydrate()
        fake.emitExternalChange('keystore:remote', 'from-approval-window')
        expect(storage.getString('remote')).toBe('from-approval-window')
    })

    it('clearAll removes only keystore-prefixed entries', async () => {
        fake.data.set('kv:app-state', 'keep')
        await storage.hydrate()
        storage.set('a', '1')
        storage.set('b', '2')
        storage.clearAll()
        expect(storage.getAllKeys()).toEqual([])
        expect(fake.data.has('keystore:a')).toBe(false)
        expect(fake.data.get('kv:app-state')).toBe('keep')
    })
})
