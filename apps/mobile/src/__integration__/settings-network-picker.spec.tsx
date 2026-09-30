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
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    ETHEREUM_CHAIN_ID,
    allCapabilities,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { registerChainAdapters } from '../bootstrap/chain-adapters'
import { SettingsDeveloperNodeSettingsScreen } from '@modules/settings/screens/developer/SettingsDeveloperNodeSettingsScreen/SettingsDeveloperNodeSettingsScreen'

const renderScreen = () =>
    renderWithNavigation(SettingsDeveloperNodeSettingsScreen, 'NodeSettings')

// The radio draws its dot as the only child of its `-radio` circle.
const isRadioSelected = (testID: string): boolean =>
    screen.getByTestId(`${testID}-radio`).childElementCount > 0

const resolvedNetwork = (chainId: typeof ETHEREUM_CHAIN_ID | 'algorand') =>
    selectChainNetworkId(useNetworkStore.getState(), chainId)

const registerEthereum = () =>
    getProvider().chains.register(
        fixtureEthereumDescriptor,
        allCapabilities(false),
    )

describe('Flow: Settings → Node Settings network picker', () => {
    afterEach(() => {
        // Unmount first: a mounted screen re-renders on the store reset below
        // and would read a chain the registry no longer holds.
        cleanup()
        getProvider().chains.reset()
        registerChainAdapters()
        useNetworkStore.getState().resetState()
    })

    it('Given Algorand is the only chain, when the user picks TestNet, then Algorand moves to TestNet and the callout shows', async () => {
        renderScreen()

        await waitFor(() => {
            expect(screen.getByTestId('node_settings_screen')).toBeTruthy()
        })
        expect(screen.getByTestId('node_settings_mainnet_row')).toBeTruthy()
        expect(screen.getByTestId('node_settings_testnet_row')).toBeTruthy()
        expect(screen.getByTestId('node_settings_custom_row')).toBeTruthy()
        expect(screen.queryByTestId('node_settings_betanet_row')).toBeFalsy()
        expect(screen.queryByTestId('node_settings_chain_networks')).toBeFalsy()
        expect(
            screen.queryByTestId('node_settings_non_mainnet_notice'),
        ).toBeFalsy()

        fireEvent.click(screen.getByTestId('node_settings_testnet_radio'))

        await waitFor(() => {
            expect(
                screen.getByTestId('node_settings_non_mainnet_notice'),
            ).toBeTruthy()
        })
        expect(resolvedNetwork('algorand')).toBe('testnet')
        expect(isRadioSelected('node_settings_testnet_radio')).toBe(true)
        expect(isRadioSelected('node_settings_mainnet_radio')).toBe(false)
    })

    it('Given Ethereum is registered, when the user picks TestNet, then Algorand moves to TestNet and Ethereum to Sepolia', async () => {
        registerEthereum()
        renderScreen()

        await waitFor(() => {
            expect(
                screen.getByTestId('node_settings_chain_networks'),
            ).toBeTruthy()
        })
        expect(
            screen.getByTestId('node_settings_chain_algorand_badge')
                .textContent,
        ).toBe('MainNet')
        expect(
            screen.getByTestId(`node_settings_chain_${ETHEREUM_CHAIN_ID}_badge`)
                .textContent,
        ).toBe('Mainnet')
        // Algorand still offers custom networks, so the row stays.
        expect(screen.getByTestId('node_settings_custom_row')).toBeTruthy()

        fireEvent.click(screen.getByTestId('node_settings_testnet_radio'))

        await waitFor(() => {
            expect(
                screen.getByTestId(
                    `node_settings_chain_${ETHEREUM_CHAIN_ID}_badge`,
                ).textContent,
            ).toBe('Sepolia')
        })
        expect(resolvedNetwork('algorand')).toBe('testnet')
        expect(resolvedNetwork(ETHEREUM_CHAIN_ID)).toBe('sepolia')
        expect(screen.queryByText('Goerli')).toBeFalsy()
    })

    it('Given no registered chain supports custom networks, when the screen mounts, then there is no Custom row', async () => {
        getProvider().chains.reset()
        registerEthereum()
        renderScreen()

        await waitFor(() => {
            expect(screen.getByTestId('node_settings_screen')).toBeTruthy()
        })
        expect(screen.getByTestId('node_settings_testnet_row')).toBeTruthy()
        expect(screen.queryByTestId('node_settings_custom_row')).toBeFalsy()
    })
})
