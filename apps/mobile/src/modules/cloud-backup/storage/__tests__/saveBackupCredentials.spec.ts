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
import {
    NoBackupCredentialsError,
    saveBackupCredentials,
} from '../saveBackupCredentials'

const { saveToDevice, saveToICloud, saveToGoogleDrive, storeState } =
    vi.hoisted(() => ({
        saveToDevice: vi.fn(),
        saveToICloud: vi.fn(),
        saveToGoogleDrive: vi.fn(),
        storeState: {
            salt: null as string | null,
            backupId: null as string | null,
        },
    }))

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useCloudBackupStore: { getState: () => storeState },
}))
vi.mock('../saveToDevice', () => ({ saveToDevice }))
vi.mock('../saveToICloud', () => ({ saveToICloud }))
vi.mock('../saveToGoogleDrive', () => ({ saveToGoogleDrive }))

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID = `did:pera:VQBGR${'A'.repeat(53)}`

beforeEach(() => {
    vi.clearAllMocks()
    storeState.salt = SALT
    storeState.backupId = BACKUP_ID
    saveToDevice.mockResolvedValue('saved')
    saveToICloud.mockResolvedValue('saved')
    saveToGoogleDrive.mockResolvedValue('saved')
})

describe('saveBackupCredentials', () => {
    test.each([
        ['device', saveToDevice],
        ['icloud', saveToICloud],
        ['googleDrive', saveToGoogleDrive],
    ] as const)('writes through the %s saver', async (destination, saver) => {
        await expect(saveBackupCredentials(destination)).resolves.toBe('saved')

        expect(saver).toHaveBeenCalledWith(
            'pera-backup-VQBGR.json',
            expect.any(String),
        )
    })

    test('names the file after the backup, not after a fixed constant', async () => {
        storeState.backupId = `did:pera:ZZZZZ${'A'.repeat(53)}`

        await saveBackupCredentials('device')

        expect(saveToDevice).toHaveBeenCalledWith(
            'pera-backup-ZZZZZ.json',
            expect.any(String),
        )
    })

    test('writes the salt, and never the phrase', async () => {
        await saveBackupCredentials('device')

        expect(
            JSON.parse(String(saveToDevice.mock.calls[0]?.[1])),
        ).toMatchObject({ t: 'backup-credentials', salt: SALT })
    })

    test('passes a cancel back rather than reporting a save', async () => {
        saveToICloud.mockResolvedValueOnce('cancelled')

        await expect(saveBackupCredentials('icloud')).resolves.toBe('cancelled')
    })

    test.each([
        ['the salt', { salt: null }],
        ['the backup id', { backupId: null }],
    ])('refuses to write when %s is gone', async (_, gone) => {
        Object.assign(storeState, gone)

        await expect(saveBackupCredentials('device')).rejects.toBeInstanceOf(
            NoBackupCredentialsError,
        )
        expect(saveToDevice).not.toHaveBeenCalled()
    })
})
