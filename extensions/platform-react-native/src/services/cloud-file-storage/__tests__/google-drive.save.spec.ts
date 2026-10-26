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
    GoogleDriveAuthFailedError,
    GoogleDriveNotConfiguredError,
    GooglePlayServicesUnavailableError,
} from '@perawallet/wallet-extension-platform'
import {
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'
import { saveToGoogleDrive } from '../google-drive'

const auth = vi.hoisted(() => ({
    isGoogleDriveConfigured: vi.fn(),
    authorizeGoogleDrive: vi.fn(),
    releaseGoogleDriveToken: vi.fn(),
}))

vi.mock('../google-auth', () => ({
    ...auth,
    DRIVE_FILE_SCOPE: 'https://www.googleapis.com/auth/drive.file',
    DRIVE_TIMEOUT_MS: 15_000,
}))

const { writeFile, mkdir, constructed } = vi.hoisted(() => ({
    writeFile: vi.fn(),
    mkdir: vi.fn(),
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
            AUTHENTICATION_FAILED: 'ERR_AUTHENTICATION_FAILED',
            DIRECTORY_NOT_FOUND: 'ERR_DIRECTORY_NOT_FOUND',
            FILE_ALREADY_EXISTS: 'ERR_FILE_EXISTS',
        },
        CloudStorageProvider: { ICloud: 'icloud', GoogleDrive: 'googledrive' },
        CloudStorageScope: { Documents: 'documents', AppData: 'app_data' },
        CloudStorage: class {
            writeFile = writeFile
            mkdir = mkdir
            constructor(...args: unknown[]) {
                constructed(...args)
            }
        },
    }
})

const FILE_NAME = 'pera-backup-encryption-key.json'
const CONTENTS = '{}'

const driveOptions = (accessToken: string) => ({
    accessToken,
    scope: 'documents',
    strictFilenames: false,
    timeout: 15_000,
})

const unauthorized = () =>
    new CloudStorageError(
        'unauthorized',
        CloudStorageErrorCode.AUTHENTICATION_FAILED,
    )

beforeEach(() => {
    vi.clearAllMocks()
    auth.isGoogleDriveConfigured.mockReturnValue(true)
    auth.authorizeGoogleDrive.mockResolvedValue('token-1')
    auth.releaseGoogleDriveToken.mockResolvedValue(undefined)
    writeFile.mockResolvedValue(undefined)
    mkdir.mockResolvedValue(undefined)
})

describe('saveToGoogleDrive', () => {
    test('throws when Google auth is not configured, without authorizing', async () => {
        auth.isGoogleDriveConfigured.mockReturnValue(false)

        await expect(
            saveToGoogleDrive(FILE_NAME, CONTENTS),
        ).rejects.toBeInstanceOf(GoogleDriveNotConfiguredError)
        expect(auth.authorizeGoogleDrive).not.toHaveBeenCalled()
    })

    test('authorizes, then writes the file into the Pera Wallet folder with the access token', async () => {
        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )

        expect(constructed).toHaveBeenCalledWith(
            'googledrive',
            driveOptions('token-1'),
        )
        expect(writeFile).toHaveBeenCalledWith(
            `/Pera Wallet/${FILE_NAME}`,
            CONTENTS,
        )
    })

    test('names missing Play Services', async () => {
        auth.authorizeGoogleDrive.mockRejectedValueOnce(
            Object.assign(new Error('unavailable'), {
                code: 'PLAY_SERVICES_NOT_AVAILABLE',
            }),
        )

        await expect(
            saveToGoogleDrive(FILE_NAME, CONTENTS),
        ).rejects.toBeInstanceOf(GooglePlayServicesUnavailableError)
    })

    test('resolves cancelled when the user backs out of authorization', async () => {
        auth.authorizeGoogleDrive.mockResolvedValueOnce(null)

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'cancelled',
        )
        expect(writeFile).not.toHaveBeenCalled()
    })

    test('rethrows when authorization fails', async () => {
        auth.authorizeGoogleDrive.mockRejectedValueOnce(new Error('boom'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'boom',
        )
        expect(writeFile).not.toHaveBeenCalled()
    })

    test('releases a rejected token and retries once with a fresh one', async () => {
        writeFile.mockRejectedValueOnce(unauthorized())
        auth.authorizeGoogleDrive
            .mockResolvedValueOnce('token-1')
            .mockResolvedValueOnce('token-2')

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )

        expect(auth.releaseGoogleDriveToken).toHaveBeenNthCalledWith(
            1,
            'token-1',
        )
        expect(
            auth.releaseGoogleDriveToken.mock.invocationCallOrder[0]!,
        ).toBeLessThan(auth.authorizeGoogleDrive.mock.invocationCallOrder[1]!)
        expect(constructed).toHaveBeenLastCalledWith(
            'googledrive',
            driveOptions('token-2'),
        )
    })

    test('still retries when releasing the rejected token fails', async () => {
        writeFile.mockRejectedValueOnce(unauthorized())
        auth.authorizeGoogleDrive
            .mockResolvedValueOnce('token-1')
            .mockResolvedValueOnce('token-2')
        auth.releaseGoogleDriveToken.mockRejectedValueOnce(
            Object.assign(new Error('clear failed'), {
                code: 'ERR_GOOGLE_AUTH',
            }),
        )

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )
        expect(constructed).toHaveBeenLastCalledWith(
            'googledrive',
            driveOptions('token-2'),
        )
    })

    test('resolves cancelled when the user backs out of the retry', async () => {
        writeFile.mockRejectedValueOnce(unauthorized())
        auth.authorizeGoogleDrive
            .mockResolvedValueOnce('token-1')
            .mockResolvedValueOnce(null)

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'cancelled',
        )
    })

    test('releases the fresh token too when it is also rejected', async () => {
        writeFile
            .mockRejectedValueOnce(
                Object.assign(new Error('Unauthorized'), { status: 401 }),
            )
            .mockRejectedValueOnce(
                Object.assign(new Error('Unauthorized'), { status: 401 }),
            )
        auth.authorizeGoogleDrive
            .mockResolvedValueOnce('token-1')
            .mockResolvedValueOnce('token-2')

        await expect(
            saveToGoogleDrive(FILE_NAME, CONTENTS),
        ).rejects.toBeInstanceOf(GoogleDriveAuthFailedError)

        expect(writeFile).toHaveBeenCalledTimes(2)
        expect(auth.releaseGoogleDriveToken).toHaveBeenLastCalledWith('token-2')
    })

    test('does not retry other failures', async () => {
        writeFile.mockRejectedValueOnce(new Error('quota exceeded'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'quota exceeded',
        )
        expect(auth.authorizeGoogleDrive).toHaveBeenCalledTimes(1)
        expect(mkdir).not.toHaveBeenCalled()
        expect(writeFile).toHaveBeenCalledTimes(1)
    })
})

describe('saveToGoogleDrive releasing the token', () => {
    test('releases it once the write is done', async () => {
        await saveToGoogleDrive(FILE_NAME, CONTENTS)

        expect(auth.releaseGoogleDriveToken).toHaveBeenCalledExactlyOnceWith(
            'token-1',
        )
        expect(
            auth.releaseGoogleDriveToken.mock.invocationCallOrder[0]!,
        ).toBeGreaterThan(writeFile.mock.invocationCallOrder[0]!)
    })

    test('keeps it when the user backs out, so a retry does not prompt again', async () => {
        auth.authorizeGoogleDrive.mockResolvedValueOnce(null)

        await saveToGoogleDrive(FILE_NAME, CONTENTS)

        expect(auth.releaseGoogleDriveToken).not.toHaveBeenCalled()
    })

    test('reports the save as done even when the release fails', async () => {
        auth.releaseGoogleDriveToken.mockRejectedValueOnce(new Error('offline'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )
    })

    test('keeps it after an unrecognised write failure, so a retry is not a fresh grant', async () => {
        writeFile.mockRejectedValueOnce(new Error('quota exceeded'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'quota exceeded',
        )
        expect(auth.releaseGoogleDriveToken).not.toHaveBeenCalled()
    })
})

describe('saveToGoogleDrive escaping the payload for the Drive client', () => {
    const NON_ASCII = '{"salt":"café","note":"日本"}'

    test('writes every non-ASCII character as a JSON escape', async () => {
        await saveToGoogleDrive(FILE_NAME, NON_ASCII)

        const [, written] = writeFile.mock.calls[0] as [string, string]
        expect(written).toBe('{"salt":"caf\\u00e9","note":"\\u65e5\\u672c"}')
        expect(/^[\x00-\x7e]*$/.test(written)).toBe(true)
    })

    test('escapes to the same value, so the restore reads back what was saved', async () => {
        await saveToGoogleDrive(FILE_NAME, NON_ASCII)

        const [, written] = writeFile.mock.calls[0] as [string, string]
        expect(JSON.parse(written)).toEqual(JSON.parse(NON_ASCII))
    })

    test('leaves a printable-ASCII payload byte for byte', async () => {
        const ascii = '{"salt":"YWJj","argon2id":{"m":65536}}'

        await saveToGoogleDrive(FILE_NAME, ascii)

        expect(writeFile).toHaveBeenCalledWith(
            `/Pera Wallet/${FILE_NAME}`,
            ascii,
        )
    })
})

describe('saveToGoogleDrive folder', () => {
    test('creates the folder on a first save, then retries the write once', async () => {
        writeFile.mockRejectedValueOnce(
            new CloudStorageError(
                'not found',
                CloudStorageErrorCode.DIRECTORY_NOT_FOUND,
            ),
        )

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )

        expect(mkdir).toHaveBeenCalledWith('/Pera Wallet')
        expect(writeFile).toHaveBeenCalledTimes(2)
        expect(writeFile).toHaveBeenLastCalledWith(
            `/Pera Wallet/${FILE_NAME}`,
            CONTENTS,
        )
    })

    test('does not create the folder once the write already succeeds', async () => {
        await saveToGoogleDrive(FILE_NAME, CONTENTS)

        expect(mkdir).not.toHaveBeenCalled()
        expect(writeFile).toHaveBeenCalledTimes(1)
    })

    test('treats a racing folder creation as success and still retries the write', async () => {
        writeFile.mockRejectedValueOnce(
            new CloudStorageError(
                'not found',
                CloudStorageErrorCode.DIRECTORY_NOT_FOUND,
            ),
        )
        mkdir.mockRejectedValueOnce(
            new CloudStorageError(
                'exists',
                CloudStorageErrorCode.FILE_ALREADY_EXISTS,
            ),
        )

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )

        expect(writeFile).toHaveBeenCalledTimes(2)
    })

    test('rethrows an mkdir failure that is not the folder already existing, without retrying the write', async () => {
        writeFile.mockRejectedValueOnce(
            new CloudStorageError(
                'not found',
                CloudStorageErrorCode.DIRECTORY_NOT_FOUND,
            ),
        )
        mkdir.mockRejectedValueOnce(new Error('mkdir failed'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'mkdir failed',
        )

        expect(writeFile).toHaveBeenCalledTimes(1)
    })

    // The library gives no way to close this race, only narrow it: this is
    // what a second device losing it looks like from here, and it is meant to
    // reach the generic banner rather than be retried again.
    test('propagates a directory-not-found that survives the retry write', async () => {
        writeFile
            .mockRejectedValueOnce(
                new CloudStorageError(
                    'not found',
                    CloudStorageErrorCode.DIRECTORY_NOT_FOUND,
                ),
            )
            .mockRejectedValueOnce(
                new CloudStorageError(
                    'still not found',
                    CloudStorageErrorCode.DIRECTORY_NOT_FOUND,
                ),
            )

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'still not found',
        )

        expect(mkdir).toHaveBeenCalledTimes(1)
        expect(writeFile).toHaveBeenCalledTimes(2)
    })
})
