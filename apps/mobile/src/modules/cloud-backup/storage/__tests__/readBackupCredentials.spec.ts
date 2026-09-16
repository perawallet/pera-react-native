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

const { readFromDevice, readFromICloud, readFromGoogleDrive } = vi.hoisted(
    () => ({
        readFromDevice: vi.fn(),
        readFromICloud: vi.fn(),
        readFromGoogleDrive: vi.fn(),
    }),
)

vi.mock('../readFromDevice', () => ({ readFromDevice }))
vi.mock('../readFromICloud', () => ({ readFromICloud }))
vi.mock('../readFromGoogleDrive', () => ({ readFromGoogleDrive }))

const FILE_NAME = 'pera-backup-encryption-key.json'
const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='

beforeEach(() => {
    vi.clearAllMocks()
})

describe('readBackupCredentials', () => {
    test.each([
        ['device', readFromDevice],
        ['icloud', readFromICloud],
        ['googleDrive', readFromGoogleDrive],
    ] as const)(
        'reads the file from %s and returns its key',
        async (source, reader) => {
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
            expect(reader).toHaveBeenCalledWith(FILE_NAME, undefined)
        },
    )

    test('passes onReading through to the reader', async () => {
        const onReading = vi.fn()
        readFromDevice.mockResolvedValueOnce({
            status: 'read',
            contents: buildBackupCredentialsFile(SALT),
        })

        await readBackupCredentials('device', onReading)

        expect(readFromDevice).toHaveBeenCalledWith(FILE_NAME, onReading)
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
