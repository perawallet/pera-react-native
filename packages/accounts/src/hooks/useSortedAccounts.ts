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
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    accountValueKey,
    type AccountSortMode,
    type AccountValues,
    type WalletAccount,
} from '../models'
import { getAccountDisplayName } from '../utils'
import { useAccountsStore } from '../store'
import { accountValueOf } from './useAccountChain'
import { useAccountValueBasis } from './useAccountValueBasis'
import {
    accountChainEntries,
    useOtherRegisteredChainIds,
} from './accountChainEntries'

type UseSortedAccountsResult = {
    sortedAccounts: WalletAccount[]
    sortMode: AccountSortMode
    setSortMode: (mode: AccountSortMode) => void
    manualAccountOrder: string[]
    setManualAccountOrder: (order: string[]) => void
}

/** Nulls last in either direction: an unpriced account ranks below every priced one. */
const compareNullable = (
    a: Nullable<Decimal>,
    b: Nullable<Decimal>,
    direction: 1 | -1,
): number => {
    if (a === null || b === null) {
        return (a === null ? 1 : 0) - (b === null ? 1 : 0)
    }
    return a.comparedTo(b) * direction
}

/**
 * `accountBalances` has one entry per chain an account is on;
 * the address on `chainId` also names unnamed accounts. See
 * `AccountValueBasis` for which value ranks.
 */
export const useSortedAccounts = (
    accounts: WalletAccount[],
    accountBalances: AccountValues,
    chainId: ChainId,
): UseSortedAccountsResult => {
    const basis = useAccountValueBasis(chainId)
    const otherChainIds = useOtherRegisteredChainIds(chainId)
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
        // Summed over every chain the account is on; unknown if any part is.
        const fiatOf = (account: WalletAccount): Nullable<Decimal> => {
            const entries = accountChainEntries(account, chainId, otherChainIds)
            if (entries.length === 0) return null
            return entries.reduce<Nullable<Decimal>>((sum, entry) => {
                const fiatValue = accountBalances.get(
                    accountValueKey(entry.chainId, entry.address),
                )?.fiatValue
                return sum === null || !fiatValue ? null : sum.plus(fiatValue)
            }, new Decimal(0))
        }
        const nativeOf = (account: WalletAccount): Nullable<Decimal> => {
            const values = accountValueOf(account, chainId, accountBalances)
            // -1 only marks totals that haven't loaded, which keeps the
            // single-chain order as it was; `null` is a known unknown.
            return values ? values.nativeValue : new Decimal(-1)
        }
        const compareByValue = (
            a: WalletAccount,
            b: WalletAccount,
            direction: 1 | -1,
        ) => {
            const valueOf = basis === 'fiat' ? fiatOf : nativeOf
            return compareNullable(valueOf(a), valueOf(b), direction)
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
                sorted.sort((a, b) => compareByValue(a, b, 1))
                break
            }
            case 'balanceDesc': {
                sorted.sort((a, b) => compareByValue(a, b, -1))
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
    }, [
        accounts,
        sortMode,
        accountBalances,
        manualAccountOrder,
        chainId,
        basis,
        otherChainIds,
    ])

    return {
        sortedAccounts,
        sortMode,
        setSortMode,
        manualAccountOrder,
        setManualAccountOrder,
    }
}
