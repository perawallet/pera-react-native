/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { logger } from '@perawallet/wallet-core-shared'
import type {
    LegacyMigrationData,
    MigrationService,
} from '@perawallet/wallet-extension-platform'
import {
    runExtrasMigration,
    type ExtrasMigrationResult,
} from './runExtrasMigration'
import { runMigrationLoop } from './runMigrationLoop'
import type { MigrationDeps, MigrationResult } from './types'

export type MigrationRunIncompleteReason =
    | 'no-legacy-data'
    | 'has-legacy-data-threw'
    | 'get-legacy-data-threw'
    | 'accounts-failed'
    | 'accounts-threw'
    | 'extras-failed'
    | 'extras-threw'
    | 'mark-complete-threw'

export type MigrationRunResult = {
    completed: boolean
    incompleteReason: MigrationRunIncompleteReason | null
    accounts: MigrationResult | null
    extras: ExtrasMigrationResult | null
    error: Error | null
}

export const runMigration = async (
    migration: MigrationService,
    deps: MigrationDeps,
): Promise<MigrationRunResult> => {
    let hasData: boolean
    try {
        hasData = await migration.hasLegacyData()
    } catch (err) {
        const error = toError(err)
        logger.error('[Migration] hasLegacyData threw', { error })
        return {
            completed: false,
            incompleteReason: 'has-legacy-data-threw',
            accounts: null,
            extras: null,
            error,
        }
    }
    if (!hasData) {
        return {
            completed: false,
            incompleteReason: 'no-legacy-data',
            accounts: null,
            extras: null,
            error: null,
        }
    }

    let data: LegacyMigrationData
    try {
        data = await migration.getLegacyData()
    } catch (err) {
        const error = toError(err)
        logger.error(
            '[Migration] getLegacyData threw; sentinel not set, will retry next launch',
            { error },
        )
        return {
            completed: false,
            incompleteReason: 'get-legacy-data-threw',
            accounts: null,
            extras: null,
            error,
        }
    }

    let accountResult: MigrationResult
    try {
        accountResult = await runMigrationLoop({
            accounts: data.accounts,
            hdWallets: data.hdWallets,
            ...deps,
        })
    } catch (err) {
        const error = toError(err)
        logger.error(
            '[Migration] runMigrationLoop threw; sentinel not set, will retry next launch',
            { error },
        )
        return {
            completed: false,
            incompleteReason: 'accounts-threw',
            accounts: null,
            extras: null,
            error,
        }
    }

    if (accountResult.failed.length > 0) {
        logger.error(
            '[Migration] account failures; sentinel not set, will retry next launch',
            {
                failed: accountResult.failed,
                imported: accountResult.imported,
                skipped: accountResult.skipped,
            },
        )
        return {
            completed: false,
            incompleteReason: 'accounts-failed',
            accounts: accountResult,
            extras: null,
            error: null,
        }
    }

    let extrasResult: ExtrasMigrationResult
    try {
        extrasResult = await runExtrasMigration(data)
    } catch (err) {
        const error = toError(err)
        logger.error(
            '[Migration] runExtrasMigration threw; sentinel not set, will retry next launch',
            { error },
        )
        return {
            completed: false,
            incompleteReason: 'extras-threw',
            accounts: accountResult,
            extras: null,
            error,
        }
    }

    if (extrasResult.failed.length > 0) {
        logger.error(
            '[Migration] extras failures; sentinel not set, will retry next launch',
            { failed: extrasResult.failed },
        )
        return {
            completed: false,
            incompleteReason: 'extras-failed',
            accounts: accountResult,
            extras: extrasResult,
            error: null,
        }
    }

    const sourcePlatform = Platform.OS === 'ios' ? 'ios' : 'android'
    try {
        await migration.markMigrationComplete(sourcePlatform)
    } catch (err) {
        const error = toError(err)
        logger.error(
            '[Migration] markMigrationComplete threw; sentinel not set, will retry next launch',
            { error },
        )
        return {
            completed: false,
            incompleteReason: 'mark-complete-threw',
            accounts: accountResult,
            extras: extrasResult,
            error,
        }
    }

    logger.info('[Migration] complete', {
        imported: accountResult.imported,
        skipped: accountResult.skipped,
        extras: extrasResult,
    })
    return {
        completed: true,
        incompleteReason: null,
        accounts: accountResult,
        extras: extrasResult,
        error: null,
    }
}

const toError = (err: unknown): Error =>
    err instanceof Error ? err : new Error(String(err))
