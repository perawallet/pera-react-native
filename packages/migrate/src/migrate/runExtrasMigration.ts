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

import { logger } from '@perawallet/wallet-core-shared'
import type { LegacyMigrationData } from '@perawallet/wallet-extension-platform'
import { migrateAuth, type AuthMigrationResult } from './migrateAuth'
import { migrateContacts, type ContactMigrationResult } from './migrateContacts'
import { migrateDeviceIdentifiers } from './migrateDevice'
import {
    migrateNotificationMutes,
    type NotificationsMigrationResult,
} from './migrateNotifications'
import {
    migratePasskeys,
    type PasskeysMigrationResult,
} from './migratePasskeys'
import { migratePreferences } from './migratePreferences'
import { migrateStashed, type StashedMigrationResult } from './migrateStashed'
import { migrateSwaps } from './migrateSwaps'
import {
    migrateWalletConnect,
    type WalletConnectMigrationResult,
} from './migrateWalletConnect'

export type ExtrasMigrationResult = {
    preferences: boolean
    swaps: boolean
    deviceIdentifiers: boolean
    contacts: ContactMigrationResult
    notifications: NotificationsMigrationResult
    auth: AuthMigrationResult
    walletConnect: WalletConnectMigrationResult
    passkeys: PasskeysMigrationResult
    stashed: StashedMigrationResult
    failed: ExtrasMigrationStepFailure[]
}

export type ExtrasMigrationStepFailure = {
    step: ExtrasMigrationStepName
    reason: string
}

export type ExtrasMigrationStepName =
    | 'preferences'
    | 'swaps'
    | 'deviceIdentifiers'
    | 'contacts'
    | 'notifications'
    | 'auth'
    | 'walletConnect'
    | 'passkeys'
    | 'stashed'

export const EXTRAS_STEP_NAMES: ExtrasMigrationStepName[] = [
    'preferences',
    'swaps',
    'deviceIdentifiers',
    'contacts',
    'notifications',
    'auth',
    'walletConnect',
    'passkeys',
    'stashed',
]

export const runExtrasMigration = async (
    data: LegacyMigrationData,
    steps?: ExtrasMigrationStepName[],
): Promise<ExtrasMigrationResult> => {
    const enabled = new Set(steps ?? EXTRAS_STEP_NAMES)
    const result: ExtrasMigrationResult = {
        preferences: false,
        swaps: false,
        deviceIdentifiers: false,
        contacts: { imported: 0, skipped: 0 },
        notifications: { muted: 0 },
        auth: {
            pinMigrated: false,
            biometricMigrated: false,
            lockoutMigrated: false,
        },
        walletConnect: { imported: 0, skipped: 0 },
        passkeys: { imported: 0, skipped: 0 },
        stashed: { walletConnectHistoryBlobStashed: false },
        failed: [],
    }

    if (enabled.has('preferences'))
        runStep(result, 'preferences', () => {
            migratePreferences(data.preferences)
            result.preferences = true
        })

    if (enabled.has('swaps'))
        runStep(result, 'swaps', () => {
            migrateSwaps(data.preferences)
            result.swaps = true
        })

    if (enabled.has('deviceIdentifiers'))
        runStep(result, 'deviceIdentifiers', () => {
            migrateDeviceIdentifiers(data.deviceIdentifiers)
            result.deviceIdentifiers = true
        })

    if (enabled.has('contacts'))
        runStep(result, 'contacts', () => {
            result.contacts = migrateContacts(data.contacts)
        })

    if (enabled.has('notifications'))
        runStep(result, 'notifications', () => {
            result.notifications = migrateNotificationMutes(
                data.notificationFilters,
            )
        })

    if (enabled.has('auth'))
        await runAsyncStep(result, 'auth', async () => {
            result.auth = await migrateAuth(data.auth, data.preferences)
        })

    if (enabled.has('walletConnect'))
        runStep(result, 'walletConnect', () => {
            result.walletConnect = migrateWalletConnect(data.walletConnectV1)
        })

    if (enabled.has('passkeys'))
        await runAsyncStep(result, 'passkeys', async () => {
            result.passkeys = await migratePasskeys(data.passkeys)
        })

    if (enabled.has('stashed'))
        runStep(result, 'stashed', () => {
            result.stashed = migrateStashed({
                walletConnectHistoryBlob: data.walletConnectHistoryBlob,
            })
        })

    return result
}

const runStep = (
    result: ExtrasMigrationResult,
    step: ExtrasMigrationStepName,
    fn: () => void,
): void => {
    try {
        fn()
    } catch (err) {
        captureFailure(result, step, err)
    }
}

const runAsyncStep = async (
    result: ExtrasMigrationResult,
    step: ExtrasMigrationStepName,
    fn: () => Promise<void>,
): Promise<void> => {
    try {
        await fn()
    } catch (err) {
        captureFailure(result, step, err)
    }
}

const captureFailure = (
    result: ExtrasMigrationResult,
    step: ExtrasMigrationStepName,
    err: unknown,
): void => {
    const reason = err instanceof Error ? err.message : String(err)
    logger.error(`Legacy ${step} migration failed`, { error: err })
    result.failed.push({ step, reason })
}
