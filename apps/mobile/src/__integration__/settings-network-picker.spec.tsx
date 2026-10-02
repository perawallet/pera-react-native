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
import {
    cleanup,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
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

const toggleDeveloperMode = () =>
    fireEvent.click(
        within(
            screen.getByTestId('node_settings_developer_mode_row'),
        ).getByRole('switch'),
    )

const registerEthereum = () =>
    getProvider().chains.register(
        fixtureEthereumDescriptor,
        allCapabilities(false),
    )

describe('Flow: Settings → Node Settings developer mode', () => {
    afterEach(() => {
        // Unmount first: a mounted screen re-renders on the store reset below
        // and would read a chain the registry no longer holds.
        cleanup()
        getProvider().chains.reset()
        registerChainAdapters()
        useNetworkStore.getState().resetState()
    })

    it('Given Algorand is the only chain, when the user switches mode and picks BetaNet, then the wallet follows and the override survives a round trip', async () => {
        renderScreen()

        await waitFor(() => {
            expect(screen.getByTestId('node_settings_screen')).toBeTruthy()
        })
        expect(screen.queryByTestId('node_settings_chain_networks')).toBeFalsy()
        expect(
            screen.queryByTestId('node_settings_non_mainnet_notice'),
        ).toBeFalsy()

        toggleDeveloperMode()

        await waitFor(() => {
            expect(
                screen.getByTestId('node_settings_non_mainnet_notice'),
            ).toBeTruthy()
        })
        expect(resolvedNetwork('algorand')).toBe('testnet')
        expect(useNetworkStore.getState().network).toBe('testnet')
        expect(isRadioSelected('node_settings_algorand_testnet_radio')).toBe(
            true,
        )
        expect(
            screen.getByTestId('node_settings_algorand_betanet_row'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('node_settings_algorand_custom_row'),
        ).toBeTruthy()

        fireEvent.click(
            screen.getByTestId('node_settings_algorand_betanet_radio'),
        )

        await waitFor(() => {
            expect(resolvedNetwork('algorand')).toBe('betanet')
        })

        toggleDeveloperMode()

        await waitFor(() => {
            expect(
                screen.queryByTestId('node_settings_chain_networks'),
            ).toBeFalsy()
        })
        expect(resolvedNetwork('algorand')).toBe('mainnet')

        toggleDeveloperMode()

        await waitFor(() => {
            expect(resolvedNetwork('algorand')).toBe('betanet')
        })
    })

    it('Given Ethereum is registered, when developer mode is on, then each chain sits on its default test network', async () => {
        registerEthereum()
        renderScreen()

        await waitFor(() => {
            expect(screen.getByTestId('node_settings_screen')).toBeTruthy()
        })
        toggleDeveloperMode()

        await waitFor(() => {
            expect(
                screen.getByTestId('node_settings_chain_networks'),
            ).toBeTruthy()
        })
        expect(resolvedNetwork('algorand')).toBe('testnet')
        expect(resolvedNetwork(ETHEREUM_CHAIN_ID)).toBe('sepolia')
        expect(
            isRadioSelected(`node_settings_${ETHEREUM_CHAIN_ID}_sepolia_radio`),
        ).toBe(true)
        expect(screen.queryByText('Goerli')).toBeFalsy()
        expect(
            screen.queryByTestId(
                `node_settings_${ETHEREUM_CHAIN_ID}_custom_row`,
            ),
        ).toBeFalsy()
    })

    it('Given no registered chain supports custom networks, when developer mode is on, then there is no Custom row', async () => {
        getProvider().chains.reset()
        registerEthereum()
        renderScreen()

        await waitFor(() => {
            expect(screen.getByTestId('node_settings_screen')).toBeTruthy()
        })
        toggleDeveloperMode()

        await waitFor(() => {
            expect(
                screen.getByTestId(
                    `node_settings_${ETHEREUM_CHAIN_ID}_sepolia_row`,
                ),
            ).toBeTruthy()
        })
        expect(
            screen.queryByTestId('node_settings_algorand_custom_row'),
        ).toBeFalsy()
    })
})
