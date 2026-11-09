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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    rampTokenAsset,
    useOnrampDestinationChains,
    useRampDestinationsQuery,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { toChainFilterOptions } from '@modules/assets'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'

export type OnrampSelectableToken = {
    token: RampToken
    balance: Nullable<Decimal>
    /** The asset the token arrives as on the account's chain, once loaded. */
    asset: Nullable<PeraAsset>
}

/** A picked token with the chain it is bought onto. */
export type OnrampDestinationPick = {
    chainId: ChainId
    tokenId: string
}

type UseOnrampPairSelectionContentParams = {
    /** Fund's own scope; the list opens on its chain. */
    scope: ChainScope
}

type UseOnrampPairSelectionContentResult = {
    items: OnrampSelectableToken[]
    searchFilter: string
    setSearchFilter: (value: string) => void
    isLoading: boolean
    /** The scope the listed tokens are bought onto. */
    listScope: ChainScope
    /** One chip per chain the account can be funded on; empty for fewer than two. */
    chainOptions: FilterOption<Nullable<ChainId>>[]
    selectedChainId: ChainId
    handleSelectChain: (chainId: Nullable<ChainId>) => void
    handleTokenSelected: (token: RampToken) => void
}

export const useOnrampPairSelectionContent = ({
    scope,
}: UseOnrampPairSelectionContentParams): UseOnrampPairSelectionContentResult => {
    const { account } = useOnrampAccount()
    const { resolve } = useBottomSheetResult<OnrampDestinationPick>()
    const destinationChains = useOnrampDestinationChains(account)
    const [pickedChainId, setPickedChainId] = useState<Nullable<ChainId>>(null)

    // Fund's own chain leads when the account cannot sign on it, so the sheet
    // still opens on the chain Fund is on.
    const chainIds = useMemo((): ChainId[] => {
        if (destinationChains.length === 0) return []
        return destinationChains.includes(scope.chainId)
            ? destinationChains
            : [scope.chainId, ...destinationChains]
    }, [destinationChains, scope.chainId])
    const selectedChainId =
        pickedChainId !== null && chainIds.includes(pickedChainId)
            ? pickedChainId
            : scope.chainId
    const listScope = useSelectedScope(selectedChainId)

    const chainOptions = useMemo(
        () =>
            toChainFilterOptions(chainIds, {
                testIDPrefix: 'onramp_destination_chain',
            }),
        [chainIds],
    )

    const { data: listed, isLoading } = useRampDestinationsQuery({
        scope: listScope,
    })
    const { accountBalances } = useAccountBalancesQuery(
        account ? [account] : [],
        listScope,
    )
    const selectedAddress = account ? addressOn(account, listScope) : undefined
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
        (token: RampToken) => rampTokenAsset(token, listScope)?.assetId ?? null,
        [listScope],
    )

    // From the whole list, not the search result: the query is keyed on its ids,
    // so a keystroke would otherwise start a new fetch for every filtered set.
    const assetIds = useMemo(
        () =>
            listed
                .map(assetIdOf)
                .filter((assetId): assetId is string => assetId !== null),
        [listed, assetIdOf],
    )
    const { data: assets } = useAssetsQuery(listScope, assetIds, {
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

    const handleSelectChain = useCallback((chainId: Nullable<ChainId>) => {
        if (chainId !== null) setPickedChainId(chainId)
    }, [])

    const handleTokenSelected = useCallback(
        (token: RampToken) => {
            resolve({ chainId: listScope.chainId, tokenId: token.id })
        },
        [resolve, listScope.chainId],
    )

    return {
        items,
        searchFilter,
        setSearchFilter,
        isLoading,
        listScope,
        chainOptions,
        selectedChainId,
        handleSelectChain,
        handleTokenSelected,
    }
}
