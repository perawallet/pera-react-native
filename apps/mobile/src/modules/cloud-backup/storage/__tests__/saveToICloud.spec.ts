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
import { ICloudUnavailableError } from '../errors'
import { saveToICloud } from '../saveToICloud'

const { isCloudAvailable, writeFile, constructed } = vi.hoisted(() => ({
    isCloudAvailable: vi.fn(),
    writeFile: vi.fn(),
    constructed: vi.fn(),
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
        },
        CloudStorageProvider: { ICloud: 'icloud', GoogleDrive: 'googledrive' },
        CloudStorageScope: { Documents: 'documents', AppData: 'app_data' },
        CloudStorage: class {
            isCloudAvailable = isCloudAvailable
            writeFile = writeFile
            constructor(...args: unknown[]) {
                constructed(...args)
            }
        },
    }
})

const FILE_NAME = 'pera-backup-encryption-key.json'

beforeEach(() => {
    vi.clearAllMocks()
    isCloudAvailable.mockResolvedValue(true)
    writeFile.mockResolvedValue(undefined)
})

describe('saveToICloud', () => {
    test('writes the file to the hidden app-data scope of the iCloud container', async () => {
        await expect(saveToICloud(FILE_NAME, '{}')).resolves.toBe('saved')

        expect(constructed).toHaveBeenCalledWith('icloud', {
            scope: 'app_data',
        })
        expect(writeFile).toHaveBeenCalledWith(`/${FILE_NAME}`, '{}')
    })

    test('throws ICloudUnavailableError without writing when iCloud is off', async () => {
        isCloudAvailable.mockResolvedValueOnce(false)

        await expect(saveToICloud(FILE_NAME, '{}')).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
        expect(writeFile).not.toHaveBeenCalled()
    })

    test('propagates a failed write', async () => {
        writeFile.mockRejectedValueOnce(new Error('ERR_WRITE_ERROR'))

        await expect(saveToICloud(FILE_NAME, '{}')).rejects.toThrow(
            'ERR_WRITE_ERROR',
        )
    })

    test('reports iCloud as unavailable when the app has no iCloud container', async () => {
        writeFile.mockRejectedValueOnce(
            new CloudStorageError(
                'no container',
                CloudStorageErrorCode.DIRECTORY_NOT_FOUND,
            ),
        )

        await expect(saveToICloud(FILE_NAME, '{}')).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
    })
})
