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
    CloudFileNotDownloadedError,
    CloudFileNotFoundError,
    ICloudNotConfiguredError,
    ICloudUnavailableError,
    type ReadCloudFileOptions,
} from '@perawallet/wallet-extension-platform'
import { isExpectedError } from '@perawallet/wallet-core-shared'
import {
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'
import { readFromICloud, saveToICloud } from '../icloud'

const {
    isCloudAvailable,
    readFile,
    readdir,
    triggerSync,
    writeFile,
    constructed,
} = vi.hoisted(() => ({
    isCloudAvailable: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    triggerSync: vi.fn(),
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
            readdir = readdir
            triggerSync = triggerSync
            writeFile = writeFile
            constructor(...args: unknown[]) {
                constructed(...args)
            }
        },
    }
})

const ONE = 'pera-backup-VQBGR.json'
const OTHER = 'pera-backup-ZZZZZ.json'
const CONTENTS = '{"t":"backup-credentials"}'
const POLL_ATTEMPTS = 20
const POLL_INTERVAL_MS = 500

const isCandidate = (fileName: string) => fileName.startsWith('pera-backup-')
const options = (
    extra: Partial<ReadCloudFileOptions> = {},
): ReadCloudFileOptions => ({
    isCandidate,
    chooseFile: async () => null,
    ...extra,
})

const cloudError = (code: string) =>
    new CloudStorageError('iCloud', code as never)

beforeEach(() => {
    vi.clearAllMocks()
    isCloudAvailable.mockResolvedValue(true)
    readdir.mockResolvedValue([ONE])
    readFile.mockResolvedValue(CONTENTS)
    triggerSync.mockResolvedValue(undefined)
    writeFile.mockResolvedValue(undefined)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('saveToICloud', () => {
    test('writes the file to the hidden app-data scope of the iCloud container', async () => {
        await expect(saveToICloud(ONE, '{}')).resolves.toBe('saved')

        expect(constructed).toHaveBeenCalledWith('icloud', {
            scope: 'app_data',
        })
        expect(writeFile).toHaveBeenCalledWith(`/${ONE}`, '{}')
    })

    // The Drive client's Content-Length bug is not this transport's problem.
    test('writes non-ASCII contents unchanged', async () => {
        const payload = '{"salt":"café"}'

        await saveToICloud(ONE, payload)

        expect(writeFile).toHaveBeenCalledWith(`/${ONE}`, payload)
    })

    test('throws ICloudUnavailableError without writing when iCloud is off', async () => {
        isCloudAvailable.mockResolvedValueOnce(false)

        await expect(saveToICloud(ONE, '{}')).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
        expect(writeFile).not.toHaveBeenCalled()
    })

    test('propagates a failed write', async () => {
        writeFile.mockRejectedValueOnce(new Error('ERR_WRITE_ERROR'))

        await expect(saveToICloud(ONE, '{}')).rejects.toThrow('ERR_WRITE_ERROR')
    })

    // The availability check passed, so "sign in and turn on iCloud Drive" is
    // advice this user has already followed.
    test('separates a missing container from iCloud being switched off', async () => {
        writeFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.DIRECTORY_NOT_FOUND),
        )

        await expect(saveToICloud(ONE, '{}')).rejects.toBeInstanceOf(
            ICloudNotConfiguredError,
        )
    })

    test('files no crash report for either iCloud state', () => {
        // A missing container is the per-app iCloud switch as often as an
        // unentitled build, so neither is ours to report.
        expect(isExpectedError(new ICloudNotConfiguredError())).toBe(true)
        expect(isExpectedError(new ICloudUnavailableError())).toBe(true)
    })
})

describe('readFromICloud resolving which file to read', () => {
    test('reads the only saved file from the hidden app-data scope', async () => {
        await expect(readFromICloud(options())).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(constructed).toHaveBeenCalledWith('icloud', {
            scope: 'app_data',
        })
        expect(readdir).toHaveBeenCalledWith('/')
        expect(readFile).toHaveBeenCalledWith(`/${ONE}`)
        expect(triggerSync).not.toHaveBeenCalled()
    })

    test('lists and reads through a single container handle', async () => {
        await readFromICloud(options())

        expect(constructed).toHaveBeenCalledTimes(1)
        expect(isCloudAvailable).toHaveBeenCalledTimes(1)
    })

    test('ignores anything in the container that is not ours', async () => {
        readdir.mockResolvedValueOnce(['notes.txt', ONE])
        const chooseFile = vi.fn()

        await readFromICloud(options({ chooseFile }))

        expect(chooseFile).not.toHaveBeenCalled()
        expect(readFile).toHaveBeenCalledWith(`/${ONE}`)
    })

    test('asks which of two saved files to read, then reads the pick', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])
        const chooseFile = vi.fn().mockResolvedValue(OTHER)

        await readFromICloud(options({ chooseFile }))

        expect(chooseFile).toHaveBeenCalledWith([ONE, OTHER])
        expect(readFile).toHaveBeenCalledWith(`/${OTHER}`)
    })

    test('reads nothing when the user backs out of the picker', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])

        await expect(
            readFromICloud(
                options({ chooseFile: vi.fn().mockResolvedValue(null) }),
            ),
        ).resolves.toEqual({ status: 'cancelled' })
        expect(readFile).not.toHaveBeenCalled()
    })

    test('reports a container holding nothing of ours as not found', async () => {
        readdir.mockResolvedValueOnce(['notes.txt'])

        await expect(readFromICloud(options())).rejects.toBeInstanceOf(
            CloudFileNotFoundError,
        )
    })

    test('reports iCloud as unavailable rather than empty', async () => {
        isCloudAvailable.mockResolvedValueOnce(false)

        await expect(readFromICloud(options())).rejects.toBeInstanceOf(
            ICloudUnavailableError,
        )
        expect(readdir).not.toHaveBeenCalled()
    })

    test('maps a missing ubiquity container on the listing to an unconfigured build', async () => {
        readdir.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.DIRECTORY_NOT_FOUND),
        )

        await expect(readFromICloud(options())).rejects.toBeInstanceOf(
            ICloudNotConfiguredError,
        )
    })

    test('maps a missing ubiquity container on the read to an unconfigured build', async () => {
        readFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.DIRECTORY_NOT_FOUND),
        )

        await expect(readFromICloud(options())).rejects.toBeInstanceOf(
            ICloudNotConfiguredError,
        )
    })

    test('signals the read once, after the picker', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])
        const chooseFile = vi.fn().mockResolvedValue(ONE)
        const onReading = vi.fn()

        await readFromICloud(options({ chooseFile, onReading }))

        expect(onReading).toHaveBeenCalledTimes(1)
        expect(onReading.mock.invocationCallOrder[0]!).toBeGreaterThan(
            chooseFile.mock.invocationCallOrder[0]!,
        )
    })

    test('does not signal a read when iCloud is unavailable', async () => {
        isCloudAvailable.mockResolvedValueOnce(false)
        const onReading = vi.fn()

        await expect(
            readFromICloud(options({ onReading })),
        ).rejects.toBeInstanceOf(ICloudUnavailableError)
        expect(onReading).not.toHaveBeenCalled()
    })
})

describe('readFromICloud waiting for a placeholder to download', () => {
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

        const read = readFromICloud(options())
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)

        await expect(read).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(triggerSync).toHaveBeenCalledWith(`/${ONE}`)
        expect(triggerSync.mock.calls.length).toBeGreaterThan(1)
    })

    test('keeps polling when a read reports READ_ERROR, then succeeds', async () => {
        vi.useFakeTimers()
        readFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.READ_ERROR),
        )

        const read = readFromICloud(options())
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)

        await expect(read).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
    })

    // On iOS 18.4+ a placeholder reports READ_ERROR for as long as it takes to
    // download, so the tolerance has to span the window, not the first reads.
    test('keeps waiting while a placeholder reports READ_ERROR past the first poll', async () => {
        vi.useFakeTimers()
        readFile
            .mockRejectedValueOnce(cloudError(CloudStorageErrorCode.READ_ERROR))
            .mockRejectedValueOnce(cloudError(CloudStorageErrorCode.READ_ERROR))
            .mockRejectedValueOnce(cloudError(CloudStorageErrorCode.READ_ERROR))
            .mockRejectedValueOnce(cloudError(CloudStorageErrorCode.READ_ERROR))
            .mockResolvedValueOnce(CONTENTS)

        const read = readFromICloud(options())
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4)

        await expect(read).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(readFile).toHaveBeenCalledTimes(5)
    })

    test('stops waiting when the caller aborts, without reading again', async () => {
        vi.useFakeTimers()
        readFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.FILE_NOT_FOUND),
        )
        const controller = new AbortController()

        const read = readFromICloud(options({ signal: controller.signal }))
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS / 2)
        controller.abort()

        await expect(read).resolves.toEqual({ status: 'cancelled' })
        expect(readFile).toHaveBeenCalledTimes(1)
    })

    test('rethrows a triggerSync failure that is not a not-yet-downloadable placeholder', async () => {
        readFile.mockRejectedValueOnce(
            cloudError(CloudStorageErrorCode.FILE_NOT_FOUND),
        )
        const error = cloudError(CloudStorageErrorCode.UNKNOWN)
        triggerSync.mockRejectedValueOnce(error)

        await expect(readFromICloud(options())).rejects.toBe(error)
    })

    test('says the file is still downloading once the window passes', async () => {
        vi.useFakeTimers()
        for (let i = 0; i <= POLL_ATTEMPTS; i += 1) {
            readFile.mockRejectedValueOnce(
                cloudError(CloudStorageErrorCode.FILE_NOT_FOUND),
            )
        }

        const read = readFromICloud(options())
        // The listing already proved the file is there, so "not found" would be
        // a false statement about the user's only restore credential.
        const assertion = expect(read).rejects.toBeInstanceOf(
            CloudFileNotDownloadedError,
        )
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * POLL_ATTEMPTS)

        await assertion
        expect(readFile).toHaveBeenCalledTimes(POLL_ATTEMPTS + 1)
        expect(triggerSync).toHaveBeenCalledTimes(POLL_ATTEMPTS)
    })

    test('rethrows a read failure that is not a missing file', async () => {
        const error = cloudError(CloudStorageErrorCode.UNKNOWN)
        readFile.mockRejectedValueOnce(error)

        await expect(readFromICloud(options())).rejects.toBe(error)
    })
})
