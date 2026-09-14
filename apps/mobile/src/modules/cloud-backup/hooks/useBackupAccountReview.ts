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

import { useCallback, useMemo, useState } from 'react'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    deriveBackupAccountReview,
    useBackupReviewActionMutation,
    useBackupSyncStateStore,
    type BackupReviewAction,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type UseBackupAccountReviewResult = {
    backedUpAccounts: WalletAccount[]
    notBackedUpAccounts: WalletAccount[]
    /** Addresses the backup holds that this device deleted. */
    availableFromBackup: string[]
    isBackedUp: (address: string) => boolean
    busyAddress: string | null
    backUpAccount: (address: string) => void
    addFromBackup: (address: string) => void
    deleteFromBackup: (address: string) => void
}

const TOAST_KEY: Record<
    BackupReviewAction,
    { success: string; error: string }
> = {
    backUp: {
        success: 'cloud_backup.accounts.back_up_success',
        error: 'cloud_backup.accounts.back_up_error',
    },
    add: {
        success: 'cloud_backup.accounts.add_success',
        error: 'cloud_backup.accounts.add_error',
    },
    delete: {
        success: 'cloud_backup.accounts.delete_success',
        error: 'cloud_backup.accounts.delete_error',
    },
}

export const useBackupAccountReview = (): UseBackupAccountReviewResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const [busyAddress, setBusyAddress] = useState<string | null>(null)
    const accounts = useAccountsStore(state => state.accounts)
    const syncState = useBackupSyncStateStore(state => state.syncState)

    const addresses = useMemo(
        () => accounts.map(account => account.address),
        [accounts],
    )

    const review = useMemo(
        () => deriveBackupAccountReview(syncState, addresses),
        [syncState, addresses],
    )

    const { mutate } = useBackupReviewActionMutation('account', {
        onMutate: ({ address }) => setBusyAddress(address),
        onSuccess: (_result, { action }) => {
            showToast({
                title: t(TOAST_KEY[action].success),
                body: '',
                type: 'success',
            })
        },
        onError: (error, { action, address }) => {
            logger.warn('useBackupAccountReview: review action failed', {
                action,
                address,
                error: error instanceof Error ? error.message : String(error),
            })
            showToast({
                title: t(TOAST_KEY[action].error),
                body: '',
                type: 'error',
            })
        },
        onSettled: () => setBusyAddress(null),
    })

    const backUpAccount = useCallback(
        (address: string) => mutate({ action: 'backUp', address }),
        [mutate],
    )
    const addFromBackup = useCallback(
        (address: string) => mutate({ action: 'add', address }),
        [mutate],
    )
    const deleteFromBackup = useCallback(
        (address: string) => mutate({ action: 'delete', address }),
        [mutate],
    )

    const byAddress = useMemo(
        () => new Map(accounts.map(account => [account.address, account])),
        [accounts],
    )

    const notBackedUpAccounts = useMemo(
        () =>
            review.notBackedUp
                .map(address => byAddress.get(address))
                .filter((account): account is WalletAccount => account != null),
        [review.notBackedUp, byAddress],
    )

    const backedUpAccounts = useMemo(
        () => accounts.filter(account => review.backedUp.has(account.address)),
        [accounts, review.backedUp],
    )

    return {
        backedUpAccounts,
        notBackedUpAccounts,
        availableFromBackup: review.availableFromBackup,
        isBackedUp: useCallback(
            (address: string) => review.backedUp.has(address),
            [review.backedUp],
        ),
        busyAddress,
        backUpAccount,
        addFromBackup,
        deleteFromBackup,
    }
}
