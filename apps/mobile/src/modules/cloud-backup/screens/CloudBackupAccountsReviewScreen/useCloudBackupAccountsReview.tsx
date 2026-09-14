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

import { useCallback, useState } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useBottomSheet } from '@modules/bottom-sheet'
import { DeleteFromBackupSheet } from '../../components/DeleteFromBackupSheet'
import { useBackupAccountReview } from '../../hooks/useBackupAccountReview'

type UseCloudBackupAccountsReviewResult = {
    availableFromBackup: string[]
    notBackedUpAccounts: WalletAccount[]
    isExpanded: boolean
    busyAddress: string | null
    onToggleExpanded: () => void
    onAdd: (address: string) => void
    onDelete: (address: string) => Promise<void>
    onBackUp: (address: string) => void
}

export const useCloudBackupAccountsReview =
    (): UseCloudBackupAccountsReviewResult => {
        const { request: requestBottomSheet } = useBottomSheet()
        const {
            availableFromBackup,
            notBackedUpAccounts,
            busyAddress,
            addFromBackup,
            deleteFromBackup,
            backUpAccount,
        } = useBackupAccountReview()

        // Without a Not Backed Up section below it, the collapsed card is the
        // whole screen.
        const [isExpanded, setIsExpanded] = useState(
            () => notBackedUpAccounts.length === 0,
        )

        const onDelete = useCallback(
            async (address: string) => {
                const confirmed = await requestBottomSheet<boolean>({
                    contents: <DeleteFromBackupSheet />,
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (confirmed === true) deleteFromBackup(address)
            },
            [requestBottomSheet, deleteFromBackup],
        )

        return {
            availableFromBackup,
            notBackedUpAccounts,
            isExpanded,
            busyAddress,
            onToggleExpanded: useCallback(
                () => setIsExpanded(current => !current),
                [],
            ),
            onAdd: addFromBackup,
            onDelete,
            onBackUp: backUpAccount,
        }
    }
