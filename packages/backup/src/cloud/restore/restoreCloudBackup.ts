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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import { isPeraNetworkError, logger } from '@perawallet/wallet-core-shared'
import type { Network } from '@perawallet/wallet-core-shared'
import { deleteBackupKeys, persistBackupKeys } from '../credentials/keyStorage'
import { createEmptySyncState } from '../models'
import type { BackupId, DeviceId, SyncState } from '../models'
import type { ImportSummary, SyncImportFn } from '../sync/types'
import type { BackupKeys } from '../crypto/deriveBackupKeys'
import { pullBackupItems } from './pullBackupItems'
import type { PullBackupItemsResult } from './pullBackupItems'

/** What a failure means to the restore flow. Deliberately not the shared
 *  `errors.api.*` mapping: "no backup for this phrase" is not "not found". */
export type RestoreErrorCategory =
    | 'NOT_FOUND'
    | 'INVALID_CREDENTIALS'
    | 'UNKNOWN'

export class CloudBackupRestoreError extends Error {
    readonly category: RestoreErrorCategory

    constructor(category: RestoreErrorCategory, cause?: unknown) {
        super(`Cloud backup restore failed: ${category}`, { cause })
        this.name = 'CloudBackupRestoreError'
        this.category = category
    }
}

type RestoreCloudBackupParams = {
    mnemonic: string[]
    /** Base64 salt the UI calls the "encryption key". */
    salt: string
    deviceId: DeviceId
    network: Network
    /** Decrypted remote accounts → wallet. Hook-bound (needs KMS), so the app
     *  layer injects it. */
    importAccounts: SyncImportFn
}

export type RestoreCloudBackupResult = {
    backupId: BackupId
    /** Seeded from the pull so the first background sync resumes at `lastSeq`
     *  instead of re-reading every item. */
    syncState: SyncState
    summary: ImportSummary
}

const categorize = (error: unknown): RestoreErrorCategory => {
    if (!isPeraNetworkError(error)) return 'UNKNOWN'
    if (error.status === 404) return 'NOT_FOUND'
    if (error.status === 401 || error.status === 403) {
        return 'INVALID_CREDENTIALS'
    }
    return 'UNKNOWN'
}

const logFailure = (error: unknown, category: RestoreErrorCategory): void => {
    logger.error(error instanceof Error ? error : String(error), {
        scope: 'restoreCloudBackup',
        category,
    })
}

/** Don't leave half-configured keys (incl. the persisted phrase) behind. */
const cleanUpAfterRestoreFailure = async (): Promise<void> => {
    try {
        await deleteBackupKeys()
    } catch (cleanupError) {
        logger.error(
            'restoreCloudBackup: failed to clean up keys after restore error',
            {
                error:
                    cleanupError instanceof Error
                        ? cleanupError.message
                        : String(cleanupError),
            },
        )
    }
}

const syncStateFromPull = (
    backupId: BackupId,
    pull: PullBackupItemsResult,
): SyncState => ({
    ...createEmptySyncState(backupId),
    lastKnownBackupHash: pull.backupGlobalHash,
    lastSyncedSeq: pull.lastSeq,
    lastSyncedAt: Date.now(),
    lastSyncResult: 'SUCCESS',
})

const deriveKeys = async (
    mnemonic: string[],
    salt: string,
): Promise<BackupKeys> => {
    // Lazy import keeps tweetnacl/@noble/argon2 out of the startup module graph.
    const { deriveBackupKeys } = await import('../crypto')

    try {
        return await deriveBackupKeys({ mnemonic, salt })
    } catch (error) {
        // The phrase and the salt are the only inputs, and a truncated paste of
        // the salt throws out of `decodeFromBase64` — so a derive failure here
        // is always a bad credential, never a transport problem.
        logFailure(error, 'INVALID_CREDENTIALS')
        throw new CloudBackupRestoreError('INVALID_CREDENTIALS', error)
    }
}

/**
 * Rejects with a {@link CloudBackupRestoreError} for every failure, so the
 * caller reads one category rather than shape-matching the underlying error.
 */
export const restoreCloudBackup = async ({
    mnemonic,
    salt,
    deviceId,
    network,
    importAccounts,
}: RestoreCloudBackupParams): Promise<RestoreCloudBackupResult> => {
    const { backupId, encryptionKey, authSecretKey } = await deriveKeys(
        mnemonic,
        salt,
    )

    try {
        await persistBackupKeys({ encryptionKey, authSecretKey, mnemonic })

        const pull = await pullBackupItems({
            network,
            backupId,
            deviceId,
            encryptionKey,
        })
        const summary = await importAccounts(pull.accounts)

        return {
            backupId,
            syncState: syncStateFromPull(backupId, pull),
            summary,
        }
    } catch (error) {
        const category = categorize(error)
        logFailure(error, category)
        await cleanUpAfterRestoreFailure()
        throw new CloudBackupRestoreError(category, error)
    } finally {
        zeroBytes(encryptionKey)
        zeroBytes(authSecretKey)
    }
}
