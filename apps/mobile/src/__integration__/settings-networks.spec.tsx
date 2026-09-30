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

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    ETHEREUM_CHAIN_ID,
    allCapabilities,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { registerChainAdapters } from '../bootstrap/chain-adapters'
import { SettingsNetworksScreen } from '@modules/settings/screens/SettingsNetworksScreen'

const renderScreen = () =>
    renderWithNavigation(SettingsNetworksScreen, 'NetworksSettings')

// The picker draws a radio's dot as the only child of its `-radio` circle.
const isRadioSelected = (testID: string): boolean =>
    screen.getByTestId(`${testID}-radio`).childElementCount > 0

const selectedNetworks = () =>
    useNetworkStore.getState().selectedNetworkByChain as Record<string, string>

describe('Flow: Settings → Networks', () => {
    afterEach(() => {
        // Unmount first: a mounted picker re-renders on the store reset below
        // and would read a chain the registry no longer holds.
        cleanup()
        getProvider().chains.reset()
        registerChainAdapters()
        useNetworkStore.getState().resetState()
    })

    it('Given Algorand is the only chain, when the screen mounts, then it shows the four rows of the old selector without a chain header and switching to TestNet shows the callout', async () => {
        renderScreen()

        await waitFor(() => {
            expect(screen.getByTestId('networks_screen')).toBeTruthy()
        })
        expect(
            screen.getAllByText(
                'settings.developer.node_settings.network_label',
            ),
        ).toHaveLength(3)
        expect(
            screen.getByText('settings.developer.node_settings.custom_label'),
        ).toBeTruthy()
        expect(screen.queryByText('Algorand')).toBeFalsy()
        expect(isRadioSelected('networks_algorand_mainnet_radio')).toBe(true)
        expect(
            screen.queryByTestId('networks_algorand_non_mainnet_notice'),
        ).toBeFalsy()

        fireEvent.click(screen.getByTestId('networks_algorand_testnet_radio'))

        await waitFor(() => {
            expect(
                screen.getByTestId('networks_algorand_non_mainnet_notice'),
            ).toBeTruthy()
        })
        expect(selectedNetworks().algorand).toBe('testnet')
        expect(isRadioSelected('networks_algorand_testnet_radio')).toBe(true)
        expect(isRadioSelected('networks_algorand_mainnet_radio')).toBe(false)
    })

    it('Given Ethereum is registered without custom networks, when the user picks Sepolia, then only Ethereum moves and only Ethereum shows the tier badge', async () => {
        getProvider().chains.register(
            fixtureEthereumDescriptor,
            allCapabilities(false),
        )
        renderScreen()

        await waitFor(() => {
            expect(screen.getByTestId('networks_ethereum_section')).toBeTruthy()
        })
        expect(screen.getByTestId('networks_algorand_section')).toBeTruthy()
        expect(screen.getByText('Ethereum')).toBeTruthy()
        expect(screen.queryByTestId('networks_ethereum_custom_row')).toBeFalsy()
        expect(screen.queryByTestId('networks_ethereum_goerli_row')).toBeFalsy()
        expect(screen.getByTestId('networks_algorand_custom_row')).toBeTruthy()

        fireEvent.click(screen.getByTestId('networks_ethereum_sepolia_radio'))

        await waitFor(() => {
            expect(
                screen.getByTestId('networks_ethereum_tier_badge'),
            ).toBeTruthy()
        })
        expect(selectedNetworks()[ETHEREUM_CHAIN_ID]).toBe('sepolia')
        expect(selectedNetworks().algorand).toBe('mainnet')
        expect(isRadioSelected('networks_algorand_mainnet_radio')).toBe(true)
        expect(isRadioSelected('networks_ethereum_sepolia_radio')).toBe(true)
        expect(screen.queryByTestId('networks_algorand_tier_badge')).toBeFalsy()
    })
})
