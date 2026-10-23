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
import { Platform } from 'react-native'
import { GoogleDriveAuthFailedError } from '@perawallet/wallet-extension-platform'
import { createCodeChallenge } from '@perawallet/wallet-core-shared'
import {
    authorizeGoogleDrive,
    DRIVE_FILE_SCOPE,
    DRIVE_TIMEOUT_MS,
    isGoogleDriveConfigured,
    releaseGoogleDriveToken,
} from '../google-auth'

const { native, nativeModule, mockConfig, fetchMock } = vi.hoisted(() => {
    const native = {
        authenticate: vi.fn(),
        authorize: vi.fn(),
        clearToken: vi.fn(),
    }
    return {
        native,
        nativeModule: { current: native as typeof native | null },
        mockConfig: {
            googleIosClientId: '1234-abc.apps.googleusercontent.com',
        },
        fetchMock: vi.fn(),
    }
})

vi.mock('expo', () => ({
    requireOptionalNativeModule: (name: string) =>
        name === 'PeraGoogleAuth' ? nativeModule.current : null,
}))

vi.mock('@perawallet/wallet-core-config', () => ({ config: mockConfig }))

const CALLBACK_SCHEME = 'com.googleusercontent.apps.1234-abc'
const REDIRECT_URI = `${CALLBACK_SCHEME}:/oauth2redirect`
const originalOS = Platform.OS
const originalClientId = mockConfig.googleIosClientId

const tokenResponse = (body: Record<string, unknown>, ok = true) => ({
    ok,
    json: async () => body,
})

const query = (url: string): Record<string, string> =>
    Object.fromEntries(
        url
            .split('?')[1]!
            .split('&')
            .map(pair => pair.split('=').map(decodeURIComponent)),
    )

// Echoes the authorize request's `state` back the way Google's redirect does.
const redirectWith = (params: Record<string, string>) =>
    native.authenticate.mockImplementationOnce(async (url: string) => {
        const { state } = query(url)
        const echoed = { state: state!, ...params }
        return `${REDIRECT_URI}?${new URLSearchParams(echoed).toString()}`
    })

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    Platform.OS = 'ios'
    nativeModule.current = native
    fetchMock.mockResolvedValue(
        tokenResponse({ access_token: 'token-1', scope: DRIVE_FILE_SCOPE }),
    )
})

afterEach(() => {
    vi.unstubAllGlobals()
    Platform.OS = originalOS
    mockConfig.googleIosClientId = originalClientId
})

describe('isGoogleDriveConfigured', () => {
    test('needs the iOS client id on iOS', () => {
        expect(isGoogleDriveConfigured()).toBe(true)

        mockConfig.googleIosClientId = ''

        expect(isGoogleDriveConfigured()).toBe(false)
    })

    test('needs no client id on Android', () => {
        Platform.OS = 'android'
        mockConfig.googleIosClientId = ''

        expect(isGoogleDriveConfigured()).toBe(true)
    })

    test('is false when the native module is not linked', () => {
        nativeModule.current = null

        expect(isGoogleDriveConfigured()).toBe(false)
    })
})

describe('authorizeGoogleDrive on iOS', () => {
    test('asks for drive.file with a PKCE challenge, redirecting to the reversed client id', async () => {
        redirectWith({ code: 'auth-code', scope: DRIVE_FILE_SCOPE })

        await authorizeGoogleDrive()

        const [url, scheme] = native.authenticate.mock.calls[0] as [
            string,
            string,
        ]
        expect(
            url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'),
        ).toBe(true)
        expect(scheme).toBe(CALLBACK_SCHEME)
        expect(query(url)).toMatchObject({
            client_id: mockConfig.googleIosClientId,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: DRIVE_FILE_SCOPE,
            code_challenge_method: 'S256',
            prompt: 'select_account',
        })
    })

    test('exchanges the code with the verifier behind the challenge, and returns the access token', async () => {
        redirectWith({ code: 'auth-code' })

        await expect(authorizeGoogleDrive()).resolves.toBe('token-1')

        const { code_challenge: challenge } = query(
            native.authenticate.mock.calls[0]![0] as string,
        )
        const [endpoint, init] = fetchMock.mock.calls[0] as [
            string,
            { method: string; body: string },
        ]
        const body = query(`?${init.body}`)
        expect(endpoint).toBe('https://oauth2.googleapis.com/token')
        expect(init.method).toBe('POST')
        expect(body).toMatchObject({
            code: 'auth-code',
            client_id: mockConfig.googleIosClientId,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        })
        expect(createCodeChallenge(body.code_verifier!)).toBe(challenge)
    })

    test('resolves null when the user closes the sheet', async () => {
        native.authenticate.mockResolvedValueOnce(null)

        await expect(authorizeGoogleDrive()).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('resolves null when the user declines consent', async () => {
        redirectWith({ error: 'access_denied' })

        await expect(authorizeGoogleDrive()).resolves.toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('resolves null when the user unticks the Drive scope', async () => {
        redirectWith({ code: 'auth-code' })
        fetchMock.mockResolvedValueOnce(
            tokenResponse({ access_token: 'token-1', scope: 'openid' }),
        )

        await expect(authorizeGoogleDrive()).resolves.toBeNull()
    })

    test('rejects a redirect whose state is not the one sent', async () => {
        native.authenticate.mockResolvedValueOnce(
            `${REDIRECT_URI}?state=forged&code=auth-code`,
        )

        await expect(authorizeGoogleDrive()).rejects.toBeInstanceOf(
            GoogleDriveAuthFailedError,
        )
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('bounds the code exchange by the Drive timeout', async () => {
        const signal = new AbortController().signal
        const timeout = vi
            .spyOn(AbortSignal, 'timeout')
            .mockReturnValueOnce(signal)
        redirectWith({ code: 'auth-code' })

        await authorizeGoogleDrive()

        expect(timeout).toHaveBeenCalledWith(DRIVE_TIMEOUT_MS)
        expect(fetchMock.mock.calls[0]![1]).toMatchObject({ signal })
    })

    test('names a refused code exchange', async () => {
        redirectWith({ code: 'auth-code' })
        fetchMock.mockResolvedValueOnce(
            tokenResponse({ error: 'invalid_grant' }, false),
        )

        await expect(authorizeGoogleDrive()).rejects.toBeInstanceOf(
            GoogleDriveAuthFailedError,
        )
    })
})

describe('authorizeGoogleDrive on Android', () => {
    test('asks the native client for drive.file', async () => {
        Platform.OS = 'android'
        native.authorize.mockResolvedValueOnce('token-1')

        await expect(authorizeGoogleDrive()).resolves.toBe('token-1')
        expect(native.authorize).toHaveBeenCalledWith(DRIVE_FILE_SCOPE)
        expect(native.authenticate).not.toHaveBeenCalled()
    })
})

describe('releaseGoogleDriveToken', () => {
    test('clears the token from the Android cache', async () => {
        Platform.OS = 'android'

        await releaseGoogleDriveToken('token-1')

        expect(native.clearToken).toHaveBeenCalledWith('token-1')
    })

    test('has nothing to release on iOS', async () => {
        await releaseGoogleDriveToken('token-1')

        expect(native.clearToken).not.toHaveBeenCalled()
    })
})
