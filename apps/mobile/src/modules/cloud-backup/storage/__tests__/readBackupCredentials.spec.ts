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
import { buildBackupCredentialsFile } from '@perawallet/wallet-core-backup'
import {
    InvalidCredentialsFileError,
    UnsupportedCredentialsFileError,
} from '../errors'
import { readBackupCredentials } from '../readBackupCredentials'

const {
    readFromDevice,
    readFromICloud,
    readFromGoogleDrive,
    listFromICloud,
    listFromGoogleDrive,
} = vi.hoisted(() => ({
    readFromDevice: vi.fn(),
    readFromICloud: vi.fn(),
    readFromGoogleDrive: vi.fn(),
    listFromICloud: vi.fn(),
    listFromGoogleDrive: vi.fn(),
}))

vi.mock('../readFromDevice', () => ({ readFromDevice }))
vi.mock('../readFromICloud', () => ({ readFromICloud }))
vi.mock('../readFromGoogleDrive', () => ({ readFromGoogleDrive }))
vi.mock('../listFromICloud', () => ({ listFromICloud }))
vi.mock('../listFromGoogleDrive', () => ({ listFromGoogleDrive }))

// The device picker names its own file, so the name it is handed is unused.
const DEVICE_FILE_NAME = 'pera-backup-encryption-key.json'
const FILE_NAME = 'pera-backup-VQBGR.json'
const OTHER_FILE_NAME = 'pera-backup-ZZZZZ.json'
const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='

const listed = (...fileNames: string[]) => ({ status: 'listed', fileNames })

beforeEach(() => {
    vi.clearAllMocks()
    listFromICloud.mockResolvedValue(listed(FILE_NAME))
    listFromGoogleDrive.mockResolvedValue(listed(FILE_NAME))
})

describe('readBackupCredentials', () => {
    test.each([
        ['device', readFromDevice, DEVICE_FILE_NAME],
        ['icloud', readFromICloud, FILE_NAME],
        ['googleDrive', readFromGoogleDrive, FILE_NAME],
    ] as const)(
        'reads the file from %s and returns its key',
        async (source, reader, fileName) => {
            reader.mockResolvedValueOnce({
                status: 'read',
                contents: buildBackupCredentialsFile(SALT),
            })

            await expect(readBackupCredentials(source)).resolves.toEqual({
                status: 'read',
                key: {
                    salt: SALT,
                    argon2id: expect.objectContaining({ outputLength: 32 }),
                },
            })
            expect(reader).toHaveBeenCalledWith(fileName, undefined)
        },
    )

    test('passes onReading through to the reader', async () => {
        const onReading = vi.fn()
        readFromDevice.mockResolvedValueOnce({
            status: 'read',
            contents: buildBackupCredentialsFile(SALT),
        })

        await readBackupCredentials('device', { onReading })

        expect(readFromDevice).toHaveBeenCalledWith(DEVICE_FILE_NAME, onReading)
    })

    test('does not list for device: the picker chooses the file', async () => {
        readFromDevice.mockResolvedValueOnce({ status: 'cancelled' })

        await readBackupCredentials('device')

        expect(listFromICloud).not.toHaveBeenCalled()
        expect(listFromGoogleDrive).not.toHaveBeenCalled()
    })

    test('reads a lone cloud file without asking the user to choose', async () => {
        const chooseFile = vi.fn()
        readFromICloud.mockResolvedValueOnce({
            status: 'read',
            contents: buildBackupCredentialsFile(SALT),
        })

        await readBackupCredentials('icloud', { chooseFile })

        expect(chooseFile).not.toHaveBeenCalled()
        expect(readFromICloud).toHaveBeenCalledWith(FILE_NAME, undefined)
    })

    test('reads the file the user picks when several are saved', async () => {
        listFromICloud.mockResolvedValueOnce(listed(FILE_NAME, OTHER_FILE_NAME))
        const chooseFile = vi.fn().mockResolvedValueOnce(OTHER_FILE_NAME)
        readFromICloud.mockResolvedValueOnce({
            status: 'read',
            contents: buildBackupCredentialsFile(SALT),
        })

        await readBackupCredentials('icloud', { chooseFile })

        expect(chooseFile).toHaveBeenCalledWith([FILE_NAME, OTHER_FILE_NAME])
        expect(readFromICloud).toHaveBeenCalledWith(OTHER_FILE_NAME, undefined)
    })

    test('cancels, and reads nothing, when the user dismisses the chooser', async () => {
        listFromGoogleDrive.mockResolvedValueOnce(
            listed(FILE_NAME, OTHER_FILE_NAME),
        )

        await expect(
            readBackupCredentials('googleDrive', {
                chooseFile: vi.fn().mockResolvedValueOnce(null),
            }),
        ).resolves.toEqual({ status: 'cancelled' })
        expect(readFromGoogleDrive).not.toHaveBeenCalled()
    })

    test('passes a cancelled sign-in straight through', async () => {
        listFromGoogleDrive.mockResolvedValueOnce({ status: 'cancelled' })

        await expect(readBackupCredentials('googleDrive')).resolves.toEqual({
            status: 'cancelled',
        })
        expect(readFromGoogleDrive).not.toHaveBeenCalled()
    })

    test('passes a cancel straight through', async () => {
        readFromDevice.mockResolvedValueOnce({ status: 'cancelled' })

        await expect(readBackupCredentials('device')).resolves.toEqual({
            status: 'cancelled',
        })
    })

    test('reports a file that is not a credentials file', async () => {
        readFromDevice.mockResolvedValueOnce({
            status: 'read',
            contents: '{"t":"something-else"}',
        })

        await expect(readBackupCredentials('device')).rejects.toBeInstanceOf(
            InvalidCredentialsFileError,
        )
    })

    test('reports a file from a newer app as needing an update', async () => {
        const newer = JSON.stringify({
            ...JSON.parse(buildBackupCredentialsFile(SALT)),
            v: 2,
        })
        readFromDevice.mockResolvedValueOnce({
            status: 'read',
            contents: newer,
        })

        await expect(readBackupCredentials('device')).rejects.toBeInstanceOf(
            UnsupportedCredentialsFileError,
        )
    })

    test('lets a reader failure through unchanged', async () => {
        const error = new Error('network')
        readFromGoogleDrive.mockRejectedValueOnce(error)

        await expect(readBackupCredentials('googleDrive')).rejects.toBe(error)
    })
})
