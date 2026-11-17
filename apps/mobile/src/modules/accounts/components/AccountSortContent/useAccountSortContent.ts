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

import { useCallback, useRef, useState } from 'react'
import {
    type AccountSortMode,
    AccountSortModes,
    useAllAccounts,
    useSortedAccounts,
    useAccountValueTotalsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

type SortOption = {
    mode: AccountSortMode
    labelKey: I18nKey
}

const SORT_OPTIONS: SortOption[] = [
    {
        mode: AccountSortModes.alphabeticalAsc,
        labelKey: i18nKey('account_sort.alphabetical_asc'),
    },
    {
        mode: AccountSortModes.alphabeticalDesc,
        labelKey: i18nKey('account_sort.alphabetical_desc'),
    },
    {
        mode: AccountSortModes.balanceAsc,
        labelKey: i18nKey('account_sort.balance_asc'),
    },
    {
        mode: AccountSortModes.balanceDesc,
        labelKey: i18nKey('account_sort.balance_desc'),
    },
    { mode: AccountSortModes.manual, labelKey: i18nKey('account_sort.manual') },
]

type UseAccountSortContentResult = {
    sortOptions: SortOption[]
    sortMode: AccountSortMode
    sortedAccounts: WalletAccount[]
    handleSortModeChange: (mode: AccountSortMode) => void
    /** A drag started; a commit waits for its `handleReorder` (the drop). */
    beginReorder: () => void
    handleReorder: (orderedIds: string[]) => void
    /** Writes the draft, then calls `onCommitted` (once a settling drop lands). */
    commitChanges: (onCommitted?: () => void) => void
    t: (key: string) => string
}

export const useAccountSortContent = (): UseAccountSortContentResult => {
    const scope = useHomeChainScope()
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const { accountValueTotals } = useAccountValueTotalsQuery(
        accounts,
        scope,
        true,
    )
    const { sortedAccounts, sortMode, setSortMode, setManualAccountOrder } =
        useSortedAccounts(accounts, accountValueTotals, scope.chainId)

    // Snapshot sort state on open; upstream changes are intentionally ignored
    // while the sheet is mounted, so edits aren't clobbered by late updates.
    const [draftSortMode, setDraftSortMode] = useState(sortMode)
    const [draftAccounts, setDraftAccounts] = useState(sortedAccounts)

    const handleSortModeChange = useCallback((mode: AccountSortMode) => {
        setDraftSortMode(mode)
    }, [])

    // The list reports a drop only once its settle animation ends, so Apply
    // tapped in between would commit the order from before the drag.
    const isDropSettling = useRef(false)
    const pendingCommit = useRef<(accounts: WalletAccount[]) => void>(null)

    const commit = useCallback(
        (orderedAccounts: WalletAccount[]) => {
            setSortMode(draftSortMode)
            if (draftSortMode === AccountSortModes.manual) {
                setManualAccountOrder(orderedAccounts.map(a => a.id))
            }
        },
        [draftSortMode, setSortMode, setManualAccountOrder],
    )

    const beginReorder = useCallback(() => {
        isDropSettling.current = true
    }, [])

    const handleReorder = useCallback(
        (orderedIds: string[]) => {
            const byId = new Map(accounts.map(a => [a.id, a]))
            const next = orderedIds
                .map(id => byId.get(id))
                .filter((a): a is WalletAccount => a !== undefined)
            setDraftAccounts(next)
            isDropSettling.current = false
            const pending = pendingCommit.current
            pendingCommit.current = null
            pending?.(next)
        },
        [accounts],
    )

    const commitChanges = useCallback(
        (onCommitted?: () => void) => {
            if (isDropSettling.current) {
                pendingCommit.current = orderedAccounts => {
                    commit(orderedAccounts)
                    onCommitted?.()
                }
                return
            }
            commit(draftAccounts)
            onCommitted?.()
        },
        [commit, draftAccounts],
    )

    return {
        sortOptions: SORT_OPTIONS,
        sortMode: draftSortMode,
        sortedAccounts: draftAccounts,
        handleSortModeChange,
        beginReorder,
        handleReorder,
        commitChanges,
        t,
    }
}
