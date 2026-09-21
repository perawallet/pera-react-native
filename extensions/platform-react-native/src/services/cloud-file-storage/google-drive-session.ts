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

import { Platform } from 'react-native'
import {
    CloudFileNotFoundError,
    GoogleDriveAuthFailedError,
    GoogleDriveNotConfiguredError,
    GoogleDriveUnreachableError,
    GooglePlayServicesUnavailableError,
} from '@perawallet/wallet-extension-platform'
import {
    GoogleSignin,
    isCancelledResponse,
    isNoSavedCredentialFoundResponse,
    isSuccessResponse,
    type User,
} from '@react-native-google-signin/google-signin'
import {
    CloudStorage,
    CloudStorageError,
    CloudStorageErrorCode,
    CloudStorageProvider,
    CloudStorageScope,
} from 'react-native-cloud-storage'
import { config } from '@perawallet/wallet-core-config'

export const DRIVE_APPDATA_SCOPE =
    'https://www.googleapis.com/auth/drive.appdata'

// The library's 3 s default is too short for an upload on a mobile network.
const DRIVE_TIMEOUT_MS = 15_000

/** What an operation returns when the user backs out of a prompt it raised. */
export const DRIVE_CANCELLED = Symbol('drive cancelled')

export type DriveOperation<T> = (
    drive: CloudStorage,
) => Promise<T | typeof DRIVE_CANCELLED>

export type DriveSessionResult<T> =
    | { status: 'done'; value: T }
    | { status: 'cancelled' }

const configureGoogleSignIn = (): void => {
    const clientId =
        Platform.OS === 'ios'
            ? config.googleIosClientId
            : config.googleWebClientId
    if (!clientId) throw new GoogleDriveNotConfiguredError()
    GoogleSignin.configure({
        scopes: [DRIVE_APPDATA_SCOPE],
        iosClientId: config.googleIosClientId || undefined,
        webClientId: config.googleWebClientId || undefined,
    })
}

const hasDriveScope = (user: User): boolean =>
    user.scopes.includes(DRIVE_APPDATA_SCOPE)

const signIn = async (): Promise<User | null> => {
    if (GoogleSignin.hasPreviousSignIn()) {
        try {
            const silent = await GoogleSignin.signInSilently()
            if (!isNoSavedCredentialFoundResponse(silent)) return silent.data
        } catch {
            // iOS rejects restoring a grant revoked from the Google account and
            // keeps the stale keychain entry; prompting replaces it.
        }
    }
    const response = await GoogleSignin.signIn()
    return isCancelledResponse(response) ? null : response.data
}

const grantDriveScope = async (user: User): Promise<boolean> => {
    if (hasDriveScope(user)) return true
    const response = await GoogleSignin.addScopes({
        scopes: [DRIVE_APPDATA_SCOPE],
    })
    return (
        response !== null &&
        isSuccessResponse(response) &&
        hasDriveScope(response.data)
    )
}

// The library only names a 401 AUTHENTICATION_FAILED when the body says
// `UNAUTHENTICATED`; anything else keeps the raw status of the HTTP failure.
const isAuthFailure = (error: unknown): boolean =>
    (error instanceof CloudStorageError &&
        error.code === CloudStorageErrorCode.AUTHENTICATION_FAILED) ||
    (error as { status?: unknown } | null)?.status === 401

// The library's `statusCodes` reads native constants, so it is undefined
// wherever the module isn't linked — and an undefined comparand would match
// every error that carries no code. Both platforms spell it this literal.
const PLAY_SERVICES_NOT_AVAILABLE = 'PLAY_SERVICES_NOT_AVAILABLE'

const isPlayServicesUnavailable = (error: unknown): boolean =>
    (error as { code?: unknown } | null)?.code === PLAY_SERVICES_NOT_AVAILABLE

// DRIVE_TIMEOUT_MS aborts the underlying fetch. NETWORK_ERROR only ever comes
// from the library's native file transfers, so on the JS Drive client a dropped
// connection is left as React Native's own fetch message — a last resort.
const isTransportFailure = (error: unknown): boolean => {
    const { name, message } = (error ?? {}) as {
        name?: unknown
        message?: unknown
    }
    return (
        name === 'AbortError' ||
        (error instanceof CloudStorageError &&
            error.code === CloudStorageErrorCode.NETWORK_ERROR) ||
        /network request failed/i.test(String(message ?? ''))
    )
}

// Every Drive call starts with the library's file-id lookup, which re-wraps
// anything that isn't already a CloudStorageError as UNKNOWN and keeps the
// original in `details`, so a failure there arrives one level down.
const orCause =
    (matches: (error: unknown) => boolean) =>
    (error: unknown): boolean =>
        matches(error) ||
        (error instanceof CloudStorageError && matches(error.details))

const isUnreachable = orCause(isTransportFailure)
const isUnauthorized = orCause(isAuthFailure)

/**
 * Names the failures a user can act on. Anything else keeps its own identity,
 * so a genuine bug still reaches the generic banner and a crash report.
 */
const asDriveError = (error: unknown): unknown => {
    if (isPlayServicesUnavailable(error)) {
        return new GooglePlayServicesUnavailableError()
    }
    if (isUnreachable(error)) return new GoogleDriveUnreachableError()
    if (isUnauthorized(error)) return new GoogleDriveAuthFailedError()
    return error
}

// appDataFolder has no server-side uniqueness and users can't see it to clean
// up, so a duplicate from a racing save must not make every later call fail.
const driveWithToken = (accessToken: string): CloudStorage =>
    new CloudStorage(CloudStorageProvider.GoogleDrive, {
        accessToken,
        scope: CloudStorageScope.AppData,
        strictFilenames: false,
        timeout: DRIVE_TIMEOUT_MS,
    })

const toSessionResult = <T>(
    value: T | typeof DRIVE_CANCELLED,
): DriveSessionResult<T> =>
    value === DRIVE_CANCELLED
        ? { status: 'cancelled' }
        : { status: 'done', value }

const runWithFreshToken = async <T>(
    operation: DriveOperation<T>,
    rejectedToken: string,
): Promise<T | typeof DRIVE_CANCELLED> => {
    // Android's getTokens can hand back the rejected token from its cache.
    if (Platform.OS === 'android') {
        await GoogleSignin.clearCachedAccessToken(rejectedToken)
    }
    const { accessToken } = await GoogleSignin.getTokens()
    try {
        return await operation(driveWithToken(accessToken))
    } catch (error) {
        // iOS keeps returning a revoked token until it nears expiry; signing
        // out makes the next call prompt for a new grant.
        if (isUnauthorized(error)) await GoogleSignin.signOut()
        throw error
    }
}

// A failed sign-out must not turn a finished save into an error.
const releaseGoogleSession = (): Promise<unknown> =>
    GoogleSignin.signOut().catch(() => undefined)

const runSession = async <T>(
    operation: DriveOperation<T>,
    onAuthorized?: () => void,
): Promise<DriveSessionResult<T>> => {
    configureGoogleSignIn()

    // Offers Android's Play Services update dialog up front; without current
    // Play Services the call fails here rather than inside sign-in.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

    const user = await signIn()
    if (!user || !(await grantDriveScope(user))) return { status: 'cancelled' }

    onAuthorized?.()
    const { accessToken } = await GoogleSignin.getTokens()
    try {
        return toSessionResult(await operation(driveWithToken(accessToken)))
    } catch (error) {
        if (!isUnauthorized(error)) throw error
        // The library never refreshes tokens.
        return toSessionResult(await runWithFreshToken(operation, accessToken))
    }
}

/**
 * `cancelled` when the user backs out of sign-in, the scope grant, or a prompt
 * `operation` itself raised. `operation` runs again after a rejected token, so
 * it must be safe to repeat. Failures are mapped here rather than inside, so
 * the token retry still sees the original 401.
 *
 * A session that reached the operation gives the `drive.appdata` grant back on
 * the way out rather than leaving a refreshable token alive — from a `finally`,
 * because a read has several exits and each one has to release. A cancellation
 * keeps the sign-in: the user may retry straight away.
 */
export const runOnGoogleDrive = async <T>(
    operation: DriveOperation<T>,
    onAuthorized?: () => void,
): Promise<DriveSessionResult<T>> => {
    let release = false
    try {
        const result = await runSession(operation, onAuthorized)
        release = result.status === 'done'
        return result
    } catch (error) {
        const driveError = asDriveError(error)
        // Sign-in silently reuses the last account; signing out lets the next
        // attempt pick another.
        release = driveError instanceof CloudFileNotFoundError
        throw driveError
    } finally {
        if (release) await releaseGoogleSession()
    }
}
