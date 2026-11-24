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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import {
    deviceIdForDeployment,
    useDeviceStore,
} from '@perawallet/wallet-core-device'
import {
    prepareCloudBackupRestore,
    type PreparedCloudBackupRestore,
} from '../restore/restoreCloudBackup'
import type { Argon2idConfig } from '../models'
import { readCloudBackupRestoreMnemonic } from '../store/draftStore'
import { useCloudBackupRestoreProgressStore } from '../store/restoreProgressStore'
import { useCloudBackupRestoreSessionStore } from '../store/restoreSessionStore'

export type RestoreCloudBackupVariables = {
    /** Base64 salt the UI calls the "encryption key". */
    salt: string
    /** Omitted for a manually entered salt: the phrase carries no parameters,
     *  so the backup is assumed to be on this build's defaults. */
    argon2id?: Argon2idConfig
    /** True when the user entered the phrase and encryption key themselves;
     *  false for a sync QR. */
    credentialsConfirmed: boolean
}

// TanStack swaps a pending mutation's options on every render, so the device ID travels in the variables.
type PrepareCloudBackupRestoreMutationVariables =
    RestoreCloudBackupVariables & {
        deviceId: Nullable<string>
    }

export type UsePrepareCloudBackupRestoreMutationResult = {
    mutate: (variables: RestoreCloudBackupVariables) => void
    mutateAsync: (
        variables: RestoreCloudBackupVariables,
    ) => Promise<PreparedCloudBackupRestore>
    isPending: boolean
}

/**
 * Unlocks and downloads the backup for the phrase held in the restore draft,
 * and holds it in the restore session for the user to choose accounts.
 * `useCompleteCloudBackupRestoreMutation` writes it to the wallet. Rejects
 * with a `CloudBackupRestoreError`; read its category with
 * `restoreErrorCategoryOf`.
 */
export const usePrepareCloudBackupRestoreMutation = (
    options?: UseMutationOptions<
        PreparedCloudBackupRestore,
        Error,
        PrepareCloudBackupRestoreMutationVariables
    >,
): UsePrepareCloudBackupRestoreMutationResult => {
    const deployment = useWalletDeployment()
    const setProgress = useCloudBackupRestoreProgressStore(
        state => state.setProgress,
    )
    const setSession = useCloudBackupRestoreSessionStore(
        state => state.setSession,
    )

    const { mutate, mutateAsync, isPending } = useMutation({
        throwOnError: false,
        mutationFn: async ({
            salt,
            argon2id,
            credentialsConfirmed,
            deviceId,
        }: PrepareCloudBackupRestoreMutationVariables): Promise<PreparedCloudBackupRestore> => {
            if (!deviceId) {
                throw new Error('Device ID is unavailable')
            }
            // Words live only for this call; the retained form stays the
            // zeroable index buffer in the draft store.
            const mnemonic = readCloudBackupRestoreMnemonic()
            if (!mnemonic) {
                throw new Error('Cloud backup restore phrase is missing')
            }
            let prepared: PreparedCloudBackupRestore
            try {
                prepared = await prepareCloudBackupRestore({
                    mnemonic,
                    salt,
                    argon2id,
                    deviceId,
                    onProgress: setProgress,
                })
            } finally {
                setProgress(null)
            }
            setSession({ prepared, salt, credentialsConfirmed })
            return prepared
        },
        ...options,
    })

    // Read at call time: the QR scan holds `prepare` across an awaited sheet, during which the device can register.
    const withDeviceId = useCallback(
        (
            variables: RestoreCloudBackupVariables,
        ): PrepareCloudBackupRestoreMutationVariables => ({
            ...variables,
            deviceId: deviceIdForDeployment(
                useDeviceStore.getState(),
                deployment,
            ),
        }),
        [deployment],
    )
    const prepare = useCallback(
        (variables: RestoreCloudBackupVariables) =>
            mutate(withDeviceId(variables)),
        [mutate, withDeviceId],
    )
    const prepareAsync = useCallback(
        (variables: RestoreCloudBackupVariables) =>
            mutateAsync(withDeviceId(variables)),
        [mutateAsync, withDeviceId],
    )

    return { mutate: prepare, mutateAsync: prepareAsync, isPending }
}
