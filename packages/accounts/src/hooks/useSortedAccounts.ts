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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import type {
    AccountAlgoValues,
    AccountSortMode,
    WalletAccount,
} from '../models'
import { getAccountDisplayName } from '../utils'
import { useAccountsStore } from '../store'

type UseSortedAccountsResult = {
    sortedAccounts: WalletAccount[]
    sortMode: AccountSortMode
    setSortMode: (mode: AccountSortMode) => void
    manualAccountOrder: string[]
    setManualAccountOrder: (order: string[]) => void
}

export const useSortedAccounts = (
    accounts: WalletAccount[],
    accountBalances: AccountAlgoValues,
): UseSortedAccountsResult => {
    const sortMode = useAccountsStore(state => state.sortMode)
    const manualAccountOrder = useAccountsStore(
        state => state.manualAccountOrder,
    )
    const setSortMode = useAccountsStore(state => state.setSortMode)
    const setManualAccountOrder = useAccountsStore(
        state => state.setManualAccountOrder,
    )

    const sortedAccounts = useMemo(() => {
        const sorted = [...accounts]

        switch (sortMode) {
            case 'alphabeticalAsc': {
                sorted.sort((a, b) =>
                    getAccountDisplayName(a).localeCompare(
                        getAccountDisplayName(b),
                    ),
                )
                break
            }
            case 'alphabeticalDesc': {
                sorted.sort((a, b) =>
                    getAccountDisplayName(b).localeCompare(
                        getAccountDisplayName(a),
                    ),
                )
                break
            }
            case 'balanceAsc': {
                sorted.sort((a, b) => {
                    const aVal =
                        accountBalances.get(a.address)?.algoValue ??
                        new Decimal(-1)
                    const bVal =
                        accountBalances.get(b.address)?.algoValue ??
                        new Decimal(-1)
                    return aVal.minus(bVal).toNumber()
                })
                break
            }
            case 'balanceDesc': {
                sorted.sort((a, b) => {
                    const aVal =
                        accountBalances.get(a.address)?.algoValue ??
                        new Decimal(-1)
                    const bVal =
                        accountBalances.get(b.address)?.algoValue ??
                        new Decimal(-1)
                    return bVal.minus(aVal).toNumber()
                })
                break
            }
            case 'manual': {
                const orderMap = new Map(
                    manualAccountOrder.map((addr, i) => [addr, i]),
                )
                sorted.sort((a, b) => {
                    const aIdx = orderMap.get(a.address) ?? Infinity
                    const bIdx = orderMap.get(b.address) ?? Infinity
                    return aIdx - bIdx
                })
                break
            }
        }

        return sorted
    }, [accounts, sortMode, accountBalances, manualAccountOrder])

    return {
        sortedAccounts,
        sortMode,
        setSortMode,
        manualAccountOrder,
        setManualAccountOrder,
    }
}
