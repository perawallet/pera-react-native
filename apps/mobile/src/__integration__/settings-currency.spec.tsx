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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { getPeraDeploymentConfig } from '@perawallet/wallet-core-config'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { mockListCurrencies } from '@perawallet/wallet-core-currencies/test-handlers'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { SettingsCurrencyScreen } from '@modules/settings/screens/SettingsCurrencyScreen/SettingsCurrencyScreen'
import { JPY_ONLY, USD_EUR_GBP } from './__fixtures__/currencies'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

// The "integration" Vitest project's setup file opts out of the global
// @perawallet/wallet-core-* mocks — see apps/mobile/vitest.integration-setup.ts.

describe('Flow: Settings → Currency selection', () => {
    // Default scenario for tests that don't override: list returns USD/EUR/GBP.
    beforeEach(() => {
        server.use(mockListCurrencies({ response: USD_EUR_GBP }))
    })

    it('Given the currencies endpoint returns USD, EUR, GBP, when the screen mounts, then those three fiat currencies are listed and ALGO is not', async () => {
        renderWithNavigation(SettingsCurrencyScreen, 'SettingsCurrency')

        await waitFor(() => {
            expect(
                screen.getByTestId('settings_currency_item_usd'),
            ).toBeTruthy()
        })
        expect(screen.getByTestId('settings_currency_item_eur')).toBeTruthy()
        expect(screen.getByTestId('settings_currency_item_gbp')).toBeTruthy()
        expect(screen.queryByTestId('settings_currency_item_algo')).toBeNull()
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

    it('Given a custom handler returning only JPY, when the screen mounts, then only JPY appears', async () => {
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
        expect(screen.queryByTestId('settings_currency_item_algo')).toBeNull()
    })

    describe('on a network with no Pera backend of its own', () => {
        afterEach(() => {
            useNetworkStore.getState().setMode('live')
        })

        it.each(['betanet', 'custom'])(
            'Given developer mode on %s, when the screen mounts, then the developer deployment serves the full list',
            async network => {
                const requested: string[] = []
                server.use(
                    http.get('*/v1/currencies/', ({ request }) => {
                        requested.push(new URL(request.url).origin)
                        return HttpResponse.json(USD_EUR_GBP)
                    }),
                )
                useNetworkStore.getState().setMode('developer')
                useNetworkStore
                    .getState()
                    .selectNetwork(LEGACY_CHAIN_ID, network)

                renderWithNavigation(SettingsCurrencyScreen, 'SettingsCurrency')

                await waitFor(() => {
                    expect(
                        screen.getByTestId('settings_currency_item_eur'),
                    ).toBeTruthy()
                })
                expect([...new Set(requested)]).toEqual([
                    new URL(getPeraDeploymentConfig('developer').backendUrl)
                        .origin,
                ])
            },
        )
    })
})
