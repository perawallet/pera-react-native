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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type {
    AccountAlgoValues,
    AccountSortMode,
    WalletAccount,
} from '../models'
import { getAccountDisplayName } from '../utils'
import { useAccountsStore } from '../store'
import { chainAccountOf } from '../credentials'

type UseSortedAccountsResult = {
    sortedAccounts: WalletAccount[]
    sortMode: AccountSortMode
    setSortMode: (mode: AccountSortMode) => void
    manualAccountOrder: string[]
    setManualAccountOrder: (order: string[]) => void
}

/** `accountBalances` is keyed by each account's address on `chainId`, which also names unnamed accounts. */
export const useSortedAccounts = (
    accounts: WalletAccount[],
    accountBalances: AccountAlgoValues,
    chainId: ChainId,
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
        const nameOf = (account: WalletAccount) =>
            getAccountDisplayName(account, chainId)
        const valueOf = (account: WalletAccount) => {
            const address = chainAccountOf(account, chainId)?.address
            return (
                (address
                    ? accountBalances.get(address)?.algoValue
                    : undefined) ?? new Decimal(-1)
            )
        }

        switch (sortMode) {
            case 'alphabeticalAsc': {
                sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
                break
            }
            case 'alphabeticalDesc': {
                sorted.sort((a, b) => nameOf(b).localeCompare(nameOf(a)))
                break
            }
            case 'balanceAsc': {
                sorted.sort((a, b) => valueOf(a).minus(valueOf(b)).toNumber())
                break
            }
            case 'balanceDesc': {
                sorted.sort((a, b) => valueOf(b).minus(valueOf(a)).toNumber())
                break
            }
            case 'manual': {
                const orderMap = new Map(
                    manualAccountOrder.map((id, i) => [id, i]),
                )
                sorted.sort((a, b) => {
                    const aIdx = orderMap.get(a.id) ?? Infinity
                    const bIdx = orderMap.get(b.id) ?? Infinity
                    return aIdx - bIdx
                })
                break
            }
        }

        return sorted
    }, [accounts, sortMode, accountBalances, manualAccountOrder, chainId])

    return {
        sortedAccounts,
        sortMode,
        setSortMode,
        manualAccountOrder,
        setManualAccountOrder,
    }
}
