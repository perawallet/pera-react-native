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

import { useCallback } from 'react'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import {
    deviceIdForDeployment,
    useDeviceStore,
} from '@perawallet/wallet-core-device'
import {
    restoreCloudBackup,
    type RestoreCloudBackupResult,
} from '../restore/restoreCloudBackup'
import type { Argon2idConfig } from '../models'
import { applyBackupSettings } from '../sync/backupSettingsStores'
import { readCloudBackupRestoreMnemonic } from '../store/draftStore'
import { useCloudBackupRestoreProgressStore } from '../store/restoreProgressStore'
import { useCloudBackupStore } from '../store/store'
import { useBackupSyncStateStore } from '../store/syncStateStore'
import { useCloudBackupContactImport } from './useCloudBackupContactImport'
import { useCloudBackupImport } from './useCloudBackupImport'
import { useCloudBackupPasskeyImport } from './useCloudBackupPasskeyImport'
import { useResolveSeedEntropyForBackup } from './useResolveSeedEntropyForBackup'

export type RestoreCloudBackupVariables = {
    /** Base64 salt the UI calls the "encryption key". */
    salt: string
    /** Omitted for a manually entered salt: the phrase carries no parameters,
     *  so the backup is assumed to be on this build's defaults. */
    argon2id?: Argon2idConfig
}

// TanStack swaps a pending mutation's options on every render, so the device ID travels in the variables.
type RestoreCloudBackupMutationVariables = RestoreCloudBackupVariables & {
    deviceId: Nullable<string>
}

export type UseRestoreCloudBackupMutationResult = {
    mutate: (variables: RestoreCloudBackupVariables) => void
    mutateAsync: (
        variables: RestoreCloudBackupVariables,
    ) => Promise<RestoreCloudBackupResult>
    isPending: boolean
}

/**
 * Pulls the remote backup for the phrase held in the restore draft and imports
 * it into the wallet. Rejects with a `CloudBackupRestoreError`; read its
 * category with `restoreErrorCategoryOf`.
 */
export const useRestoreCloudBackupMutation = (
    scope: ChainScope,
    options?: UseMutationOptions<
        RestoreCloudBackupResult,
        Error,
        RestoreCloudBackupMutationVariables
    >,
): UseRestoreCloudBackupMutationResult => {
    const deployment = useWalletDeployment()
    const setConfigured = useCloudBackupStore(state => state.setConfigured)
    const setSyncState = useBackupSyncStateStore(state => state.setSyncState)
    const setProgress = useCloudBackupRestoreProgressStore(
        state => state.setProgress,
    )
    const { importAccounts } = useCloudBackupImport(scope)
    const { importContacts } = useCloudBackupContactImport()
    const { importPasskeys } = useCloudBackupPasskeyImport(
        scope.chainId,
        useResolveSeedEntropyForBackup(scope.chainId),
    )

    const { mutate, mutateAsync, isPending } = useMutation({
        throwOnError: false,
        mutationFn: async ({
            salt,
            argon2id,
            deviceId,
        }: RestoreCloudBackupMutationVariables): Promise<RestoreCloudBackupResult> => {
            if (!deviceId) {
                throw new Error('Device ID is unavailable')
            }
            // Words live only for this call; the retained form stays the
            // zeroable index buffer in the draft store.
            const mnemonic = readCloudBackupRestoreMnemonic()
            if (!mnemonic) {
                throw new Error('Cloud backup restore phrase is missing')
            }
            let result: RestoreCloudBackupResult
            try {
                result = await restoreCloudBackup({
                    mnemonic,
                    salt,
                    argon2id,
                    deviceId,
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
            setConfigured({ backupId: result.backupId, salt, deviceId })
            setSyncState(result.syncState)
            return result
        },
        ...options,
    })

    // Read at call time: the QR scan holds `restore` across an awaited sheet, during which the device can register.
    const withDeviceId = useCallback(
        (
            variables: RestoreCloudBackupVariables,
        ): RestoreCloudBackupMutationVariables => ({
            ...variables,
            deviceId: deviceIdForDeployment(
                useDeviceStore.getState(),
                deployment,
            ),
        }),
        [deployment],
    )
    const restore = useCallback(
        (variables: RestoreCloudBackupVariables) =>
            mutate(withDeviceId(variables)),
        [mutate, withDeviceId],
    )
    const restoreAsync = useCallback(
        (variables: RestoreCloudBackupVariables) =>
            mutateAsync(withDeviceId(variables)),
        [mutateAsync, withDeviceId],
    )

    return { mutate: restore, mutateAsync: restoreAsync, isPending }
}
