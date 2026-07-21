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
import { logger } from '@perawallet/wallet-core-shared'
import type {
    LegacyMigrationData,
    MigrationService,
    MigrationStepName,
} from '@perawallet/wallet-extension-platform'
import {
    runExtrasMigration,
    type ExtrasMigrationResult,
    type ExtrasMigrationStepName,
} from './runExtrasMigration'
import { runMigrationLoop } from './runMigrationLoop'
import { scrubLegacyPayloadSecrets } from './scrubLegacyPayload'
import {
    getPendingSteps,
    pendingStepsFromVersions,
    resolveCompletedStepVersions,
    MIGRATION_STEP_TARGET_VERSIONS,
} from './stepVersions'
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

/**
 * Emits the `[Migration] step versions` diagnostic every `runMigration` call
 * should end with — the recorded/target/pending snapshot support needs to
 * answer "why didn't this user's data come across". Always re-fetches fresh
 * state (rather than trusting a caller-supplied snapshot) so it reflects any
 * writes `recordSucceededSteps` just made. Wrapped in try/catch: a storage
 * read failing here must never turn a successful (or already-handled-failure)
 * migration outcome into an uncaught rejection.
 */
const logStepVersions = async (migration: MigrationService): Promise<void> => {
    try {
        const completed = await resolveCompletedStepVersions(migration)
        const pending = await getPendingSteps(migration)
        logger.info('[Migration] step versions', {
            completed,
            targets: MIGRATION_STEP_TARGET_VERSIONS,
            pending,
        })
    } catch (err) {
        logger.error('[Migration] failed to log step versions', {
            error: toError(err),
        })
    }
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
        await logStepVersions(migration)
        return {
            completed: false,
            incompleteReason: 'has-legacy-data-threw',
            accounts: null,
            extras: null,
            error,
        }
    }
    if (!hasData) {
        // No legacy install exists on this device at all — there is nothing
        // pending or completed to report, so skip the diagnostic rather than
        // logging a noisy "everything is pending" line for every fresh install.
        return {
            completed: false,
            incompleteReason: 'no-legacy-data',
            accounts: null,
            extras: null,
            error: null,
        }
    }

    const resolved = await resolveCompletedStepVersions(migration)
    const pending = pendingStepsFromVersions(resolved)
    if (pending.length === 0) {
        await logStepVersions(migration)
        return {
            completed: true,
            incompleteReason: null,
            accounts: null,
            extras: null,
            error: null,
        }
    }
    // The accounts step has already run at least once when its recorded version
    // is >= 1; the loop must then skip re-applying the legacy account order.
    const isRerun = (resolved.accounts ?? 0) >= 1

    let data: LegacyMigrationData
    try {
        data = await migration.getLegacyData()
    } catch (err) {
        const error = toError(err)
        logger.error(
            '[Migration] getLegacyData threw; sentinel not set, will retry next launch',
            { error },
        )
        await logStepVersions(migration)
        return {
            completed: false,
            incompleteReason: 'get-legacy-data-threw',
            accounts: null,
            extras: null,
            error,
        }
    }

    try {
        return await runMigrationWithLegacyData(
            migration,
            deps,
            data,
            pending,
            isRerun,
        )
    } finally {
        scrubLegacyPayloadSecrets(data)
    }
}

const runMigrationWithLegacyData = async (
    migration: MigrationService,
    deps: MigrationDeps,
    data: LegacyMigrationData,
    pending: MigrationStepName[],
    isRerun: boolean,
): Promise<MigrationRunResult> => {
    const accountsPending = pending.includes('accounts')
    // Sound by construction: ExtrasMigrationStepName is defined as
    // Exclude<MigrationStepName, 'accounts'>.
    const pendingExtras = pending.filter(
        (step): step is ExtrasMigrationStepName => step !== 'accounts',
    )

    let accountResult: MigrationResult = { imported: 0, skipped: 0, failed: [] }
    if (accountsPending) {
        try {
            accountResult = await runMigrationLoop({
                accounts: data.accounts,
                undecodableAccounts: data.undecodableAccounts,
                hdWallets: data.hdWallets,
                isRerun,
                ...deps,
            })
        } catch (err) {
            const error = toError(err)
            logger.error(
                '[Migration] runMigrationLoop threw; sentinel not set, will retry next launch',
                { error },
            )
            await logStepVersions(migration)
            return {
                completed: false,
                incompleteReason: 'accounts-threw',
                accounts: null,
                extras: null,
                error,
            }
        }
    }

    let extrasResult: ExtrasMigrationResult
    try {
        extrasResult = await runExtrasMigration(data, pendingExtras)
    } catch (err) {
        const error = toError(err)
        logger.error(
            '[Migration] runExtrasMigration threw; sentinel not set, will retry next launch',
            { error },
        )
        await recordSucceededSteps(migration, {
            accountsSucceeded:
                accountsPending && accountResult.failed.length === 0,
            extras: null,
            pendingExtras,
        })
        await logStepVersions(migration)
        return {
            completed: false,
            incompleteReason: 'extras-threw',
            accounts: accountResult,
            extras: null,
            error,
        }
    }

    await recordSucceededSteps(migration, {
        accountsSucceeded: accountsPending && accountResult.failed.length === 0,
        extras: extrasResult,
        pendingExtras,
    })

    if (accountResult.failed.length > 0) {
        logger.error(
            '[Migration] account failures; sentinel not set, will retry next launch',
            {
                failed: accountResult.failed,
                imported: accountResult.imported,
                skipped: accountResult.skipped,
            },
        )
        await logStepVersions(migration)
        return {
            completed: false,
            incompleteReason: 'accounts-failed',
            accounts: accountResult,
            extras: extrasResult,
            error: null,
        }
    }

    if (extrasResult.failed.length > 0) {
        logger.error(
            '[Migration] extras failures; sentinel not set, will retry next launch',
            { failed: extrasResult.failed },
        )
        await logStepVersions(migration)
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
        await logStepVersions(migration)
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
    await logStepVersions(migration)
    return {
        completed: true,
        incompleteReason: null,
        accounts: accountResult,
        extras: extrasResult,
        error: null,
    }
}

const recordSucceededSteps = async (
    migration: MigrationService,
    args: {
        accountsSucceeded: boolean
        extras: ExtrasMigrationResult | null
        pendingExtras: ExtrasMigrationStepName[]
    },
): Promise<void> => {
    const succeeded: MigrationStepName[] = []
    if (args.accountsSucceeded) succeeded.push('accounts')
    if (args.extras) {
        const failedSteps = new Set(args.extras.failed.map(f => f.step))
        for (const step of args.pendingExtras) {
            if (!failedSteps.has(step)) succeeded.push(step)
        }
    }
    if (succeeded.length === 0) return
    try {
        const current = await resolveCompletedStepVersions(migration)
        const next = { ...current }
        for (const step of succeeded) {
            next[step] = MIGRATION_STEP_TARGET_VERSIONS[step]
        }
        await migration.setCompletedStepVersions(next)
    } catch (err) {
        logger.error('[Migration] failed to record step versions', {
            error: toError(err),
        })
    }
}

const toError = (err: unknown): Error =>
    err instanceof Error ? err : new Error(String(err))
