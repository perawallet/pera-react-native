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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useRampPairsQuery,
    useRampRegionQuery,
    type RampPair,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useCurrency } from '@perawallet/wallet-core-currencies'

import { useOnrampSourceSelection } from '../useOnrampSourceSelection'

vi.mock('@perawallet/wallet-core-onramp', () => ({
    useRampPairsQuery: vi.fn(),
    useRampRegionQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(),
}))

const mockPreferredCurrency = (currency: string) => {
    vi.mocked(useCurrency).mockReturnValue({
        preferredCurrency: currency,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
}

const mockRegion = (countryCode?: string) => {
    vi.mocked(useRampRegionQuery).mockReturnValue({
        data: countryCode ? { countryCode, countryName: countryCode } : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
}

const ALGO_TOKEN: RampToken = {
    id: 'ALGO',
    symbol: 'ALGO',
    name: 'Algorand',
    fractionDecimals: 6,
    logo: null,
    network: { id: 'ALGORAND', name: 'Algorand', logo: null },
    priceInUsd: null,
}

const token = (overrides: Partial<RampToken> & { id: string }): RampToken => ({
    ...ALGO_TOKEN,
    ...overrides,
})

const pair = (source: RampToken): RampPair => ({
    id: `pair-${source.id}`,
    sourceToken: source,
    destinationToken: ALGO_TOKEN,
    provider: { id: 'xo', paymentTypes: [], limits: null },
})

// Three fiat (countryCode) + two crypto source tokens, plus a duplicate USD
// pair to exercise dedupe.
const PAIRS: RampPair[] = [
    pair(
        token({
            id: 'USD',
            symbol: 'USD',
            name: 'US Dollar',
            countryCode: 'US',
        }),
    ),
    pair(token({ id: 'EUR', symbol: 'EUR', name: 'Euro', countryCode: 'EU' })),
    pair(token({ id: 'GBP', symbol: 'GBP', name: 'Pound', countryCode: 'GB' })),
    pair(token({ id: 'TRY', symbol: 'TRY', name: 'Lira', countryCode: 'TR' })),
    pair(
        token({
            id: 'BTC',
            symbol: 'BTC',
            name: 'Bitcoin',
            network: { id: 'BITCOIN', name: 'Bitcoin', logo: null },
        }),
    ),
    pair(
        token({
            id: 'USDC',
            symbol: 'USDC',
            name: 'USD Coin',
            network: { id: 'SOLANA', name: 'Solana', logo: null },
        }),
    ),
    pair(
        token({
            id: 'USD',
            symbol: 'USD',
            name: 'US Dollar',
            countryCode: 'US',
        }),
    ),
]

describe('useOnrampSourceSelection', () => {
    beforeEach(() => {
        vi.mocked(useRampPairsQuery).mockReturnValue({
            data: PAIRS,
            isLoading: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        mockPreferredCurrency('USD')
        mockRegion(undefined)
    })

    it('splits distinct source tokens into fiat and crypto by countryCode', () => {
        const { result } = renderHook(() => useOnrampSourceSelection())

        // Crypto: BTC + USDC (no countryCode). Fiat collapses to the
        // meaningful currencies only (preferred USD + EUR here).
        expect(result.current.cryptoTokens.map(t => t.id)).toEqual([
            'BTC',
            'USDC',
        ])
        expect(result.current.canExpandFiat).toBe(true)
        expect(result.current.fiatTokens).toHaveLength(2)
    })

    it('defaults the collapsed fiat list to the user currency, USD then EUR', () => {
        mockPreferredCurrency('GBP')
        const { result } = renderHook(() => useOnrampSourceSelection())

        // User currency (GBP) first, then USD, then EUR.
        expect(result.current.fiatTokens.map(t => t.id)).toEqual([
            'GBP',
            'USD',
            'EUR',
        ])
    })

    it('leads the collapsed fiat list with the region currency (by country code)', () => {
        // Region GB → GBP first, ahead of the USD display currency, then USD,
        // EUR (so a non-region currency like AED never takes a default slot).
        mockRegion('GB')
        const { result } = renderHook(() => useOnrampSourceSelection())

        expect(result.current.fiatTokens.map(t => t.id)).toEqual([
            'GBP',
            'USD',
            'EUR',
        ])
    })

    it('shows only the meaningful currencies — no random filler row', () => {
        // User currency USD → exactly USD + EUR, never a padded third row.
        const { result } = renderHook(() => useOnrampSourceSelection())

        expect(result.current.fiatTokens.map(t => t.id)).toEqual(['USD', 'EUR'])
        // The collapse still hides rows, so the "See all" toggle stays.
        expect(result.current.canExpandFiat).toBe(true)
    })

    it('expands the full fiat list when the toggle fires', () => {
        const { result } = renderHook(() => useOnrampSourceSelection())

        act(() => result.current.expandFiat())

        expect(result.current.fiatTokens.map(t => t.id)).toEqual([
            'USD',
            'EUR',
            'GBP',
            'TRY',
        ])
        expect(result.current.canExpandFiat).toBe(false)
    })

    it('filters by name/symbol across both groups when searching', () => {
        const { result } = renderHook(() => useOnrampSourceSelection())

        act(() => result.current.setSearch('usd'))

        // "usd" matches the fiat "US Dollar" and the crypto "USD Coin".
        expect(result.current.fiatTokens.map(t => t.id)).toEqual(['USD'])
        expect(result.current.cryptoTokens.map(t => t.id)).toEqual(['USDC'])
        // Searching disables the fiat collapse.
        expect(result.current.canExpandFiat).toBe(false)
    })
})
