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

import {
    CloudFileNotFoundError,
    GoogleDriveAuthFailedError,
    GoogleDriveNotConfiguredError,
    GoogleDriveUnreachableError,
    GooglePlayServicesUnavailableError,
} from '@perawallet/wallet-extension-platform'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    CloudStorage,
    CloudStorageError,
    CloudStorageErrorCode,
    CloudStorageProvider,
    CloudStorageScope,
} from 'react-native-cloud-storage'

import { hasCode } from './cloud-storage-error'
import {
    authorizeGoogleDrive,
    DRIVE_TIMEOUT_MS,
    isGoogleDriveConfigured,
    releaseGoogleDriveToken,
} from './google-auth'

export { DRIVE_FILE_SCOPE, isGoogleDriveConfigured } from './google-auth'

/** What an operation returns when the user backs out of a prompt it raised. */
export const DRIVE_CANCELLED = Symbol('drive cancelled')

export type DriveOperation<T> = (
    drive: CloudStorage,
) => Promise<T | typeof DRIVE_CANCELLED>

export type DriveSessionResult<T> =
    | { status: 'done'; value: T }
    | { status: 'cancelled' }

// The library only names a 401 AUTHENTICATION_FAILED when the body says
// `UNAUTHENTICATED`; anything else keeps the raw status of the HTTP failure.
const isAuthFailure = (error: unknown): boolean =>
    hasCode(error, CloudStorageErrorCode.AUTHENTICATION_FAILED) ||
    (error as Nullable<{ status?: unknown }>)?.status === 401

// PeraGoogleAuth rejects with this code when Android's Play Services are
// missing and the user doesn't install or enable them.
const PLAY_SERVICES_NOT_AVAILABLE = 'PLAY_SERVICES_NOT_AVAILABLE'

const isPlayServicesUnavailable = (error: unknown): boolean =>
    (error as Nullable<{ code?: unknown }>)?.code ===
    PLAY_SERVICES_NOT_AVAILABLE

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
        hasCode(error, CloudStorageErrorCode.NETWORK_ERROR) ||
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

// Drive enforces no server-side filename uniqueness, so a duplicate from a
// racing save must not make every later call fail; resolveCandidate picks.
const driveWithToken = (accessToken: string): CloudStorage =>
    new CloudStorage(CloudStorageProvider.GoogleDrive, {
        accessToken,
        scope: CloudStorageScope.Documents,
        strictFilenames: false,
        timeout: DRIVE_TIMEOUT_MS,
    })

const toSessionResult = <T>(
    value: T | typeof DRIVE_CANCELLED,
): DriveSessionResult<T> =>
    value === DRIVE_CANCELLED
        ? { status: 'cancelled' }
        : { status: 'done', value }

/**
 * The token the session holds, so it can be released however the session
 * ends.
 */
type HeldToken = { current: Nullable<string> }

const authorizeInto = async (held: HeldToken): Promise<Nullable<string>> => {
    held.current = await authorizeGoogleDrive()
    return held.current
}

const runSession = async <T>(
    operation: DriveOperation<T>,
    held: HeldToken,
    onAuthorized?: () => void,
): Promise<DriveSessionResult<T>> => {
    if (!isGoogleDriveConfigured()) throw new GoogleDriveNotConfiguredError()

    const accessToken = await authorizeInto(held)
    if (accessToken === null) return { status: 'cancelled' }

    onAuthorized?.()
    try {
        return toSessionResult(await operation(driveWithToken(accessToken)))
    } catch (error) {
        if (!isUnauthorized(error)) throw error
        // The library never refreshes tokens, and Android would hand the
        // rejected one back from its cache. A failed release must not replace
        // the 401; the retry goes ahead regardless.
        await releaseGoogleDriveToken(accessToken).catch(() => undefined)
        const freshToken = await authorizeInto(held)
        if (freshToken === null) return { status: 'cancelled' }
        return toSessionResult(await operation(driveWithToken(freshToken)))
    }
}

/**
 * `cancelled` when the user backs out of the consent screen or a prompt
 * `operation` itself raised. `operation` runs again after a rejected token, so
 * it must be safe to repeat. Failures are mapped here rather than inside, so
 * the token retry still sees the original 401.
 *
 * A session that reached the operation releases its token on the way out,
 * from a `finally` because a read has several exits and each one has to
 * release. So does one whose token was rejected twice. A cancellation or any
 * other failure keeps it: the user may retry straight away.
 */
export const runOnGoogleDrive = async <T>(
    operation: DriveOperation<T>,
    onAuthorized?: () => void,
): Promise<DriveSessionResult<T>> => {
    const held: HeldToken = { current: null }
    let release = false
    try {
        const result = await runSession(operation, held, onAuthorized)
        release = result.status === 'done'
        return result
    } catch (error) {
        const driveError = asDriveError(error)
        release =
            driveError instanceof CloudFileNotFoundError ||
            driveError instanceof GoogleDriveAuthFailedError
        throw driveError
    } finally {
        // A failed release must not turn a finished save into an error.
        if (release && held.current) {
            await releaseGoogleDriveToken(held.current).catch(() => undefined)
        }
    }
}
