/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand'
import { createCurrenciesSlice } from '../store'
import type { CurrenciesSlice } from '../store'

describe('services/currencies/store', () => {
    let store: any

    beforeEach(() => {
        store = createStore<CurrenciesSlice>(createCurrenciesSlice)
    })

    describe('createCurrenciesSlice', () => {
        it('initializes with USD as default preferred currency', () => {
            const state = store.getState()
            expect(state.preferredCurrency).toBe('USD')
        })

        it('provides setPreferredCurrency function', () => {
            const state = store.getState()
            expect(typeof state.setPreferredCurrency).toBe('function')
        })

        it('updates preferred currency when setPreferredCurrency is called', () => {
            store.getState().setPreferredCurrency('EUR')

            const updatedState = store.getState()
            expect(updatedState.preferredCurrency).toBe('EUR')
        })

        it('allows setting currency to different values', () => {
            const currencies = ['GBP', 'JPY', 'CAD', 'AUD']

            currencies.forEach(currency => {
                store.getState().setPreferredCurrency(currency)
                expect(store.getState().preferredCurrency).toBe(currency)
            })
        })

        it('persists currency changes across multiple calls', () => {
            store.getState().setPreferredCurrency('EUR')
            expect(store.getState().preferredCurrency).toBe('EUR')

            store.getState().setPreferredCurrency('GBP')
            expect(store.getState().preferredCurrency).toBe('GBP')

            store.getState().setPreferredCurrency('USD')
            expect(store.getState().preferredCurrency).toBe('USD')
        })
    })

    describe('partializeCurrenciesSlice', () => {
        it('returns only preferredCurrency for persistence', async () => {
            const state: CurrenciesSlice = {
                preferredCurrency: 'EUR',
                setPreferredCurrency: vi.fn(),
            }

            const { partializeCurrenciesSlice } = await import('../store')
            const partialized = partializeCurrenciesSlice(state)

            expect(partialized).toEqual({
                preferredCurrency: 'EUR',
            })
            expect(partialized).not.toHaveProperty('setPreferredCurrency')
        })

        it('handles different currency values', async () => {
            const currencies = ['USD', 'EUR', 'GBP', 'JPY']

            const { partializeCurrenciesSlice } = await import('../store')

            currencies.forEach(currency => {
                const state: CurrenciesSlice = {
                    preferredCurrency: currency,
                    setPreferredCurrency: vi.fn(),
                }

                const partialized = partializeCurrenciesSlice(state)
                expect(partialized.preferredCurrency).toBe(currency)
            })
        })
    })
})
