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
    addressOn,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    rampTokenAsset,
    useRampPairsQuery,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'

export type OnrampSelectableToken = {
    token: RampToken
    balance: Nullable<Decimal>
    /** The asset the token arrives as on the account's chain, once loaded. */
    asset: Nullable<PeraAsset>
}

type UseOnrampPairSelectionContentParams = {
    variant: 'source' | 'destination'
    scope: ChainScope
}

type UseOnrampPairSelectionContentResult = {
    items: OnrampSelectableToken[]
    searchFilter: string
    setSearchFilter: (value: string) => void
    isLoading: boolean
    handleTokenSelected: (token: RampToken) => void
}

export const useOnrampPairSelectionContent = ({
    variant,
    scope,
}: UseOnrampPairSelectionContentParams): UseOnrampPairSelectionContentResult => {
    const { account } = useOnrampAccount()
    const { resolve } = useBottomSheetResult<string>()
    const { data: pairs, isLoading } = useRampPairsQuery({ scope })
    const { accountBalances } = useAccountBalancesQuery(
        account ? [account] : [],
        scope,
    )
    const selectedAddress = account ? addressOn(account, scope) : undefined
    const [searchFilter, setSearchFilter] = useState('')

    const balanceMap = useMemo((): Map<string, Decimal> => {
        if (!selectedAddress) return new Map()
        const assetBalances =
            accountBalances.get(selectedAddress)?.assetBalances ?? []
        return new Map(assetBalances.map(item => [item.assetId, item.amount]))
    }, [accountBalances, selectedAddress])

    const tokens = useMemo((): RampToken[] => {
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

        return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    }, [pairs, variant, searchFilter])

    const assetIdOf = useCallback(
        (token: RampToken) => rampTokenAsset(token, scope)?.assetId ?? null,
        [scope],
    )

    const assetIds = useMemo(
        () =>
            tokens
                .map(assetIdOf)
                .filter((assetId): assetId is string => assetId !== null),
        [tokens, assetIdOf],
    )
    const { data: assets } = useAssetsQuery(assetIds, {
        fetchMissing: true,
        scope,
    })

    const items = useMemo(
        (): OnrampSelectableToken[] =>
            tokens.map(token => {
                const assetId = assetIdOf(token)
                return {
                    token,
                    // A token the account doesn't hold shows as unowned.
                    balance:
                        assetId === null
                            ? null
                            : (balanceMap.get(assetId) ?? null),
                    asset:
                        assetId === null ? null : (assets.get(assetId) ?? null),
                }
            }),
        [tokens, assetIdOf, balanceMap, assets],
    )

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
