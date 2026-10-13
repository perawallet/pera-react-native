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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { saveCredentialsFile } from '../saveBackupCredentials'

const { saveToDevice, save, storeState } = vi.hoisted(() => ({
    saveToDevice: vi.fn(),
    save: vi.fn(),
    storeState: {
        salt: null as string | null,
        backupId: null as string | null,
    },
}))

vi.mock('../saveToDevice', () => ({ saveToDevice }))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ cloudFileStorage: { save } }),
}))

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID = `did:pera:VQBGR${'A'.repeat(53)}`
const FILE_NAME = 'pera-backup-VQBGR.json'

beforeEach(() => {
    vi.clearAllMocks()
    storeState.salt = SALT
    storeState.backupId = BACKUP_ID
    saveToDevice.mockResolvedValue('saved')
    save.mockResolvedValue('saved')
})

describe('saveCredentialsFile', () => {
    // The store-key screen saves before the backup is configured, so the
    // credentials have to arrive as arguments rather than from the store.
    test('writes the file from the credentials it is given, without reading the store', async () => {
        Object.assign(storeState, { salt: null, backupId: null })

        await saveCredentialsFile('device', {
            salt: SALT,
            backupId: BACKUP_ID,
        })

        expect(saveToDevice).toHaveBeenCalledWith(
            FILE_NAME,
            expect.stringContaining(SALT),
        )
    })

    test('writes a local file through the device saver', async () => {
        await expect(
            saveCredentialsFile('device', { salt: SALT, backupId: BACKUP_ID }),
        ).resolves.toBe('saved')

        expect(save).not.toHaveBeenCalled()
    })

    test.each(['icloud', 'googleDrive'] as const)(
        'writes to %s through the platform',
        async store => {
            await expect(
                saveCredentialsFile(store, {
                    salt: SALT,
                    backupId: BACKUP_ID,
                }),
            ).resolves.toBe('saved')

            expect(save).toHaveBeenCalledWith(
                store,
                FILE_NAME,
                expect.stringContaining(SALT),
            )
            expect(saveToDevice).not.toHaveBeenCalled()
        },
    )

    test('passes a cancel back rather than reporting a save', async () => {
        save.mockResolvedValueOnce('cancelled')

        await expect(
            saveCredentialsFile('icloud', { salt: SALT, backupId: BACKUP_ID }),
        ).resolves.toBe('cancelled')
    })
})
