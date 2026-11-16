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

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    CloudBackupRestoreError,
    completeCloudBackupRestore,
    type RestoreAccountSelection,
    type RestoreCloudBackupResult,
} from '../restore/restoreCloudBackup'
import { applyBackupSettings } from '../sync/backupSettingsStores'
import { useCloudBackupRestoreProgressStore } from '../store/restoreProgressStore'
import { useCloudBackupRestoreSessionStore } from '../store/restoreSessionStore'
import { useCloudBackupStore } from '../store/store'
import { useBackupSyncStateStore } from '../store/syncStateStore'
import { useCloudBackupContactImport } from './useCloudBackupContactImport'
import { useCloudBackupImport } from './useCloudBackupImport'
import { useCloudBackupPasskeyImport } from './useCloudBackupPasskeyImport'
import { useResolveSeedEntropyForBackup } from './useResolveSeedEntropyForBackup'

/** Read when the restore runs, before it adds anything. */
const addressesOnDevice = (): ReadonlySet<string> =>
    new Set(
        useAccountsStore
            .getState()
            .accounts.flatMap(({ chains }) =>
                Object.values(chains).flatMap(entry =>
                    entry ? [entry.address] : [],
                ),
            ),
    )

export type UseCompleteCloudBackupRestoreMutationResult = {
    mutate: (selection: RestoreAccountSelection) => void
    mutateAsync: (
        selection: RestoreAccountSelection,
    ) => Promise<RestoreCloudBackupResult>
    isPending: boolean
}

/**
 * Writes the restore session's backup to the wallet: the chosen accounts,
 * then contacts, passkeys and settings, and configures the backup so sync
 * starts. Rejects with a `CloudBackupRestoreError`, which also ends the
 * session: its stored keys are gone, so the restore has to start over.
 */
export const useCompleteCloudBackupRestoreMutation = (
    scope: ChainScope,
    options?: UseMutationOptions<
        RestoreCloudBackupResult,
        Error,
        RestoreAccountSelection
    >,
): UseCompleteCloudBackupRestoreMutationResult => {
    const setConfigured = useCloudBackupStore(state => state.setConfigured)
    const setSyncState = useBackupSyncStateStore(state => state.setSyncState)
    const setProgress = useCloudBackupRestoreProgressStore(
        state => state.setProgress,
    )
    const setSession = useCloudBackupRestoreSessionStore(
        state => state.setSession,
    )
    const { importAccounts } = useCloudBackupImport(scope)
    const { importContacts } = useCloudBackupContactImport()
    const { importPasskeys } = useCloudBackupPasskeyImport(
        scope.chainId,
        useResolveSeedEntropyForBackup(scope.chainId),
    )

    const { mutate, mutateAsync, isPending } = useMutation({
        throwOnError: false,
        mutationFn: async (
            selection: RestoreAccountSelection,
        ): Promise<RestoreCloudBackupResult> => {
            const session = useCloudBackupRestoreSessionStore.getState().session
            if (!session) {
                throw new CloudBackupRestoreError(
                    'UNKNOWN',
                    new Error('No cloud backup restore is waiting'),
                )
            }
            // Taken out before the import starts: a screen that unmounts
            // mid-import must find nothing to discard, or it deletes the keys
            // this restore is about to configure.
            setSession(null)
            const onDevice = addressesOnDevice()
            let result: RestoreCloudBackupResult
            try {
                result = await completeCloudBackupRestore({
                    prepared: session.prepared,
                    selection,
                    isOnDevice: address => onDevice.has(address),
                    importAccounts,
                    importContacts,
                    importPasskeys,
                    importSettings: settings =>
                        applyBackupSettings(settings, scope.chainId),
                    onProgress: setProgress,
                })
            } finally {
                setProgress(null)
            }
            // The backup is registered server-side under exactly this device
            // id, and every later signed request has to reuse it.
            setConfigured({
                backupId: result.backupId,
                salt: session.salt,
                deviceId: session.prepared.deviceId,
            })
            setSyncState(result.syncState)
            return result
        },
        ...options,
    })

    return { mutate, mutateAsync, isPending }
}
