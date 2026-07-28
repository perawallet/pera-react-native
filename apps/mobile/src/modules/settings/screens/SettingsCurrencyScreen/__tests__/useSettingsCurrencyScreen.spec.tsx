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

import type { ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ALGO_ASSET_NAME } from '@perawallet/wallet-core-shared'
import { useNetworkStatusStore } from '@modules/network'
import { useSettingsCurrencyScreen } from '../useSettingsCurrencyScreen'

const mockSetPreferredCurrency = vi.hoisted(() => vi.fn())
const mockSetFallbackCurrency = vi.hoisted(() => vi.fn())
const mockUseCurrency = vi.hoisted(() => vi.fn())
const mockUseCurrenciesQuery = vi.hoisted(() => vi.fn())
const mockInvalidateAssetPrices = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-currencies', () => ({
    USD_CURRENCY_ID: 'USD',
    useCurrency: mockUseCurrency,
    useCurrenciesQuery: mockUseCurrenciesQuery,
    currencyQueryKeys: {
        price: (network: string, preferredFiatCurrency: string) => [
            'currencies',
            { network, preferredFiatCurrency },
        ],
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useInvalidateAssetPrices: () => ({
        invalidateAssetPrices: mockInvalidateAssetPrices,
    }),
}))

let queryClient: QueryClient

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const renderScreenHook = () =>
    renderHook(() => useSettingsCurrencyScreen(), { wrapper })

const setPreferredCurrency = (preferredCurrency: string) => {
    mockUseCurrency.mockReturnValue({
        setPreferredCurrency: mockSetPreferredCurrency,
        setFallbackCurrency: mockSetFallbackCurrency,
        fallbackCurrency: 'USD',
        preferredCurrency,
    })
}

const seedCachedRate = (currencyId: string) => {
    queryClient.setQueryData(
        [
            'currencies',
            { network: 'mainnet', preferredFiatCurrency: currencyId },
        ],
        { id: currencyId, usdPrice: '1.1' },
    )
}

describe('useSettingsCurrencyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        useNetworkStatusStore.getState().setHasInternet(true)
        setPreferredCurrency('USD')
        mockUseCurrenciesQuery.mockReturnValue({ data: [] })
    })

    afterEach(() => {
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    it('sets ALGO as preferred and USD as the secondary currency when ALGO is selected', () => {
        const { result } = renderScreenHook()

        result.current.setCurrency({ id: 'ALGO', name: 'Algo' } as never)

        expect(mockSetPreferredCurrency).toHaveBeenCalledWith('ALGO')
        expect(mockSetFallbackCurrency).toHaveBeenCalledWith('USD')
    })

    it('sets ALGO as the secondary currency when a fiat currency is selected', () => {
        const { result } = renderScreenHook()

        result.current.setCurrency({ id: 'AED', name: 'Dirham' } as never)

        expect(mockSetPreferredCurrency).toHaveBeenCalledWith('AED')
        expect(mockSetFallbackCurrency).toHaveBeenCalledWith(ALGO_ASSET_NAME)
    })

    describe('offline rate notice', () => {
        it('stays hidden while online even with no cached rate', () => {
            setPreferredCurrency('JPY')

            const { result } = renderScreenHook()

            expect(result.current.isRateUnavailableOffline).toBe(false)
        })

        it('stays hidden offline when the rate is cached', () => {
            setPreferredCurrency('JPY')
            seedCachedRate('JPY')
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderScreenHook()

            expect(result.current.isRateUnavailableOffline).toBe(false)
        })

        it('stays hidden offline for USD, which needs no rate', () => {
            setPreferredCurrency('USD')
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderScreenHook()

            expect(result.current.isRateUnavailableOffline).toBe(false)
        })

        it('stays hidden offline for ALGO, whose price is DB-backed', () => {
            setPreferredCurrency(ALGO_ASSET_NAME)
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderScreenHook()

            expect(result.current.isRateUnavailableOffline).toBe(false)
        })

        it('shows offline when the selected fiat rate is uncached', () => {
            setPreferredCurrency('JPY')
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderScreenHook()

            expect(result.current.isRateUnavailableOffline).toBe(true)
        })
    })

    it('skips the price invalidation while offline', () => {
        useNetworkStatusStore.getState().setHasInternet(false)

        const { result } = renderScreenHook()

        result.current.setCurrency({ id: 'AED', name: 'Dirham' } as never)

        expect(mockSetPreferredCurrency).toHaveBeenCalledWith('AED')
        expect(mockInvalidateAssetPrices).not.toHaveBeenCalled()
    })

    it('invalidates prices when online', () => {
        const { result } = renderScreenHook()

        result.current.setCurrency({ id: 'AED', name: 'Dirham' } as never)

        expect(mockInvalidateAssetPrices).toHaveBeenCalledTimes(1)
    })
})
