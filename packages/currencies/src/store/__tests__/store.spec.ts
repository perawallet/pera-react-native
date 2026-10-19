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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getProvider } from '@perawallet/wallet-extension-provider'

// Stores register once, at import, and vitest clears mock calls before every
// test, so registrations are kept here rather than on a vi.fn().
const registeredStores: Parameters<
    typeof import('@perawallet/wallet-core-shared').registerStore
>[0][] = []

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: (entry: (typeof registeredStores)[number]) => {
            registeredStores.push(entry)
        },
        createPersistStorage: createMockPersistStorage,
    }
})

describe('CurrenciesStore', () => {
    beforeEach(async () => {
        const { useCurrenciesStore } = await import('../index')
        useCurrenciesStore.getState().resetState()
    })

    test('setPreferredCurrency updates the store', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('EUR')
        })

        expect(result.current.preferredCurrency).toBe('EUR')
    })

    test('setFallbackCurrency updates the store', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setFallbackCurrency('GBP')
        })

        expect(result.current.fallbackCurrency).toBe('GBP')
    })

    test('resetState restores the initial USD defaults', async () => {
        const { useCurrenciesStore } = await import('../index')
        const { result } = renderHook(() => useCurrenciesStore())

        act(() => {
            result.current.setPreferredCurrency('EUR')
            result.current.setFallbackCurrency('GBP')
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.preferredCurrency).toBe('USD')
        expect(result.current.fallbackCurrency).toBe('USD')
    })

    test('setPreferredCurrency moves ALGO to the stored fiat fallback', async () => {
        const { useCurrenciesStore } = await import('../index')
        act(() => {
            useCurrenciesStore.getState().setFallbackCurrency('EUR')
            useCurrenciesStore.getState().setPreferredCurrency('ALGO')
        })

        expect(useCurrenciesStore.getState()).toMatchObject({
            preferredCurrency: 'EUR',
            fallbackCurrency: 'ALGO',
        })
    })

    test('setCurrencyPreference moves ALGO to the given fiat fallback', async () => {
        const { useCurrenciesStore } = await import('../index')
        act(() => {
            useCurrenciesStore.getState().setCurrencyPreference({
                preferredCurrency: 'ALGO',
                fallbackCurrency: 'JPY',
            })
        })

        expect(useCurrenciesStore.getState()).toMatchObject({
            preferredCurrency: 'JPY',
            fallbackCurrency: 'ALGO',
        })
    })

    test('setCurrencyPreference writes a fiat preference as given', async () => {
        const { useCurrenciesStore } = await import('../index')
        act(() => {
            useCurrenciesStore.getState().setCurrencyPreference({
                preferredCurrency: 'AED',
                fallbackCurrency: 'ALGO',
            })
        })

        expect(useCurrenciesStore.getState()).toMatchObject({
            preferredCurrency: 'AED',
            fallbackCurrency: 'ALGO',
        })
    })

    test('registers clearStorage and resetState with the store registry', async () => {
        await import('../index')

        const registration = registeredStores.at(-1)!
        expect(registration?.name).toBe('currencies-store')

        const { useCurrenciesStore } = await import('../index')
        act(() => {
            useCurrenciesStore.getState().setPreferredCurrency('EUR')
        })

        act(() => registration.resetState())
        expect(useCurrenciesStore.getState().preferredCurrency).toBe('USD')
        expect(() => registration.clearStorage()).not.toThrow()
    })
})

describe('migrateCurrenciesState', () => {
    test.each([
        [
            'ALGO with a fiat fallback',
            { preferredCurrency: 'ALGO', fallbackCurrency: 'EUR' },
            { preferredCurrency: 'EUR', fallbackCurrency: 'ALGO' },
        ],
        [
            'ALGO with a USD fallback',
            { preferredCurrency: 'ALGO', fallbackCurrency: 'USD' },
            { preferredCurrency: 'USD', fallbackCurrency: 'ALGO' },
        ],
        [
            'a fiat preference',
            { preferredCurrency: 'GBP', fallbackCurrency: 'ALGO' },
            { preferredCurrency: 'GBP', fallbackCurrency: 'ALGO' },
        ],
        [
            'an empty blob',
            {},
            { preferredCurrency: 'USD', fallbackCurrency: 'USD' },
        ],
    ])(
        'moves a v1 blob holding %s to fiat',
        async (_label, v1State, expected) => {
            const { migrateCurrenciesState } = await import('../store')

            expect(migrateCurrenciesState(v1State, 1)).toEqual(expected)
        },
    )

    test('leaves v2 state unchanged', async () => {
        const { migrateCurrenciesState } = await import('../store')
        const v2State = { preferredCurrency: 'EUR', fallbackCurrency: 'ALGO' }

        expect(migrateCurrenciesState(structuredClone(v2State), 2)).toEqual(
            v2State,
        )
    })

    test('a v1 ALGO preference is fiat across two cold starts, saved by the first', async () => {
        getProvider().keyValueStorage.setItem(
            'currencies-store',
            JSON.stringify({
                state: { preferredCurrency: 'ALGO', fallbackCurrency: 'EUR' },
                version: 1,
            }),
        )

        const preferred: string[] = []
        const stored: unknown[] = []
        for (let start = 0; start < 2; start++) {
            vi.resetModules()
            const { useCurrenciesStore } = await import('../store')
            await useCurrenciesStore.persist.rehydrate()
            preferred.push(useCurrenciesStore.getState().preferredCurrency)
            stored.push(
                JSON.parse(
                    getProvider().keyValueStorage.getItem(
                        'currencies-store',
                    ) as string,
                ),
            )
        }

        expect(preferred).toEqual(['EUR', 'EUR'])
        expect(stored[0]).toEqual({
            state: { preferredCurrency: 'EUR', fallbackCurrency: 'ALGO' },
            version: 2,
        })
    })
})
