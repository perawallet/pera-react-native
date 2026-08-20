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
import {
    type AccountSortMode,
    AccountSortModes,
    useAllAccounts,
    useSortedAccounts,
    useAccountValueTotalsQuery,
    type WalletAccount,
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

type UseAccountSortContentResult = {
    sortOptions: SortOption[]
    sortMode: AccountSortMode
    sortedAccounts: WalletAccount[]
    handleSortModeChange: (mode: AccountSortMode) => void
    handleReorder: (orderedAddresses: string[]) => void
    commitChanges: () => void
    t: (key: string) => string
}

export const useAccountSortContent = (): UseAccountSortContentResult => {
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const { accountValueTotals } = useAccountValueTotalsQuery(accounts, true)
    const { sortedAccounts, sortMode, setSortMode, setManualAccountOrder } =
        useSortedAccounts(accounts, accountValueTotals)

    // Snapshot sort state on open; upstream changes are intentionally ignored
    // while the sheet is mounted, so edits aren't clobbered by late updates.
    const [draftSortMode, setDraftSortMode] = useState(sortMode)
    const [draftAccounts, setDraftAccounts] = useState(sortedAccounts)

    const handleSortModeChange = useCallback((mode: AccountSortMode) => {
        setDraftSortMode(mode)
    }, [])

    const handleReorder = useCallback(
        (orderedAddresses: string[]) => {
            const byAddress = new Map(accounts.map(a => [a.address, a]))
            setDraftAccounts(
                orderedAddresses
                    .map(address => byAddress.get(address))
                    .filter((a): a is WalletAccount => a !== undefined),
            )
        },
        [accounts],
    )

    const commitChanges = useCallback(() => {
        setSortMode(draftSortMode)
        if (draftSortMode === AccountSortModes.manual) {
            setManualAccountOrder(draftAccounts.map(a => a.address))
        }
    }, [draftSortMode, draftAccounts, setSortMode, setManualAccountOrder])

    return {
        sortOptions: SORT_OPTIONS,
        sortMode: draftSortMode,
        sortedAccounts: draftAccounts,
        handleSortModeChange,
        handleReorder,
        commitChanges,
        t,
    }
}
