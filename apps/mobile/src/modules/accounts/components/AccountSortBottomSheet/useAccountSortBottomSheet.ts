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

import { useCallback } from 'react'
import {
    AccountSortMode,
    AccountSortModes,
    useAllAccounts,
    useSortedAccounts,
    useAccountBalancesQuery,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'

type SortOption = {
    mode: AccountSortMode
    labelKey: string
}

const SORT_OPTIONS: SortOption[] = [
    {
        mode: AccountSortModes.alphabeticalAsc,
        labelKey: 'account_sort.alphabetical_asc',
    },
    {
        mode: AccountSortModes.alphabeticalDesc,
        labelKey: 'account_sort.alphabetical_desc',
    },
    { mode: AccountSortModes.balanceAsc, labelKey: 'account_sort.balance_asc' },
    {
        mode: AccountSortModes.balanceDesc,
        labelKey: 'account_sort.balance_desc',
    },
    { mode: AccountSortModes.manual, labelKey: 'account_sort.manual' },
]

type UseAccountSortBottomSheetProps = {
    onClose: () => void
}

type UseAccountSortBottomSheetResult = {
    sortOptions: SortOption[]
    sortMode: AccountSortMode
    sortedAccounts: WalletAccount[]
    manualAccountOrder: string[]
    handleSortModeChange: (mode: AccountSortMode) => void
    handleReorder: (orderedAddresses: string[]) => void
    handleDone: () => void
    t: (key: string) => string
}

export const useAccountSortBottomSheet = ({
    onClose,
}: UseAccountSortBottomSheetProps): UseAccountSortBottomSheetResult => {
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const { accountBalances } = useAccountBalancesQuery(accounts, true)
    const {
        sortedAccounts,
        sortMode,
        setSortMode,
        manualAccountOrder,
        setManualAccountOrder,
    } = useSortedAccounts(accounts, accountBalances)

    const handleSortModeChange = useCallback(
        (mode: AccountSortMode) => {
            setSortMode(mode)
        },
        [setSortMode],
    )

    const handleReorder = useCallback(
        (orderedAddresses: string[]) => {
            setManualAccountOrder(orderedAddresses)
        },
        [setManualAccountOrder],
    )

    const handleDone = useCallback(() => {
        onClose()
    }, [onClose])

    return {
        sortOptions: SORT_OPTIONS,
        sortMode,
        sortedAccounts,
        manualAccountOrder,
        handleSortModeChange,
        handleReorder,
        handleDone,
        t,
    }
}
