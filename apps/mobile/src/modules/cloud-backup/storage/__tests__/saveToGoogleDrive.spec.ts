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
    GoogleDriveAuthFailedError,
    GoogleDriveNotConfiguredError,
} from '@perawallet/wallet-core-backup'
import { Platform } from 'react-native'
import {
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'
import { DRIVE_APPDATA_SCOPE } from '../googleDriveSession'
import { saveToGoogleDrive } from '../saveToGoogleDrive'

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

const { writeFile, constructed, mockConfig } = vi.hoisted(() => ({
    writeFile: vi.fn(),
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
        },
        CloudStorageProvider: { ICloud: 'icloud', GoogleDrive: 'googledrive' },
        CloudStorageScope: { Documents: 'documents', AppData: 'app_data' },
        CloudStorage: class {
            writeFile = writeFile
            constructor(...args: unknown[]) {
                constructed(...args)
            }
        },
    }
})

vi.mock('@perawallet/wallet-core-config', () => ({ config: mockConfig }))

const FILE_NAME = 'pera-backup-encryption-key.json'
const CONTENTS = '{}'
const originalOS = Platform.OS
const originalIosClientId = mockConfig.googleIosClientId
const originalWebClientId = mockConfig.googleWebClientId

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
    Platform.OS = 'ios'
    google.hasPreviousSignIn.mockReturnValue(false)
    google.signIn.mockResolvedValue(signedIn([DRIVE_APPDATA_SCOPE]))
    google.getTokens.mockResolvedValue({ idToken: '', accessToken: 'token-1' })
    google.clearCachedAccessToken.mockResolvedValue(null)
    google.signOut.mockResolvedValue(null)
    google.hasPlayServices.mockResolvedValue(true)
    writeFile.mockResolvedValue(undefined)
})

afterEach(() => {
    Platform.OS = originalOS
    mockConfig.googleIosClientId = originalIosClientId
    mockConfig.googleWebClientId = originalWebClientId
})

describe('saveToGoogleDrive', () => {
    test('throws when this platform has no OAuth client configured', async () => {
        mockConfig.googleIosClientId = ''

        await expect(
            saveToGoogleDrive(FILE_NAME, CONTENTS),
        ).rejects.toBeInstanceOf(GoogleDriveNotConfiguredError)
        expect(google.signIn).not.toHaveBeenCalled()
    })

    test('throws on Android when no web client id is configured', async () => {
        Platform.OS = 'android'
        mockConfig.googleWebClientId = ''

        await expect(
            saveToGoogleDrive(FILE_NAME, CONTENTS),
        ).rejects.toBeInstanceOf(GoogleDriveNotConfiguredError)
        expect(google.signIn).not.toHaveBeenCalled()
    })

    test('signs in, then writes the file to the app-data folder with the access token', async () => {
        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )

        expect(google.configure).toHaveBeenCalledWith({
            scopes: [DRIVE_APPDATA_SCOPE],
            iosClientId: mockConfig.googleIosClientId,
            webClientId: mockConfig.googleWebClientId,
        })
        expect(constructed).toHaveBeenCalledWith(
            'googledrive',
            driveOptions('token-1'),
        )
        expect(writeFile).toHaveBeenCalledWith(`/${FILE_NAME}`, CONTENTS)
    })

    test('checks Play Services before signing in', async () => {
        await saveToGoogleDrive(FILE_NAME, CONTENTS)

        expect(google.hasPlayServices).toHaveBeenCalledWith({
            showPlayServicesUpdateDialog: true,
        })
        expect(google.hasPlayServices.mock.invocationCallOrder[0]).toBeLessThan(
            google.signIn.mock.invocationCallOrder[0],
        )
    })

    test('rethrows when Play Services are unavailable, before any sign-in', async () => {
        google.hasPlayServices.mockRejectedValueOnce(
            new Error('PLAY_SERVICES_NOT_AVAILABLE'),
        )

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'PLAY_SERVICES_NOT_AVAILABLE',
        )
        expect(google.signIn).not.toHaveBeenCalled()
    })

    test('reuses a previous sign-in without prompting', async () => {
        google.hasPreviousSignIn.mockReturnValue(true)
        google.signInSilently.mockResolvedValueOnce(
            signedIn([DRIVE_APPDATA_SCOPE]),
        )

        await saveToGoogleDrive(FILE_NAME, CONTENTS)

        expect(google.signIn).not.toHaveBeenCalled()
    })

    test('prompts when the previous sign-in has no saved credential', async () => {
        google.hasPreviousSignIn.mockReturnValue(true)
        google.signInSilently.mockResolvedValueOnce({
            type: 'noSavedCredentialFound',
            data: null,
        })

        await saveToGoogleDrive(FILE_NAME, CONTENTS)

        expect(google.signIn).toHaveBeenCalled()
    })

    test('prompts when restoring a previous sign-in fails', async () => {
        google.hasPreviousSignIn.mockReturnValue(true)
        google.signInSilently.mockRejectedValueOnce(new Error('revoked'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )
        expect(google.signIn).toHaveBeenCalled()
    })

    test('resolves cancelled when the user dismisses sign-in', async () => {
        google.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null })

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'cancelled',
        )
        expect(writeFile).not.toHaveBeenCalled()
    })

    test('asks for the Drive scope when the account has not granted it', async () => {
        google.signIn.mockResolvedValueOnce(signedIn([]))
        google.addScopes.mockResolvedValueOnce(signedIn([DRIVE_APPDATA_SCOPE]))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )
        expect(google.addScopes).toHaveBeenCalledWith({
            scopes: [DRIVE_APPDATA_SCOPE],
        })
    })

    test('resolves cancelled when the Drive scope is refused', async () => {
        google.signIn.mockResolvedValueOnce(signedIn([]))
        google.addScopes.mockResolvedValueOnce({
            type: 'cancelled',
            data: null,
        })

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'cancelled',
        )
        expect(writeFile).not.toHaveBeenCalled()
    })

    test('rethrows when the access token cannot be fetched', async () => {
        google.getTokens.mockRejectedValueOnce(new Error('network'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'network',
        )
        expect(writeFile).not.toHaveBeenCalled()
    })

    test('on Android, drops the rejected token from the cache and retries once with a fresh one', async () => {
        Platform.OS = 'android'
        writeFile.mockRejectedValueOnce(
            new CloudStorageError(
                'unauthorized',
                CloudStorageErrorCode.AUTHENTICATION_FAILED,
            ),
        )
        google.getTokens
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-1' })
            .mockResolvedValueOnce({ idToken: '', accessToken: 'token-2' })

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).resolves.toBe(
            'saved',
        )

        expect(google.clearCachedAccessToken).toHaveBeenCalledWith('token-1')
        expect(constructed).toHaveBeenLastCalledWith(
            'googledrive',
            driveOptions('token-2'),
        )
        expect(google.signOut).not.toHaveBeenCalled()
    })

    test('on iOS, signs out when the retried token is rejected too, so the next save prompts', async () => {
        writeFile
            .mockRejectedValueOnce(
                Object.assign(new Error('Unauthorized'), { status: 401 }),
            )
            .mockRejectedValueOnce(
                Object.assign(new Error('Unauthorized'), { status: 401 }),
            )

        await expect(
            saveToGoogleDrive(FILE_NAME, CONTENTS),
        ).rejects.toBeInstanceOf(GoogleDriveAuthFailedError)

        expect(writeFile).toHaveBeenCalledTimes(2)
        expect(google.clearCachedAccessToken).not.toHaveBeenCalled()
        expect(google.signOut).toHaveBeenCalledTimes(1)
    })

    test('does not retry other failures', async () => {
        writeFile.mockRejectedValueOnce(new Error('quota exceeded'))

        await expect(saveToGoogleDrive(FILE_NAME, CONTENTS)).rejects.toThrow(
            'quota exceeded',
        )
        expect(google.getTokens).toHaveBeenCalledTimes(1)
    })
})
