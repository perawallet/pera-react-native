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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
    CredentialsFileNotFoundError,
    ICloudUnavailableError,
} from '@perawallet/wallet-core-backup'
import {
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'
import { readFromICloud } from '../readFromICloud'

const { isCloudAvailable, readFile, triggerSync, constructed } = vi.hoisted(
    () => ({
        isCloudAvailable: vi.fn(),
        readFile: vi.fn(),
        triggerSync: vi.fn(),
        constructed: vi.fn(),
    }),
)

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
            FILE_NOT_FOUND: 'ERR_FILE_NOT_FOUND',
            FILE_NOT_DOWNLOADABLE: 'ERR_FILE_NOT_DOWNLOADABLE',
            DIRECTORY_NOT_FOUND: 'ERR_DIRECTORY_NOT_FOUND',
            READ_ERROR: 'ERR_READ_ERROR',
            UNKNOWN: 'ERR_UNKNOWN',
        },
        CloudStorageProvider: { ICloud: 'icloud', GoogleDrive: 'googledrive' },
        CloudStorageScope: { Documents: 'documents', AppData: 'app_data' },
        CloudStorage: class {
            isCloudAvailable = isCloudAvailable
            readFile = readFile
            triggerSync = triggerSync
            constructor(...args: unknown[]) {
                constructed(...args)
            }
        },
    }
})

const FILE_NAME = 'pera-backup-encryption-key.json'
const CONTENTS = '{"t":"backup-credentials"}'
const POLL_ATTEMPTS = 20
const POLL_INTERVAL_MS = 500

const cloudError = (code: string) =>
    new CloudStorageError('iCloud', code as never)

beforeEach(() => {
    vi.clearAllMocks()
    isCloudAvailable.mockResolvedValue(true)
    readFile.mockResolvedValue(CONTENTS)
    triggerSync.mockResolvedValue(undefined)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('readFromICloud', () => {
    test('reads the file from the hidden app-data scope', async () => {
        await expect(readFromICloud(FILE_NAME)).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(constructed).toHaveBeenCalledWith('icloud', {
            scope: 'app_data',
        })
        expect(readFile).toHaveBeenCalledWith(`/${FILE_NAME}`)
        expect(triggerSync).not.toHaveBeenCalled()
    })

    test('calls onReading once iCloud is confirmed available', async () => {
        const onReading = vi.fn()

        await readFromICloud(FILE_NAME, onReading)

        expect(onReading).toHaveBeenCalledTimes(1)
    })

    test('throws ICloudUnavailableError without reading when iCloud is off', async () => {
        isCloudAvailable.mockResolvedValueOnce(false)

        await expect(readFromICloud(FILE_NAME)).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
        expect(readFile).not.toHaveBeenCalled()
    })

    test('does not call onReading when iCloud is unavailable', async () => {
        isCloudAvailable.mockResolvedValueOnce(false)
        const onReading = vi.fn()

        await expect(
            readFromICloud(FILE_NAME, onReading),
        ).rejects.toBeInstanceOf(ICloudUnavailableError)
        expect(onReading).not.toHaveBeenCalled()
    })

    test('reports iCloud as unavailable when the app has no iCloud container', async () => {
        readFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.DIRECTORY_NOT_FOUND),
        )

        await expect(readFromICloud(FILE_NAME)).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
    })

    test('starts the download and waits for a file a fresh install has not pulled down yet', async () => {
        vi.useFakeTimers()
        readFile
            .mockRejectedValueOnce(
                cloudError(CloudStorageErrorCode.FILE_NOT_FOUND),
            )
            .mockRejectedValueOnce(
                cloudError(CloudStorageErrorCode.FILE_NOT_FOUND),
            )
        triggerSync.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.FILE_NOT_DOWNLOADABLE),
        )

        const read = readFromICloud(FILE_NAME)
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)

        await expect(read).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(triggerSync).toHaveBeenCalledWith(`/${FILE_NAME}`)
        expect(triggerSync.mock.calls.length).toBeGreaterThan(1)
    })

    test('keeps polling when a read reports READ_ERROR, then succeeds', async () => {
        vi.useFakeTimers()
        readFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.READ_ERROR),
        )

        const read = readFromICloud(FILE_NAME)
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)

        await expect(read).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
    })

    test('rethrows a triggerSync failure that is not a not-yet-downloadable placeholder', async () => {
        readFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.FILE_NOT_FOUND),
        )
        const error = cloudError(CloudStorageErrorCode.UNKNOWN)
        triggerSync.mockRejectedValueOnce(error)

        await expect(readFromICloud(FILE_NAME)).rejects.toBe(error)
    })

    test('gives up with not found once the download window passes', async () => {
        vi.useFakeTimers()
        for (let i = 0; i <= POLL_ATTEMPTS; i += 1) {
            readFile.mockRejectedValueOnce(
                cloudError(CloudStorageErrorCode.FILE_NOT_FOUND),
            )
        }

        const read = readFromICloud(FILE_NAME)
        const assertion = expect(read).rejects.toBeInstanceOf(
            CredentialsFileNotFoundError,
        )
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * POLL_ATTEMPTS)

        await assertion
        expect(readFile).toHaveBeenCalledTimes(POLL_ATTEMPTS + 1)
        expect(triggerSync).toHaveBeenCalledTimes(POLL_ATTEMPTS)
    })

    test('rethrows a read failure that is not a missing file', async () => {
        const error = cloudError(CloudStorageErrorCode.UNKNOWN)
        readFile.mockRejectedValueOnce(error)

        await expect(readFromICloud(FILE_NAME)).rejects.toBe(error)
    })
})
