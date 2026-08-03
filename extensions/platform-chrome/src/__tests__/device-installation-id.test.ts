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
import { createChromeFake, type ChromeFake } from '../test-utils/chrome'
import {
    DEVICE_INSTALLATION_ID_STORAGE_KEY,
    ensureDeviceInstallationID,
} from '../device-installation-id'

describe('ensureDeviceInstallationID', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('mints and persists a UUID on first run', async () => {
        const id = await ensureDeviceInstallationID()
        expect(id).toMatch(/^[0-9a-f-]{36}$/)
        expect(fake.data.get(DEVICE_INSTALLATION_ID_STORAGE_KEY)).toBe(id)
    })

    it('returns the existing ID without re-minting', async () => {
        fake.data.set(DEVICE_INSTALLATION_ID_STORAGE_KEY, 'existing-id')
        expect(await ensureDeviceInstallationID()).toBe('existing-id')
    })

    it('adopts the persisted winner after a racing write', async () => {
        // Simulate another context winning the race between our read (empty)
        // and our write: the adopt-after-write re-read must return the value
        // that actually persisted, not the locally minted one.
        fake.chrome.storage.local.set = async items => {
            // Another context's write lands first…
            fake.data.set(
                DEVICE_INSTALLATION_ID_STORAGE_KEY,
                'other-context-id',
            )
            // …then chrome.storage.local last-writer-wins would normally let
            // ours clobber it — model the case where OUR write is the one
            // that loses by dropping it.
            void items
        }
        const id = await ensureDeviceInstallationID()
        expect(id).toBe('other-context-id')
    })

    it('throws when the device ID cannot be persisted', async () => {
        fake.chrome.storage.local.set = async () => {}
        fake.chrome.storage.local.get = async () => ({})
        await expect(ensureDeviceInstallationID()).rejects.toThrow(
            /not persisted/,
        )
    })
})
