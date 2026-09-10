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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import { enableCloudBackup } from '../credentials/enableCloudBackup'
import type { BackupId } from '../models'
import { useCloudBackupDraftStore } from '../store/draftStore'
import { useCloudBackupStore } from '../store/store'

/** Words live only for the caller's turn; the retained form stays the zeroable
 *  index buffer in the draft store. */
const toMnemonicWords = (indices: Uint16Array): string[] =>
    Array.from(indices, index => mnemonicIndexToWord(index))

export type EnableCloudBackupMutationResult = {
    backupId: BackupId
    /** The salt the backup was registered with, pinned to this attempt. */
    salt: string
    /** The device id the backup was registered under, pinned to this attempt. */
    deviceId: string
}

/**
 * Registers the drafted credentials with the backup service and promotes them
 * to the configured store. The local writes happen inside the mutation rather
 * than in `onSuccess` because the draft can be cleared by an unmount while the
 * request is in flight, and the backup exists server-side by then.
 */
export const useEnableCloudBackupMutation = (
    options?: UseMutationOptions<EnableCloudBackupMutationResult, Error, void>,
) => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const mnemonicIndices = useCloudBackupDraftStore(
        state => state.mnemonicIndices,
    )
    const salt = useCloudBackupDraftStore(state => state.salt)
    const clearDraft = useCloudBackupDraftStore(state => state.clearDraft)
    const setConfigured = useCloudBackupStore(state => state.setConfigured)

    return useMutation({
        throwOnError: false,
        mutationFn: async (): Promise<EnableCloudBackupMutationResult> => {
            if (!mnemonicIndices || !salt) {
                throw new Error('Cloud backup draft credentials are missing')
            }
            if (!deviceId) {
                throw new Error('Device ID is unavailable')
            }
            const { backupId } = await enableCloudBackup({
                mnemonic: toMnemonicWords(mnemonicIndices),
                salt,
                deviceId,
                network,
            })
            setConfigured({ backupId, salt, deviceId })
            clearDraft()
            return { backupId, salt, deviceId }
        },
        ...options,
    })
}
