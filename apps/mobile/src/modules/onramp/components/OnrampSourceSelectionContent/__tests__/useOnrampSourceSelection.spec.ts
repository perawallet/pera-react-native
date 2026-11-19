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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    useRampRegionQuery,
    useRampSourcesQuery,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { makeDepositToken, makeFiatToken } from '@test-utils/rampFixtures'

import { useOnrampSourceSelection } from '../useOnrampSourceSelection'

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: () => ({
        account: null,
        scope: { chainId: 'algorand', networkId: 'mainnet' },
        address: 'ADDR',
    }),
}))

vi.mock('@perawallet/wallet-core-onramp', () => ({
    useOnramp: () => ({ selectedDestinationTokenId: 'dest-1' }),
    useRampSourcesQuery: vi.fn(),
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

const fiat = (symbol: string, name: string, countryCode: string): RampToken =>
    makeFiatToken(symbol, { name, countryCode })

// Four fiat + two deposit-coin sources.
const SOURCES: RampToken[] = [
    fiat('USD', 'US Dollar', 'US'),
    fiat('EUR', 'Euro', 'EU'),
    fiat('GBP', 'Pound', 'GB'),
    fiat('TRY', 'Lira', 'TR'),
    makeDepositToken('BTC', { id: 'btc', name: 'Bitcoin' }),
    makeDepositToken('USDC', {
        id: 'usdc-sol',
        name: 'USD Coin',
        network: { name: 'Solana', logo: null },
    }),
]

describe('useOnrampSourceSelection', () => {
    beforeEach(() => {
        vi.mocked(useRampSourcesQuery).mockReturnValue({
            data: SOURCES,
            isLoading: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        mockPreferredCurrency('USD')
        mockRegion(undefined)
    })

    it("reads the selected destination's sources", () => {
        renderHook(() => useOnrampSourceSelection())

        expect(useRampSourcesQuery).toHaveBeenCalledWith(
            expect.objectContaining({ destinationId: 'dest-1' }),
        )
    })

    it('splits the source tokens into fiat and crypto by kind', () => {
        const { result } = renderHook(() => useOnrampSourceSelection())

        // Crypto: BTC + USDC (deposit kind). Fiat collapses to the
        // meaningful currencies only (preferred USD + EUR here).
        expect(result.current.cryptoTokens.map(t => t.symbol)).toEqual([
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
        expect(result.current.fiatTokens.map(t => t.symbol)).toEqual([
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

        expect(result.current.fiatTokens.map(t => t.symbol)).toEqual([
            'GBP',
            'USD',
            'EUR',
        ])
    })

    it('shows only the meaningful currencies — no random filler row', () => {
        // User currency USD → exactly USD + EUR, never a padded third row.
        const { result } = renderHook(() => useOnrampSourceSelection())

        expect(result.current.fiatTokens.map(t => t.symbol)).toEqual([
            'USD',
            'EUR',
        ])
        // The collapse still hides rows, so the "See all" toggle stays.
        expect(result.current.canExpandFiat).toBe(true)
    })

    it('expands the full fiat list when the toggle fires', () => {
        const { result } = renderHook(() => useOnrampSourceSelection())

        act(() => result.current.expandFiat())

        expect(result.current.fiatTokens.map(t => t.symbol)).toEqual([
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
        expect(result.current.fiatTokens.map(t => t.symbol)).toEqual(['USD'])
        expect(result.current.cryptoTokens.map(t => t.symbol)).toEqual(['USDC'])
        // Searching disables the fiat collapse.
        expect(result.current.canExpandFiat).toBe(false)
    })

    it('marks only fiat-kind tokens as fiat', () => {
        const { result } = renderHook(() => useOnrampSourceSelection())

        expect(result.current.isFiat(SOURCES[0])).toBe(true)
        expect(result.current.isFiat(SOURCES[4])).toBe(false)
    })

    describe('source chains', () => {
        const USDC_BASE = makeDepositToken('USDC', {
            id: 'usdc-base',
            name: 'USD Coin',
            network: { name: 'Base Mainnet', logo: null },
        })

        const serve = (tokens: RampToken[]) =>
            vi.mocked(useRampSourcesQuery).mockReturnValue({
                data: tokens,
                isLoading: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

        it('offers All, then one chip per source chain in listing order', () => {
            serve([...SOURCES, USDC_BASE])
            const { result } = renderHook(() => useOnrampSourceSelection())

            expect(
                result.current.chainOptions.map(option => [
                    option.value,
                    option.testID,
                ]),
            ).toEqual([
                [null, 'onramp_source_chain_all'],
                ['Bitcoin', 'onramp_source_chain_bitcoin'],
                ['Solana', 'onramp_source_chain_solana'],
                ['Base Mainnet', 'onramp_source_chain_base_mainnet'],
            ])
            expect(result.current.chainOptions[0].label).toBe(
                'onramp.source_selection.chain_all',
            )
        })

        it("draws each chain chip with the wallet's icon, else the router's logo, else its initials", () => {
            const ETH_BASE = makeDepositToken('ETH', {
                id: 'eth-base',
                name: 'Ether',
                network: {
                    name: 'Base',
                    logo: null,
                    chainId: 'base' as ChainId,
                },
            })
            const USDC_TRON = makeDepositToken('USDC', {
                id: 'usdc-tron',
                name: 'USD Coin',
                network: { name: 'Tron', logo: 'https://logo.test/trx.png' },
            })
            serve([...SOURCES, ETH_BASE, USDC_TRON])
            const { result } = renderHook(() => useOnrampSourceSelection())
            const iconOf = (value: string | null) =>
                result.current.chainOptions.find(o => o.value === value)
                    ?.renderIcon

            expect(iconOf(null)).toBeUndefined()
            // Bitcoin carries neither a chain id nor a logo here.
            expect(iconOf('Bitcoin')?.(16)).toMatchObject({
                props: { name: 'Bitcoin', size: 16 },
            })
            expect(iconOf('Base')?.(16)).toMatchObject({
                props: { chainId: 'base', size: 16 },
            })
            expect(iconOf('Tron')?.(16)).toMatchObject({
                props: { logoUrl: 'https://logo.test/trx.png', size: 16 },
            })
        })

        it("takes a network's art from a later coin when its first has none, keeping its place", () => {
            const USDC_SOL_LOGO = makeDepositToken('USDT', {
                id: 'usdt-sol',
                name: 'Tether',
                network: { name: 'Solana', logo: 'https://logo.test/sol.png' },
            })
            serve([...SOURCES, USDC_SOL_LOGO])
            const { result } = renderHook(() => useOnrampSourceSelection())
            const solana = result.current.chainOptions.find(
                o => o.value === 'Solana',
            )

            expect(result.current.chainOptions.map(o => o.value)).toEqual([
                null,
                'Bitcoin',
                'Solana',
            ])
            expect(solana?.renderIcon?.(16)).toMatchObject({
                props: { logoUrl: 'https://logo.test/sol.png' },
            })
        })

        it('shows the chips under the Crypto filter only', () => {
            serve([...SOURCES, USDC_BASE])
            const { result } = renderHook(() => useOnrampSourceSelection())
            expect(result.current.isChainFilterVisible).toBe(false)

            act(() => result.current.setFilter('crypto'))

            expect(result.current.isChainFilterVisible).toBe(true)
        })

        it('offers no chips when crypto comes from a single chain', () => {
            serve(SOURCES.filter(token => token.id !== 'usdc-sol'))
            const { result } = renderHook(() => useOnrampSourceSelection())

            expect(result.current.chainOptions).toEqual([])
        })

        it('narrows the crypto list to the chosen chain under the Crypto filter', () => {
            const { result } = renderHook(() => useOnrampSourceSelection())

            act(() => {
                result.current.setFilter('crypto')
                result.current.setChainFilter('Solana')
            })

            expect(result.current.cryptoTokens.map(t => t.id)).toEqual([
                'usdc-sol',
            ])
        })

        it('ignores a chosen chain outside the Crypto filter', () => {
            const { result } = renderHook(() => useOnrampSourceSelection())

            act(() => {
                result.current.setFilter('crypto')
                result.current.setChainFilter('Solana')
            })
            act(() => result.current.setFilter('all'))

            expect(result.current.cryptoTokens.map(t => t.id)).toEqual([
                'btc',
                'usdc-sol',
            ])
        })

        it('applies the search and the chain together', () => {
            serve([...SOURCES, USDC_BASE])
            const { result } = renderHook(() => useOnrampSourceSelection())

            act(() => {
                result.current.setFilter('crypto')
                result.current.setChainFilter('Base Mainnet')
                result.current.setSearch('usd')
            })

            expect(result.current.cryptoTokens.map(t => t.id)).toEqual([
                'usdc-base',
            ])
        })
    })
})
