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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockListCurrencies } from '@perawallet/wallet-core-currencies/test-handlers'

// Integration tests opt out of the global package mocks so they exercise the
// real hook implementations end-to-end. RN/native runtime mocks (including
// the navigator stubs) remain in effect — running the real native-stack
// navigator under react-native-web + jsdom requires native-only APIs.
vi.unmock('@perawallet/wallet-core-currencies')
vi.unmock('@perawallet/wallet-core-assets')
vi.unmock('@perawallet/wallet-core-shared')

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { SettingsCurrencyScreen } from '@modules/settings/screens/SettingsCurrencyScreen/SettingsCurrencyScreen'
import { JPY_ONLY, USD_EUR_GBP } from './__fixtures__/currencies'

describe('Flow: Settings → Currency selection', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    // Default scenario for tests that don't override: list returns USD/EUR/GBP.
    beforeEach(() => {
        server.use(mockListCurrencies({ response: USD_EUR_GBP }))
    })

    it('Given the currencies endpoint returns USD, EUR, GBP, when the screen mounts, then all three plus ALGO are listed', async () => {
        renderWithNavigation(SettingsCurrencyScreen, 'SettingsCurrency')

        await waitFor(() => {
            expect(
                screen.getByTestId('settings_currency_item_usd'),
            ).toBeTruthy()
        })
        expect(screen.getByTestId('settings_currency_item_eur')).toBeTruthy()
        expect(screen.getByTestId('settings_currency_item_gbp')).toBeTruthy()
        // The hook prepends ALGO regardless of API response.
        expect(screen.getByTestId('settings_currency_item_algo')).toBeTruthy()
    })

    it('Given the list is loaded, when the user types "eur" in the search, then only Euro is shown', async () => {
        renderWithNavigation(SettingsCurrencyScreen, 'SettingsCurrency')

        await waitFor(() => screen.getByTestId('settings_currency_item_eur'))

        fireEvent.change(screen.getByTestId('settings_currency_search_input'), {
            target: { value: 'eur' },
        })

        await waitFor(() => {
            expect(
                screen.queryByTestId('settings_currency_item_usd'),
            ).toBeFalsy()
        })
        expect(screen.getByTestId('settings_currency_item_eur')).toBeTruthy()
        expect(screen.queryByTestId('settings_currency_item_gbp')).toBeFalsy()
        expect(screen.queryByTestId('settings_currency_item_algo')).toBeFalsy()
    })

    it('Given a custom handler returning only JPY, when the screen mounts, then JPY appears (alongside ALGO) and USD/EUR do not', async () => {
        // Per-test override of the default handler registered in beforeEach.
        server.use(mockListCurrencies({ response: JPY_ONLY }))

        renderWithNavigation(SettingsCurrencyScreen, 'SettingsCurrency')

        await waitFor(() => {
            expect(
                screen.getByTestId('settings_currency_item_jpy'),
            ).toBeTruthy()
        })
        expect(screen.queryByTestId('settings_currency_item_usd')).toBeFalsy()
        expect(screen.queryByTestId('settings_currency_item_eur')).toBeFalsy()
        // ALGO is always prepended.
        expect(screen.getByTestId('settings_currency_item_algo')).toBeTruthy()
    })
})
