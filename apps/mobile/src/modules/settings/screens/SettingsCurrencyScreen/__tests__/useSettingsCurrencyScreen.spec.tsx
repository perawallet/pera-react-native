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

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import {
    createQueryClientWrapper,
    createTestQueryClient,
} from '@test-utils/render'
import {
    ALGO_ASSET_NAME,
    IntegrityRequiredError,
} from '@perawallet/wallet-core-shared'
import { useNetworkStatusStore } from '@modules/network'
import { useSettingsCurrencyScreen } from '../useSettingsCurrencyScreen'

const mockSetCurrencyPreference = vi.hoisted(() => vi.fn())
const mockUseCurrency = vi.hoisted(() => vi.fn())
const mockUseCurrenciesQuery = vi.hoisted(() => vi.fn())
const mockInvalidateAssetPrices = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-currencies', () => ({
    USD_CURRENCY_ID: 'USD',
    useCurrency: mockUseCurrency,
    useCurrenciesQuery: mockUseCurrenciesQuery,
    currencyQueryKeys: {
        price: (deployment: string, preferredFiatCurrency: string) => [
            'currencies',
            { deployment, preferredFiatCurrency },
        ],
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: (chainId: string) => ({
        chainId,
        networkId: 'mainnet',
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useInvalidateAssetPrices: () => ({
        invalidateAssetPrices: mockInvalidateAssetPrices,
    }),
}))

let queryClient: QueryClient

const renderScreenHook = () =>
    renderHook(() => useSettingsCurrencyScreen(), {
        wrapper: createQueryClientWrapper(queryClient),
    })

const setPreferredCurrency = (preferredCurrency: string) => {
    mockUseCurrency.mockReturnValue({
        setCurrencyPreference: mockSetCurrencyPreference,
        fallbackCurrency: 'ALGO',
        preferredCurrency,
    })
}

const seedCachedRate = (currencyId: string) => {
    queryClient.setQueryData(
        [
            'currencies',
            { deployment: 'live', preferredFiatCurrency: currencyId },
        ],
        { id: currencyId, usdPrice: '1.1' },
    )
}

describe('useSettingsCurrencyScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = createTestQueryClient()
        useNetworkStatusStore.getState().setHasInternet(true)
        setPreferredCurrency('USD')
        mockUseCurrenciesQuery.mockReturnValue({
            data: [],
            isPaused: false,
            isError: false,
            refetch: vi.fn(),
        })
    })

    afterEach(() => {
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    it('offers the fiat list, narrowed by the search', () => {
        const currencies = [
            { id: 'EUR', name: 'Euro', symbol: '€' },
            { id: 'JPY', name: 'Japanese Yen', symbol: '¥' },
        ]
        mockUseCurrenciesQuery.mockReturnValue({
            data: currencies,
            isPaused: false,
            isError: false,
            refetch: vi.fn(),
        })
        const { result } = renderScreenHook()

        expect(result.current.filteredData).toEqual(currencies)

        act(() => result.current.setSearch('yen'))

        expect(result.current.filteredData).toEqual([currencies[1]])
    })

    it('writes the selected fiat with ALGO as the secondary currency', () => {
        const { result } = renderScreenHook()

        result.current.setCurrency({ id: 'AED', name: 'Dirham' } as never)

        expect(mockSetCurrencyPreference).toHaveBeenCalledWith({
            preferredCurrency: 'AED',
            fallbackCurrency: ALGO_ASSET_NAME,
        })
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

        expect(mockSetCurrencyPreference).toHaveBeenCalledWith({
            preferredCurrency: 'AED',
            fallbackCurrency: ALGO_ASSET_NAME,
        })
        expect(mockInvalidateAssetPrices).not.toHaveBeenCalled()
    })

    it('invalidates prices when online', () => {
        const { result } = renderScreenHook()

        result.current.setCurrency({ id: 'AED', name: 'Dirham' } as never)

        expect(mockInvalidateAssetPrices).toHaveBeenCalledTimes(1)
    })

    describe('currency list failure', () => {
        const mockFailedQuery = (refetch = vi.fn(), error?: Error) => {
            mockUseCurrenciesQuery.mockReturnValue({
                data: undefined,
                isPaused: false,
                isError: true,
                error,
                refetch,
            })
            return refetch
        }

        it('flags a refusal for want of an integrity token', () => {
            mockFailedQuery(
                vi.fn(),
                new IntegrityRequiredError({
                    code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                    status: 403,
                    hadToken: false,
                }),
            )

            const { result } = renderScreenHook()

            expect(result.current.isIntegrityBlocked).toBe(true)
        })

        it('does not flag any other failure as an integrity refusal', () => {
            mockFailedQuery(vi.fn(), new Error('boom'))

            const { result } = renderScreenHook()

            expect(result.current.isIntegrityBlocked).toBe(false)
        })

        it('reports an error while online and retries via refetch', () => {
            const refetch = mockFailedQuery()

            const { result } = renderScreenHook()
            result.current.refetch()

            expect(result.current.isError).toBe(true)
            expect(result.current.isOffline).toBe(false)
            expect(refetch).toHaveBeenCalledTimes(1)
        })

        it('reports offline when the failure happens without internet', () => {
            mockFailedQuery()
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderScreenHook()

            expect(result.current.isOffline).toBe(true)
        })
    })
})
