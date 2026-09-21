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
    buildBackupCredentialsFile,
    isBackupCredentialsFileName,
    InvalidCredentialsFileError,
    UnsupportedCredentialsFileError,
} from '@perawallet/wallet-core-backup'
import { readBackupCredentials } from '../readBackupCredentials'

const { readFromDevice, read } = vi.hoisted(() => ({
    readFromDevice: vi.fn(),
    read: vi.fn(),
}))

vi.mock('../readFromDevice', () => ({ readFromDevice }))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ cloudFileStorage: { read } }),
}))

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='

const readFile = () => ({
    status: 'read',
    contents: buildBackupCredentialsFile(SALT),
})

beforeEach(() => {
    vi.clearAllMocks()
})

describe('readBackupCredentials', () => {
    test('reads a local file through the device picker', async () => {
        readFromDevice.mockResolvedValueOnce(readFile())

        await expect(readBackupCredentials('device')).resolves.toEqual({
            status: 'read',
            key: {
                salt: SALT,
                argon2id: expect.objectContaining({ outputLength: 32 }),
            },
        })
        expect(read).not.toHaveBeenCalled()
    })

    test.each(['icloud', 'googleDrive'] as const)(
        'reads from %s through the platform, which resolves the file itself',
        async store => {
            read.mockResolvedValueOnce(readFile())
            const chooseFile = vi.fn()
            const onReading = vi.fn()

            await expect(
                readBackupCredentials(store, { chooseFile, onReading }),
            ).resolves.toEqual({
                status: 'read',
                key: expect.objectContaining({ salt: SALT }),
            })
            expect(read).toHaveBeenCalledWith(store, {
                isCandidate: isBackupCredentialsFileName,
                chooseFile,
                onReading,
            })
            expect(readFromDevice).not.toHaveBeenCalled()
        },
    )

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
        readFromDevice.mockResolvedValueOnce({
            status: 'read',
            contents: JSON.stringify({
                ...JSON.parse(buildBackupCredentialsFile(SALT)),
                v: 2,
            }),
        })

        await expect(readBackupCredentials('device')).rejects.toBeInstanceOf(
            UnsupportedCredentialsFileError,
        )
    })

    test('lets a platform failure through unchanged', async () => {
        const error = new Error('network')
        read.mockRejectedValueOnce(error)

        await expect(readBackupCredentials('googleDrive')).rejects.toBe(error)
    })
})
