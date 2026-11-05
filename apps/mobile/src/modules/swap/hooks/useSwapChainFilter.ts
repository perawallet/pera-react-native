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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AnalyticsMetadataKey, SwapEvent, trackEvent } from '@analytics'
import type { FilterOption } from '@components/FilterSelection'
import { useLanguage } from '@hooks/useLanguage'
import { toChainFilterOptions } from '@modules/assets'

export type UseSwapChainFilterParams = {
    chainIds: readonly ChainId[]
    /** The swap's own scope, reported when the All chip is picked. */
    scope: ChainScope
    variant: 'from' | 'to'
}

export type UseSwapChainFilterResult = {
    /** All, then one per chain; empty for fewer than two chains. */
    chainOptions: FilterOption<Nullable<ChainId>>[]
    /** Null on All. */
    selectedChainId: Nullable<ChainId>
    visibleChainIds: readonly ChainId[]
    handleSelectChain: (chainId: Nullable<ChainId>) => void
}

export const useSwapChainFilter = ({
    chainIds,
    scope,
    variant,
}: UseSwapChainFilterParams): UseSwapChainFilterResult => {
    const { t } = useLanguage()
    const [pickedChainId, setPickedChainId] = useState<Nullable<ChainId>>(null)
    const selectedChainId =
        pickedChainId !== null && chainIds.includes(pickedChainId)
            ? pickedChainId
            : null

    const chainOptions = useMemo(
        () =>
            toChainFilterOptions(chainIds, {
                allLabel: t('account_details.assets.network_filter_all'),
                testIDPrefix: `swap_${variant}_chain_filter`,
            }),
        [chainIds, t, variant],
    )

    const visibleChainIds = useMemo(
        () => (selectedChainId ? [selectedChainId] : chainIds),
        [selectedChainId, chainIds],
    )

    const handleSelectChain = useCallback(
        (chainId: Nullable<ChainId>) => {
            setPickedChainId(chainId)
            trackEvent(
                variant === 'from'
                    ? SwapEvent.SelectFromChainFilter
                    : SwapEvent.SelectToChainFilter,
                {
                    [AnalyticsMetadataKey.ChainId]: chainId ?? scope.chainId,
                },
            )
        },
        [scope.chainId, variant],
    )

    return { chainOptions, selectedChainId, visibleChainIds, handleSelectChain }
}
