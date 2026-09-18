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
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'
import { CredentialsFileNotFoundError, ICloudUnavailableError } from '../errors'
import { listFromICloud } from '../listFromICloud'

const { isCloudAvailable, readdir } = vi.hoisted(() => ({
    isCloudAvailable: vi.fn(),
    readdir: vi.fn(),
}))

vi.mock('react-native-cloud-storage', () => {
    class CloudStorageError extends Error {
        code: string
        constructor(message: string, code: string) {
            super(message)
            this.code = code
        }
    }
    return {
        CloudStorageError,
        CloudStorageErrorCode: {
            DIRECTORY_NOT_FOUND: 'ERR_DIRECTORY_NOT_FOUND',
            UNKNOWN: 'ERR_UNKNOWN',
        },
        CloudStorageProvider: { ICloud: 'icloud', GoogleDrive: 'googledrive' },
        CloudStorageScope: { Documents: 'documents', AppData: 'app_data' },
        CloudStorage: class {
            isCloudAvailable = isCloudAvailable
            readdir = readdir
        },
    }
})

beforeEach(() => {
    vi.clearAllMocks()
    isCloudAvailable.mockResolvedValue(true)
})

describe('listFromICloud', () => {
    test('returns every saved key, so a user with two backups can pick', async () => {
        readdir.mockResolvedValueOnce([
            'pera-backup-VQBGR.json',
            'pera-backup-ZZZZZ.json',
        ])

        await expect(listFromICloud()).resolves.toEqual({
            status: 'listed',
            fileNames: ['pera-backup-VQBGR.json', 'pera-backup-ZZZZZ.json'],
        })
    })

    test('keeps a key saved before names carried an address', async () => {
        readdir.mockResolvedValueOnce(['pera-backup-encryption-key.json'])

        await expect(listFromICloud()).resolves.toEqual({
            status: 'listed',
            fileNames: ['pera-backup-encryption-key.json'],
        })
    })

    test('ignores anything in the container that is not a key', async () => {
        readdir.mockResolvedValueOnce([
            'notes.txt',
            'pera-backup-VQBGR.json',
            'pera-backup-lowercase.json',
        ])

        await expect(listFromICloud()).resolves.toEqual({
            status: 'listed',
            fileNames: ['pera-backup-VQBGR.json'],
        })
    })

    test('reports not found when the container holds no key', async () => {
        readdir.mockResolvedValueOnce(['notes.txt'])

        await expect(listFromICloud()).rejects.toBeInstanceOf(
            CredentialsFileNotFoundError,
        )
    })

    test('reports iCloud as unavailable rather than empty', async () => {
        isCloudAvailable.mockResolvedValueOnce(false)

        await expect(listFromICloud()).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
        expect(readdir).not.toHaveBeenCalled()
    })

    test('maps a missing ubiquity container to iCloud being unavailable', async () => {
        readdir.mockRejectedValueOnce(
            new CloudStorageError(
                'no container',
                CloudStorageErrorCode.DIRECTORY_NOT_FOUND as never,
            ),
        )

        await expect(listFromICloud()).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
    })

    test('signals only once the availability check has passed', async () => {
        const onListing = vi.fn()
        readdir.mockResolvedValueOnce(['pera-backup-VQBGR.json'])

        await listFromICloud(onListing)

        expect(onListing).toHaveBeenCalledTimes(1)
    })
})
