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
import type { Decimal } from 'decimal.js'
import {
    useAccountBalancesQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useRampPairsQuery,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { isAlgoAssetName, type Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type OnrampSelectableToken = {
    token: RampToken
    balance: Nullable<Decimal>
}

type UseOnrampPairSelectionContentParams = {
    variant: 'source' | 'destination'
}

type UseOnrampPairSelectionContentResult = {
    items: OnrampSelectableToken[]
    searchFilter: string
    setSearchFilter: (value: string) => void
    isLoading: boolean
    handleTokenSelected: (token: RampToken) => void
}

// ALGO is stored as a holding row under asset id '0'; non-ALGO ramp tokens have
// no real Algorand asset id, so their balance won't resolve (shown as unowned).
const tokenAssetId = (token: RampToken): string =>
    isAlgoAssetName(token.id) || isAlgoAssetName(token.symbol) ? '0' : token.id

export const useOnrampPairSelectionContent = ({
    variant,
}: UseOnrampPairSelectionContentParams): UseOnrampPairSelectionContentResult => {
    const { resolve } = useBottomSheetResult<string>()
    const { data: pairs, isLoading } = useRampPairsQuery()
    const selectedAccount = useSelectedAccount()
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )
    const [searchFilter, setSearchFilter] = useState('')

    const balanceMap = useMemo((): Map<string, Decimal> => {
        if (!selectedAccount?.address) return new Map()
        const assetBalances =
            accountBalances.get(selectedAccount.address)?.assetBalances ?? []
        return new Map(assetBalances.map(item => [item.assetId, item.amount]))
    }, [accountBalances, selectedAccount?.address])

    const items = useMemo((): OnrampSelectableToken[] => {
        const seen = new Set<string>()
        const deduped: RampToken[] = []
        for (const pair of pairs ?? []) {
            const token =
                variant === 'source' ? pair.sourceToken : pair.destinationToken
            if (!seen.has(token.id)) {
                seen.add(token.id)
                deduped.push(token)
            }
        }

        const term = searchFilter.toLowerCase().trim()
        const filtered = term
            ? deduped.filter(
                  token =>
                      token.name.toLowerCase().includes(term) ||
                      token.symbol.toLowerCase().includes(term),
              )
            : deduped

        const sorted = [...filtered].sort((a, b) =>
            a.name.localeCompare(b.name),
        )

        return sorted.map(token => ({
            token,
            balance: balanceMap.get(tokenAssetId(token)) ?? null,
        }))
    }, [pairs, variant, searchFilter, balanceMap])

    const handleTokenSelected = useCallback(
        (token: RampToken) => {
            resolve(token.id)
        },
        [resolve],
    )

    return {
        items,
        searchFilter,
        setSearchFilter,
        isLoading,
        handleTokenSelected,
    }
}
