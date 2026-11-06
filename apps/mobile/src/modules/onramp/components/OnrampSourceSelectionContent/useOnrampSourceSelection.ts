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

import { useMemo, useState } from 'react'
import {
    useOnramp,
    useRampRegionQuery,
    useRampSourcesQuery,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useLanguage } from '@hooks/useLanguage'

export type OnrampSourceFilter = 'all' | 'fiat' | 'crypto'

// Collapse the fiat list to this many rows when no search/filter narrows it.
const DEFAULT_FIAT_LIMIT = 3

const isFiatToken = (token: RampToken): boolean => token.kind === 'fiat'

type UseOnrampSourceSelectionResult = {
    isLoading: boolean
    filter: OnrampSourceFilter
    setFilter: (filter: OnrampSourceFilter) => void
    search: string
    setSearch: (search: string) => void
    isFiatExpanded: boolean
    expandFiat: () => void
    /** Whether the "See all fiat currencies" toggle should be shown. */
    canExpandFiat: boolean
    fiatTokens: RampToken[]
    cryptoTokens: RampToken[]
    isFiat: (token: RampToken) => boolean
    /** The source chain the crypto list is narrowed to, as the router names it; null for all. */
    chainFilter: Nullable<string>
    setChainFilter: (network: Nullable<string>) => void
    /** All, then one chip per source chain; empty when crypto comes from fewer than two. */
    chainOptions: FilterOption<Nullable<string>>[]
    /** Chips show only under the Crypto filter, and only for two or more chains. */
    isChainFilterVisible: boolean
}

const chainTestIdOf = (network: string): string =>
    `onramp_source_chain_${network.toLowerCase().replace(/\s+/g, '_')}`

/**
 * Drives the "From" source-selection sheet: reads the selected destination's
 * sources, splits them into fiat/crypto groups, and applies the search query +
 * filter chip + collapsed-fiat state.
 */
export const useOnrampSourceSelection = (): UseOnrampSourceSelectionResult => {
    const { t } = useLanguage()
    const { scope } = useOnrampAccount()
    const { selectedDestinationTokenId } = useOnramp()
    const { data: sourceTokens, isLoading } = useRampSourcesQuery({
        scope,
        destinationId: selectedDestinationTokenId,
    })
    const { data: region } = useRampRegionQuery({ scope })
    // The preferred currency doesn't depend on the ramp's chain; a null ramp
    // scope just means Fund can't buy onto this account.
    const selectedScope = useHomeChainScope()
    const { preferredCurrency } = useCurrency(selectedScope)
    const [filter, setFilter] = useState<OnrampSourceFilter>('all')
    const [search, setSearch] = useState('')
    const [isFiatExpanded, setIsFiatExpanded] = useState(false)
    const [chainFilter, setChainFilter] = useState<Nullable<string>>(null)

    // First-seen order, so the chips follow the router's listing.
    const sourceNetworks = useMemo(() => {
        const networks = new Set<string>()
        for (const token of sourceTokens) {
            if (!isFiatToken(token) && token.network.name !== '') {
                networks.add(token.network.name)
            }
        }
        return [...networks]
    }, [sourceTokens])

    const chainOptions = useMemo((): FilterOption<Nullable<string>>[] => {
        if (sourceNetworks.length < 2) return []
        return [
            {
                value: null,
                label: t('onramp.source_selection.chain_all'),
                testID: 'onramp_source_chain_all',
            },
            ...sourceNetworks.map(network => ({
                value: network,
                label: network,
                testID: chainTestIdOf(network),
            })),
        ]
    }, [sourceNetworks, t])

    // The chips only show under the Crypto filter, so a pick there doesn't
    // silently narrow the All view.
    const isChainFilterVisible = filter === 'crypto' && chainOptions.length > 0
    const activeChain = isChainFilterVisible ? chainFilter : null

    const query = search.trim().toLowerCase()
    const matchesSearch = (token: RampToken) =>
        query === '' ||
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query)

    const fiatTokens = useMemo(
        () =>
            sourceTokens.filter(
                token => isFiatToken(token) && matchesSearch(token),
            ),
        // matchesSearch closes over `query`; tracking it covers search edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sourceTokens, query],
    )

    const cryptoTokens = useMemo(
        () =>
            sourceTokens.filter(
                token =>
                    !isFiatToken(token) &&
                    matchesSearch(token) &&
                    (activeChain === null ||
                        token.network.name === activeChain),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sourceTokens, query, activeChain],
    )

    // Collapse fiat only when not narrowing (no search, "all" or "fiat"
    // filter) and the user hasn't expanded the list.
    const isNarrowing = query !== '' || filter === 'crypto'
    const isFiatCollapsed = !isNarrowing && !isFiatExpanded

    // Default (collapsed) fiat ordering: the user's region currency first
    // (matched by ISO country code, e.g. GB → GBP), then the preferred display
    // currency, then USD and EUR. Only these meaningful currencies are shown —
    // remaining slots are NOT padded with arbitrary currencies (a USD/EUR user
    // sees exactly those two, not a random third).
    const visibleFiatTokens = useMemo(() => {
        if (!isFiatCollapsed) return fiatTokens

        const prioritised: RampToken[] = []
        const taken = new Set<string>()
        const pushToken = (token?: RampToken) => {
            if (
                token &&
                !taken.has(token.id) &&
                prioritised.length < DEFAULT_FIAT_LIMIT
            ) {
                prioritised.push(token)
                taken.add(token.id)
            }
        }

        // 1. Region currency, by country code (the fiat token's `countryCode`
        // mirrors the region's, e.g. both 'GB' for GBP).
        const regionCode = region?.countryCode.toLowerCase()
        if (regionCode) {
            pushToken(
                fiatTokens.find(
                    token => token.countryCode?.toLowerCase() === regionCode,
                ),
            )
        }

        // 2. Then preferred display currency, USD, EUR — matched by symbol.
        for (const symbol of [preferredCurrency, 'USD', 'EUR'].map(s =>
            s.toLowerCase(),
        )) {
            pushToken(
                fiatTokens.find(token => token.symbol.toLowerCase() === symbol),
            )
        }

        // None of the priority currencies are available (exotic region with
        // no USD/EUR pairs) — fall back to the first rows rather than an
        // empty section with only a "See all" toggle.
        if (prioritised.length === 0) {
            return fiatTokens.slice(0, DEFAULT_FIAT_LIMIT)
        }

        return prioritised
    }, [isFiatCollapsed, fiatTokens, preferredCurrency, region])

    // Offer "See all fiat currencies" whenever the collapse actually hides
    // rows (including when fewer than the limit are shown).
    const canExpandFiat =
        isFiatCollapsed && fiatTokens.length > visibleFiatTokens.length

    return {
        isLoading,
        filter,
        setFilter,
        search,
        setSearch,
        isFiatExpanded,
        expandFiat: () => setIsFiatExpanded(true),
        canExpandFiat,
        fiatTokens: visibleFiatTokens,
        cryptoTokens,
        isFiat: isFiatToken,
        chainFilter,
        setChainFilter,
        chainOptions,
        isChainFilterVisible,
    }
}
