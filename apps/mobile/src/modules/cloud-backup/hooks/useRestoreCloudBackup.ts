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

import { useCallback, useMemo } from 'react'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    createEmptySyncState,
    deleteBackupKeys,
    deriveBackupKeys,
    persistBackupKeys,
    pullBackupItems,
    useBackupSyncStateStore,
    useCloudBackupStore,
    type BackupKeys,
    type ImportSummary,
    type SyncImportFn,
} from '@perawallet/wallet-core-backup'
import {
    isPeraNetworkError,
    logger,
    type Network,
} from '@perawallet/wallet-core-shared'
import { useCloudBackupImport } from './useCloudBackupImport'

export type RestoreErrorCategory =
    | 'NOT_FOUND'
    | 'INVALID_CREDENTIALS'
    | 'UNKNOWN'

type RestoreParams = { mnemonic: string[]; salt: string }

type UseRestoreCloudBackupParams = {
    onSuccess: (summary: ImportSummary) => void
    onError: (category: RestoreErrorCategory) => void
}

type UseRestoreCloudBackupResult = {
    restore: (params: RestoreParams) => Promise<void>
}

const categorize = (error: unknown): RestoreErrorCategory => {
    if (!isPeraNetworkError(error)) return 'UNKNOWN'
    if (error.status === 404) return 'NOT_FOUND'
    if (error.status === 401 || error.status === 403) {
        return 'INVALID_CREDENTIALS'
    }
    return 'UNKNOWN'
}

const logError = (error: unknown, category: RestoreErrorCategory): void => {
    logger.error(error instanceof Error ? error : String(error), {
        scope: 'useRestoreCloudBackup',
        category,
    })
}

/**
 * Null on failure rather than throwing: a truncated paste throws out of
 * `decodeFromBase64(salt)`, and an uncaught rejection here would strand the
 * caller's loading state. The phrase and the key are the only inputs, so a
 * derive failure is always a bad credential.
 */
const deriveKeys = async (
    params: RestoreParams,
): Promise<BackupKeys | null> => {
    try {
        return await deriveBackupKeys(params)
    } catch (error) {
        logError(error, 'INVALID_CREDENTIALS')
        return null
    }
}

/** Don't leave half-configured keys (incl. the persisted mnemonic) behind. */
const discardPersistedKeys = async (): Promise<void> => {
    try {
        await deleteBackupKeys()
    } catch (error) {
        logger.warn(
            'useRestoreCloudBackup: failed to clean up keys after restore error',
            { error: error instanceof Error ? error.message : String(error) },
        )
    }
}

type PullResult = Awaited<ReturnType<typeof pullBackupItems>>

const syncStateFromPull = (backupId: string, pull: PullResult) => ({
    ...createEmptySyncState(backupId),
    lastKnownBackupHash: pull.backupGlobalHash,
    lastSyncedSeq: pull.lastSeq,
    lastSyncedAt: Date.now(),
    lastSyncResult: 'SUCCESS' as const,
})

type RestoreContext = {
    network: Network
    deviceId: string
    importAccounts: SyncImportFn
    commit: (backupId: string, salt: string, pull: PullResult) => void
}

/** Null until the device id is available, which is the one precondition
 *  `restore` can't recover from. */
const useRestoreContext = (): RestoreContext | null => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const setConfigured = useCloudBackupStore(state => state.setConfigured)
    const setSyncState = useBackupSyncStateStore(state => state.setSyncState)
    const { importAccounts } = useCloudBackupImport()

    return useMemo(
        () =>
            deviceId
                ? {
                      network,
                      deviceId,
                      importAccounts,
                      commit: (backupId, salt, pull) => {
                          setConfigured({ backupId, salt })
                          setSyncState(syncStateFromPull(backupId, pull))
                      },
                  }
                : null,
        [network, deviceId, importAccounts, setConfigured, setSyncState],
    )
}

const runRestore = async (
    { network, deviceId, importAccounts, commit }: RestoreContext,
    { mnemonic, salt }: RestoreParams,
    { backupId, encryptionKey, authSecretKey }: BackupKeys,
): Promise<ImportSummary> => {
    await persistBackupKeys({ encryptionKey, authSecretKey, mnemonic })
    const pull = await pullBackupItems({
        network,
        backupId,
        deviceId,
        encryptionKey,
    })
    const summary = await importAccounts(pull.accounts)
    commit(backupId, salt, pull)
    return summary
}

export const useRestoreCloudBackup = ({
    onSuccess,
    onError,
}: UseRestoreCloudBackupParams): UseRestoreCloudBackupResult => {
    const context = useRestoreContext()

    const restore = useCallback(
        async (params: RestoreParams): Promise<void> => {
            if (!context) {
                onError('UNKNOWN')
                return
            }
            const keys = await deriveKeys(params)
            if (!keys) {
                onError('INVALID_CREDENTIALS')
                return
            }

            try {
                onSuccess(await runRestore(context, params, keys))
            } catch (error) {
                const category = categorize(error)
                logError(error, category)
                await discardPersistedKeys()
                onError(category)
            } finally {
                zeroBytes(keys.encryptionKey)
                zeroBytes(keys.authSecretKey)
            }
        },
        [context, onSuccess, onError],
    )

    return { restore }
}
