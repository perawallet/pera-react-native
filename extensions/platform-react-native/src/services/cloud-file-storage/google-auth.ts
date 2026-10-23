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

import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'
import { GoogleDriveAuthFailedError } from '@perawallet/wallet-extension-platform'
import { config } from '@perawallet/wallet-core-config'
import {
    createOauthState,
    createPkcePair,
} from '@perawallet/wallet-core-shared'

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

// The Drive library's 3 s default is too short for an upload on a mobile
// network. An abort surfaces as an AbortError, read as Drive being unreachable.
export const DRIVE_TIMEOUT_MS = 15_000

const AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

interface NativePeraGoogleAuth {
    /** iOS: the redirect URL, or null when the user closes the sheet. */
    authenticate(url: string, callbackScheme: string): Promise<string | null>
    /** Android: an access token for `scope` on an account the user picks, or null when they back out. */
    authorize(scope: string): Promise<string | null>
    /** Android: drops the token from the device's cache. */
    clearToken(token: string): Promise<null>
}

const nativeGoogleAuth = (): NativePeraGoogleAuth | null =>
    requireOptionalNativeModule<NativePeraGoogleAuth>('PeraGoogleAuth')

const requireGoogleAuth = (): NativePeraGoogleAuth => {
    const module = nativeGoogleAuth()
    if (!module) throw new Error('PeraGoogleAuth native module is missing')
    return module
}

/**
 * Android authorizes against the OAuth client registered for the app's package
 * and signing key, so it needs no client id; iOS sends its own.
 */
export const isGoogleDriveConfigured = (): boolean =>
    nativeGoogleAuth() !== null &&
    (Platform.OS !== 'ios' || Boolean(config.googleIosClientId))

// RN's URLSearchParams is incomplete, so queries are built and read by hand.
const toQuery = (params: Record<string, string>): string =>
    Object.entries(params)
        .map(
            ([key, value]) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join('&')

const readQuery = (url: string): Record<string, string> => {
    const query = url.split('#')[0]!.split('?')[1] ?? ''
    return Object.fromEntries(
        query
            .split('&')
            .filter(Boolean)
            .map(pair => {
                const at = pair.indexOf('=')
                const [key, value] =
                    at < 0
                        ? [pair, '']
                        : [pair.slice(0, at), pair.slice(at + 1)]
                return [decodeURIComponent(key), decodeURIComponent(value)]
            }),
    )
}

const hasDriveScope = (scope: string | undefined): boolean =>
    (scope ?? '').split(' ').includes(DRIVE_FILE_SCOPE)

/**
 * Google's installed-app flow for an iOS client: PKCE, no client secret, and a
 * redirect to the client id's reversed form. The refresh token Google returns
 * is dropped, so nothing outlives the session.
 */
const authorizeOnIos = async (): Promise<string | null> => {
    const clientId = config.googleIosClientId
    const callbackScheme = clientId.split('.').reverse().join('.')
    const redirectUri = `${callbackScheme}:/oauth2redirect`
    const { codeVerifier, codeChallenge } = createPkcePair()
    const state = createOauthState()

    const callback = await requireGoogleAuth().authenticate(
        `${AUTHORIZE_ENDPOINT}?${toQuery({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: DRIVE_FILE_SCOPE,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state,
            // Lets the user pick another account after a backup wasn't found.
            prompt: 'select_account',
        })}`,
        callbackScheme,
    )
    if (callback === null) return null

    const result = readQuery(callback)
    if (result.error === 'access_denied') return null
    if (result.state !== state || !result.code) {
        throw new GoogleDriveAuthFailedError()
    }

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS),
        body: toQuery({
            code: result.code,
            client_id: clientId,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
        }),
    })
    if (!response.ok) throw new GoogleDriveAuthFailedError()
    const token = (await response.json()) as {
        access_token?: string
        scope?: string
    }
    if (!token.access_token) throw new GoogleDriveAuthFailedError()
    // Google's consent screen lets the user untick the scope.
    return hasDriveScope(token.scope) ? token.access_token : null
}

/** A `drive.file` access token, or null when the user backs out. */
export const authorizeGoogleDrive = (): Promise<string | null> =>
    Platform.OS === 'ios'
        ? authorizeOnIos()
        : requireGoogleAuth().authorize(DRIVE_FILE_SCOPE)

/**
 * Android caches tokens and can hand a rejected one back; iOS keeps nothing to
 * release.
 */
export const releaseGoogleDriveToken = async (token: string): Promise<void> => {
    if (Platform.OS === 'android') await requireGoogleAuth().clearToken(token)
}
