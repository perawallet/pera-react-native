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
    useRampPairsQuery,
    useRampRegionQuery,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useCurrency } from '@perawallet/wallet-core-currencies'

export type OnrampSourceFilter = 'all' | 'fiat' | 'crypto'

// Collapse the fiat list to this many rows when no search/filter narrows it.
const DEFAULT_FIAT_LIMIT = 3

// A source token is FIAT when it carries a (non-empty) ISO country code — the
// ramp API exposes this via `extra.country_code` for fiat currencies (USD, EUR…)
// and never for crypto. Crypto tokens carry a blockchain `network` and no
// country code. Anything ambiguous (no country code) is treated as crypto.
const isFiatToken = (token: RampToken): boolean =>
    typeof token.countryCode === 'string' && token.countryCode.length > 0

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
    /**
     * Lower-cased symbols shared by more than one source token (e.g. USDC on
     * Solana and on Base) — those rows show a network sub-badge to disambiguate.
     */
    duplicatedSymbols: Set<string>
}

/**
 * Drives the "From" source-selection sheet: collects the distinct source tokens
 * across all ramp pairs, splits them into fiat/crypto groups, and applies the
 * search query + filter chip + collapsed-fiat state.
 */
export const useOnrampSourceSelection = (): UseOnrampSourceSelectionResult => {
    const { data: pairs, isLoading } = useRampPairsQuery()
    const { data: region } = useRampRegionQuery()
    const { preferredCurrency } = useCurrency()
    const [filter, setFilter] = useState<OnrampSourceFilter>('all')
    const [search, setSearch] = useState('')
    const [isFiatExpanded, setIsFiatExpanded] = useState(false)

    // Distinct source tokens (dedupe by id).
    const sourceTokens = useMemo(() => {
        const seen = new Set<string>()
        const result: RampToken[] = []
        for (const pair of pairs ?? []) {
            const token = pair.sourceToken
            if (!seen.has(token.id)) {
                seen.add(token.id)
                result.push(token)
            }
        }
        return result
    }, [pairs])

    // Symbols carried by more than one source token (same ticker, different
    // network) — those rows get a network sub-badge to tell them apart.
    const duplicatedSymbols = useMemo(() => {
        const counts = new Map<string, number>()
        for (const token of sourceTokens) {
            const key = token.symbol.toLowerCase()
            counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        return new Set(
            [...counts.entries()]
                .filter(([, count]) => count > 1)
                .map(([symbol]) => symbol),
        )
    }, [sourceTokens])

    const query = search.trim().toLowerCase()
    const matchesSearch = (token: RampToken) =>
        query === '' ||
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query)

    const fiatTokens = useMemo(
        () => sourceTokens.filter(t => isFiatToken(t) && matchesSearch(t)),
        // matchesSearch closes over `query`; tracking it covers search edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sourceTokens, query],
    )

    const cryptoTokens = useMemo(
        () => sourceTokens.filter(t => !isFiatToken(t) && matchesSearch(t)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sourceTokens, query],
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
                    t => t.countryCode?.toLowerCase() === regionCode,
                ),
            )
        }

        // 2. Then preferred display currency, USD, EUR — matched by symbol.
        for (const symbol of [preferredCurrency, 'USD', 'EUR'].map(s =>
            s.toLowerCase(),
        )) {
            pushToken(fiatTokens.find(t => t.symbol.toLowerCase() === symbol))
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
        duplicatedSymbols,
    }
}
