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
    useOnramp,
    useRampDestinationsQuery,
    useRampSourcesQuery,
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
    const { selectedDestinationTokenId } = useOnramp()
    // Both queries are hooks, so each runs; the one the variant doesn't list stays idle.
    const destinationsQuery = useRampDestinationsQuery({
        scope,
        enabled: variant === 'destination',
    })
    const sourcesQuery = useRampSourcesQuery({
        scope,
        destinationId: selectedDestinationTokenId,
        enabled: variant === 'source',
    })
    const { data: listed, isLoading } =
        variant === 'source' ? sourcesQuery : destinationsQuery
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
        const term = searchFilter.toLowerCase().trim()
        const filtered = term
            ? listed.filter(
                  token =>
                      token.name.toLowerCase().includes(term) ||
                      token.symbol.toLowerCase().includes(term),
              )
            : listed

        return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    }, [listed, searchFilter])

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
    const { data: assets } = useAssetsQuery(scope, assetIds, {
        fetchMissing: true,
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
