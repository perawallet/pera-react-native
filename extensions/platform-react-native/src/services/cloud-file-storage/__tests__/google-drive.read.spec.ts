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
    CloudFileNotFoundError,
    GoogleDriveAuthFailedError,
    GoogleDriveUnreachableError,
    GooglePlayServicesUnavailableError,
    type ReadCloudFileOptions,
} from '@perawallet/wallet-extension-platform'
import { isExpectedError } from '@perawallet/wallet-core-shared'
import { Platform } from 'react-native'
import {
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'
import { readFromGoogleDrive } from '../google-drive'

const google = vi.hoisted(() => ({
    configure: vi.fn(),
    hasPreviousSignIn: vi.fn(),
    signInSilently: vi.fn(),
    signIn: vi.fn(),
    addScopes: vi.fn(),
    getTokens: vi.fn(),
    clearCachedAccessToken: vi.fn(),
    signOut: vi.fn(),
    hasPlayServices: vi.fn(),
}))

const { readFile, readdir, constructed, mockConfig } = vi.hoisted(() => ({
    readFile: vi.fn(),
    readdir: vi.fn(),
    constructed: vi.fn(),
    mockConfig: {
        googleIosClientId: 'ios-client.apps.googleusercontent.com',
        googleWebClientId: 'web-client.apps.googleusercontent.com',
    },
}))

vi.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: google,
    isSuccessResponse: (response: { type: string }) =>
        response.type === 'success',
    isCancelledResponse: (response: { type: string }) =>
        response.type === 'cancelled',
    isNoSavedCredentialFoundResponse: (response: { type: string }) =>
        response.type === 'noSavedCredentialFound',
}))

vi.mock('react-native-cloud-storage', () => {
    class CloudStorageError extends Error {
        code: string
        details?: unknown
        constructor(message: string, code: string, details?: unknown) {
            super(message)
            this.code = code
            this.details = details
        }
    }
    return {
        CloudStorageError,
        CloudStorageErrorCode: {
            AUTHENTICATION_FAILED: 'ERR_AUTHENTICATION_FAILED',
            FILE_NOT_FOUND: 'ERR_FILE_NOT_FOUND',
            NETWORK_ERROR: 'ERR_NETWORK_ERROR',
            UNKNOWN: 'ERR_UNKNOWN',
        },
        CloudStorageProvider: { ICloud: 'icloud', GoogleDrive: 'googledrive' },
        CloudStorageScope: { Documents: 'documents', AppData: 'app_data' },
        CloudStorage: class {
            readFile = readFile
            readdir = readdir
            constructor(...args: unknown[]) {
                constructed(...args)
            }
        },
    }
})

vi.mock('@perawallet/wallet-core-config', () => ({ config: mockConfig }))

const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const ONE = 'pera-backup-VQBGR.json'
const OTHER = 'pera-backup-ZZZZZ.json'
const CONTENTS = '{"t":"backup-credentials"}'

const isCandidate = (fileName: string) => fileName.startsWith('pera-backup-')
const options = (
    extra: Partial<ReadCloudFileOptions> = {},
): ReadCloudFileOptions => ({
    isCandidate,
    chooseFile: async () => null,
    ...extra,
})

const signedIn = (scopes: string[]) => ({
    type: 'success',
    data: { user: { id: 'user-1', email: 'user@example.com' }, scopes },
})

// What the library's file-id lookup hands back: anything that isn't already a
// CloudStorageError is re-thrown as UNKNOWN with the original in `details`.
const wrappedByFileIdLookup = (cause: Error) =>
    new CloudStorageError(
        `Could not get file id for path /${ONE}`,
        CloudStorageErrorCode.UNKNOWN,
        cause,
    )

// A 401 whose body isn't JSON — a proxy or captive portal — so the lookup's
// `UNAUTHENTICATED` check misses it and it arrives wrapped as UNKNOWN.
const unauthorizedHttpError = () =>
    Object.assign(new Error('Request failed with status 401'), { status: 401 })

const driveOptions = (accessToken: string) => ({
    accessToken,
    scope: 'app_data',
    strictFilenames: false,
    timeout: 15_000,
})

const originalOS = Platform.OS

beforeEach(() => {
    vi.clearAllMocks()
    google.hasPreviousSignIn.mockReturnValue(false)
    google.signIn.mockResolvedValue(signedIn([DRIVE_APPDATA_SCOPE]))
    google.getTokens.mockResolvedValue({ idToken: '', accessToken: 'token-1' })
    google.clearCachedAccessToken.mockResolvedValue(null)
    google.signOut.mockResolvedValue(null)
    google.hasPlayServices.mockResolvedValue(true)
    readdir.mockResolvedValue([ONE])
    readFile.mockResolvedValue(CONTENTS)
})

afterEach(() => {
    Platform.OS = originalOS
})

describe('readFromGoogleDrive resolving which file to read', () => {
    test('reads the only saved file without asking', async () => {
        const chooseFile = vi.fn()

        await expect(
            readFromGoogleDrive(options({ chooseFile })),
        ).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(readdir).toHaveBeenCalledWith('/')
        expect(readFile).toHaveBeenCalledWith(`/${ONE}`)
        expect(chooseFile).not.toHaveBeenCalled()
    })

    test('ignores anything in appDataFolder that is not ours', async () => {
        readdir.mockResolvedValueOnce(['other-app.json', ONE])
        const chooseFile = vi.fn()

        await readFromGoogleDrive(options({ chooseFile }))

        expect(chooseFile).not.toHaveBeenCalled()
        expect(readFile).toHaveBeenCalledWith(`/${ONE}`)
    })

    test('asks which of two saved files to read, then reads the pick', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])
        const chooseFile = vi.fn().mockResolvedValue(OTHER)

        await readFromGoogleDrive(options({ chooseFile }))

        expect(chooseFile).toHaveBeenCalledWith([ONE, OTHER])
        expect(readFile).toHaveBeenCalledWith(`/${OTHER}`)
    })

    test('reads nothing when the user backs out of the picker', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])
        const chooseFile = vi.fn().mockResolvedValue(null)

        await expect(
            readFromGoogleDrive(options({ chooseFile })),
        ).resolves.toEqual({ status: 'cancelled' })
        expect(readFile).not.toHaveBeenCalled()
    })

    test('reports an account holding nothing of ours as not found, and signs out so another can be picked', async () => {
        readdir.mockResolvedValueOnce(['other-app.json'])

        await expect(readFromGoogleDrive(options())).rejects.toBeInstanceOf(
            CloudFileNotFoundError,
        )
        expect(google.signOut).toHaveBeenCalledTimes(1)
    })

    test('still reports not found when the sign-out itself fails', async () => {
        readdir.mockResolvedValueOnce([])
        google.signOut.mockRejectedValueOnce(new Error('offline'))

        await expect(readFromGoogleDrive(options())).rejects.toBeInstanceOf(
            CloudFileNotFoundError,
        )
    })

    // The listing just proved it was there, so this is a mid-session delete.
    test('reports a file that disappears between the listing and the read as not found', async () => {
        readFile.mockRejectedValue(
            new CloudStorageError(
                'File not found',
                CloudStorageErrorCode.FILE_NOT_FOUND,
            ),
        )

        await expect(readFromGoogleDrive(options())).rejects.toBeInstanceOf(
            CloudFileNotFoundError,
        )
        expect(readFile).toHaveBeenCalledTimes(1)
        expect(google.signOut).toHaveBeenCalledTimes(1)
    })
})

describe('readFromGoogleDrive using one session', () => {
    test('lists and reads inside a single sign-in, on one Drive client', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])

        await readFromGoogleDrive(
            options({ chooseFile: vi.fn().mockResolvedValue(ONE) }),
        )

        expect(google.configure).toHaveBeenCalledTimes(1)
        expect(google.hasPlayServices).toHaveBeenCalledTimes(1)
        expect(google.signIn).toHaveBeenCalledTimes(1)
        expect(google.getTokens).toHaveBeenCalledTimes(1)
        expect(constructed).toHaveBeenCalledTimes(1)
    })

    test('signals the read once, after the picker rather than after sign-in', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])
        const onReading = vi.fn()
        const chooseFile = vi.fn().mockResolvedValue(ONE)

        await readFromGoogleDrive(options({ chooseFile, onReading }))

        expect(onReading).toHaveBeenCalledTimes(1)
        expect(onReading.mock.invocationCallOrder[0]!).toBeGreaterThan(
            chooseFile.mock.invocationCallOrder[0]!,
        )
        expect(onReading.mock.invocationCallOrder[0]!).toBeLessThan(
            readFile.mock.invocationCallOrder[0]!,
        )
    })

    test('does not signal a read when the user cancels sign-in', async () => {
        google.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null })
        const onReading = vi.fn()

        await expect(
            readFromGoogleDrive(options({ onReading })),
        ).resolves.toEqual({ status: 'cancelled' })
        expect(onReading).not.toHaveBeenCalled()
    })

    test('does not signal a read when the user backs out of the picker', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])
        const onReading = vi.fn()

        await readFromGoogleDrive(
            options({ chooseFile: vi.fn().mockResolvedValue(null), onReading }),
        )

        expect(onReading).not.toHaveBeenCalled()
    })

    // runOnGoogleDrive re-runs its operation once after a rejected token.
    test('reuses the file already picked when the retry runs, rather than prompting twice', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])
        const chooseFile = vi.fn().mockResolvedValue(OTHER)
        const onReading = vi.fn()
        google.getTokens
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-1' })
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-2' })
        readFile
            .mockRejectedValueOnce(
                Object.assign(new Error('Unauthorized'), { status: 401 }),
            )
            .mockResolvedValueOnce(CONTENTS)

        await expect(
            readFromGoogleDrive(options({ chooseFile, onReading })),
        ).resolves.toEqual({ status: 'read', contents: CONTENTS })

        expect(chooseFile).toHaveBeenCalledTimes(1)
        expect(readdir).toHaveBeenCalledTimes(1)
        expect(onReading).toHaveBeenCalledTimes(1)
        expect(readFile).toHaveBeenCalledTimes(2)
        expect(constructed).toHaveBeenLastCalledWith(
            'googledrive',
            driveOptions('token-2'),
        )
    })

    test('retries the listing with a fresh token when the token is rejected before a pick', async () => {
        google.getTokens
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-1' })
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-2' })
        readdir
            .mockRejectedValueOnce(
                wrappedByFileIdLookup(unauthorizedHttpError()),
            )
            .mockResolvedValueOnce([ONE])

        await expect(readFromGoogleDrive(options())).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(readdir).toHaveBeenCalledTimes(2)
    })

    test('signs out on iOS when a wrapped 401 survives the fresh token', async () => {
        Platform.OS = 'ios'
        readFile.mockRejectedValue(
            wrappedByFileIdLookup(unauthorizedHttpError()),
        )

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveAuthFailedError)
        expect(google.signOut).toHaveBeenCalledTimes(1)
        expect(readFile).toHaveBeenCalledTimes(2)
    })
})

describe('readFromGoogleDrive releasing the Drive grant', () => {
    test('signs out once the read is done', async () => {
        await readFromGoogleDrive(options())

        expect(google.signOut).toHaveBeenCalledTimes(1)
        expect(google.signOut.mock.invocationCallOrder[0]!).toBeGreaterThan(
            readFile.mock.invocationCallOrder[0]!,
        )
    })

    test('returns the contents even when the sign-out fails', async () => {
        google.signOut.mockRejectedValueOnce(new Error('offline'))

        await expect(readFromGoogleDrive(options())).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
    })

    test('stays signed in when the user backs out of the picker', async () => {
        readdir.mockResolvedValueOnce([ONE, OTHER])

        await readFromGoogleDrive(
            options({ chooseFile: vi.fn().mockResolvedValue(null) }),
        )

        expect(google.signOut).not.toHaveBeenCalled()
    })

    test('stays signed in after an unrecognised failure', async () => {
        readFile.mockRejectedValueOnce(new Error('kaboom'))

        await expect(readFromGoogleDrive(options())).rejects.toThrow('kaboom')
        expect(google.signOut).not.toHaveBeenCalled()
    })
})

// Unmapped, each of these reaches the user as the generic banner and files a
// Crashlytics non-fatal, because isExpectedError only spares an AppError.
describe('readFromGoogleDrive failures the user can act on', () => {
    test('names a device without current Play Services', async () => {
        google.hasPlayServices.mockRejectedValueOnce(
            Object.assign(new Error('Play services not available'), {
                code: 'PLAY_SERVICES_NOT_AVAILABLE',
            }),
        )

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error).toBeInstanceOf(GooglePlayServicesUnavailableError)
        expect(isExpectedError(error)).toBe(true)
    })

    test('names a timeout that aborts a fetch past the file-id lookup', async () => {
        readFile.mockRejectedValue(
            Object.assign(new Error('Aborted'), { name: 'AbortError' }),
        )

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveUnreachableError)
        expect(isExpectedError(error)).toBe(true)
    })

    test('names a timeout during the file-id lookup, where it is wrapped as UNKNOWN', async () => {
        readFile.mockRejectedValue(
            wrappedByFileIdLookup(
                Object.assign(new Error('Aborted'), { name: 'AbortError' }),
            ),
        )

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveUnreachableError)
        expect(isExpectedError(error)).toBe(true)
    })

    test('names a lost connection', async () => {
        readFile.mockRejectedValue(new Error('Network request failed'))

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveUnreachableError)
    })

    test('names a lost connection during the file-id lookup', async () => {
        readFile.mockRejectedValue(
            wrappedByFileIdLookup(new TypeError('Network request failed')),
        )

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveUnreachableError)
        expect(isExpectedError(error)).toBe(true)
    })

    // Mapped only once runWithFreshToken has already spent the one retry.
    test('names a rejection that survives the token refresh', async () => {
        readFile.mockRejectedValue(
            Object.assign(new Error('Unauthorized'), { status: 401 }),
        )

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveAuthFailedError)
        expect(readFile).toHaveBeenCalledTimes(2)
    })

    test('leaves an unrecognised failure its own identity, so a real bug still reports', async () => {
        readFile.mockRejectedValue(new Error('kaboom'))

        const error = await readFromGoogleDrive(options()).catch(e => e)

        expect(error.message).toBe('kaboom')
        expect(isExpectedError(error)).toBe(false)
    })
})
