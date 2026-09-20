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
    GoogleDriveUnreachableError,
    GooglePlayServicesUnavailableError,
} from '@perawallet/wallet-core-backup'
import { isExpectedError } from '@perawallet/wallet-core-shared'
import { readFromGoogleDrive } from '../readFromGoogleDrive'

// The global unit-test stub re-implements AppError as its own class, so an
// error made from the real one is never `instanceof` the stub `isExpectedError`
// checks against. Use the real package so both sides agree.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
}))

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

const { readFile, constructed, mockConfig } = vi.hoisted(() => ({
    readFile: vi.fn(),
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
        constructor(message: string, code: string) {
            super(message)
            this.code = code
        }
    }
    return {
        CloudStorageError,
        CloudStorageErrorCode: {
            AUTHENTICATION_FAILED: 'ERR_AUTHENTICATION_FAILED',
            FILE_NOT_FOUND: 'ERR_FILE_NOT_FOUND',
        },
        CloudStorageProvider: { ICloud: 'icloud', GoogleDrive: 'googledrive' },
        CloudStorageScope: { Documents: 'documents', AppData: 'app_data' },
        CloudStorage: class {
            readFile = readFile
            constructor(...args: unknown[]) {
                constructed(...args)
            }
        },
    }
})

vi.mock('@perawallet/wallet-core-config', () => ({ config: mockConfig }))

const FILE_NAME = 'pera-backup-encryption-key.json'
const CONTENTS = '{"t":"backup-credentials"}'

const signedIn = (scopes: string[]) => ({
    type: 'success',
    data: { user: { id: 'user-1', email: 'user@example.com' }, scopes },
})

const driveOptions = (accessToken: string) => ({
    accessToken,
    scope: 'app_data',
    strictFilenames: false,
    timeout: 15_000,
})

beforeEach(() => {
    vi.clearAllMocks()
    google.hasPreviousSignIn.mockReturnValue(false)
    google.signIn.mockResolvedValue(
        signedIn(['https://www.googleapis.com/auth/drive.appdata']),
    )
    google.clearCachedAccessToken.mockResolvedValue(null)
    google.signOut.mockResolvedValue(null)
    google.hasPlayServices.mockResolvedValue(true)
})

describe('readFromGoogleDrive with the real session', () => {
    test('retries with a fresh token after a 401, then reads the file', async () => {
        google.getTokens
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-1' })
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-2' })
        readFile
            .mockRejectedValueOnce(
                Object.assign(new Error('Unauthorized'), { status: 401 }),
            )
            .mockResolvedValueOnce(CONTENTS)

        await expect(readFromGoogleDrive(FILE_NAME)).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(constructed).toHaveBeenLastCalledWith(
            'googledrive',
            driveOptions('token-2'),
        )
    })

    test('calls onReading once signed in, before fetching the access token', async () => {
        google.getTokens.mockResolvedValue({
            idToken: '',
            accessToken: 'token-1',
        })
        readFile.mockResolvedValue(CONTENTS)
        const onReading = vi.fn()

        await readFromGoogleDrive(FILE_NAME, onReading)

        expect(onReading).toHaveBeenCalledTimes(1)
        expect(onReading.mock.invocationCallOrder[0]).toBeLessThan(
            google.getTokens.mock.invocationCallOrder[0],
        )
    })

    test('does not call onReading when the user cancels sign-in', async () => {
        google.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null })
        const onReading = vi.fn()

        await readFromGoogleDrive(FILE_NAME, onReading)

        expect(onReading).not.toHaveBeenCalled()
    })
})

// Unmapped, each of these reaches the user as the generic banner and files a
// Crashlytics non-fatal, because isExpectedError only spares an AppError.
describe('readFromGoogleDrive failures the user can act on', () => {
    beforeEach(() =>
        google.getTokens.mockResolvedValue({
            idToken: '',
            accessToken: 'token-1',
        }),
    )

    test('names a device without current Play Services', async () => {
        google.hasPlayServices.mockRejectedValueOnce(
            Object.assign(new Error('Play services not available'), {
                code: 'PLAY_SERVICES_NOT_AVAILABLE',
            }),
        )

        const error = await readFromGoogleDrive(FILE_NAME).catch(e => e)

        expect(error).toBeInstanceOf(GooglePlayServicesUnavailableError)
        expect(isExpectedError(error)).toBe(true)
    })

    test('names a timeout, which aborts the fetch rather than raising a CloudStorageError', async () => {
        readFile.mockRejectedValue(
            Object.assign(new Error('Aborted'), { name: 'AbortError' }),
        )

        const error = await readFromGoogleDrive(FILE_NAME).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveUnreachableError)
        expect(isExpectedError(error)).toBe(true)
    })

    test('names a lost connection', async () => {
        readFile.mockRejectedValue(new Error('Network request failed'))

        const error = await readFromGoogleDrive(FILE_NAME).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveUnreachableError)
    })

    // Mapped only once runWithFreshToken has already spent the one retry.
    test('names a rejection that survives the token refresh', async () => {
        readFile.mockRejectedValue(
            Object.assign(new Error('Unauthorized'), { status: 401 }),
        )

        const error = await readFromGoogleDrive(FILE_NAME).catch(e => e)

        expect(error).toBeInstanceOf(GoogleDriveAuthFailedError)
        expect(readFile).toHaveBeenCalledTimes(2)
    })

    test('leaves an unrecognised failure its own identity, so a real bug still reports', async () => {
        readFile.mockRejectedValue(new Error('kaboom'))

        const error = await readFromGoogleDrive(FILE_NAME).catch(e => e)

        expect(error.message).toBe('kaboom')
        expect(isExpectedError(error)).toBe(false)
    })
})
