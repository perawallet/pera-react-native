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

import { GoogleDriveNotConfiguredError } from './errors'

export const DRIVE_APPDATA_SCOPE =
    'https://www.googleapis.com/auth/drive.appdata'

// The library's 3 s default is too short for an upload on a mobile network.
const DRIVE_TIMEOUT_MS = 15_000

export type DriveOperation<T> = (drive: CloudStorage) => Promise<T>

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

const isUnauthorized = (error: unknown): boolean =>
    (error instanceof CloudStorageError &&
        error.code === CloudStorageErrorCode.AUTHENTICATION_FAILED) ||
    (error as { status?: unknown } | null)?.status === 401

// appDataFolder has no server-side uniqueness and users can't see it to clean
// up, so a duplicate from a racing save must not make every later call fail.
const driveWithToken = (accessToken: string): CloudStorage =>
    new CloudStorage(CloudStorageProvider.GoogleDrive, {
        accessToken,
        scope: CloudStorageScope.AppData,
        strictFilenames: false,
        timeout: DRIVE_TIMEOUT_MS,
    })

const runWithFreshToken = async <T>(
    operation: DriveOperation<T>,
    rejectedToken: string,
): Promise<T> => {
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

export const signOutOfGoogleDrive = (): Promise<null> => GoogleSignin.signOut()

/**
 * `cancelled` when the user backs out of sign-in or the Drive scope grant.
 * `operation` runs again after a rejected token, so it must be safe to
 * repeat.
 */
export const runOnGoogleDrive = async <T>(
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
        return {
            status: 'done',
            value: await operation(driveWithToken(accessToken)),
        }
    } catch (error) {
        if (!isUnauthorized(error)) throw error
        // The library never refreshes tokens.
        return {
            status: 'done',
            value: await runWithFreshToken(operation, accessToken),
        }
    }
}
