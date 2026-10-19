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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    cleanup,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import { accountsChainAdapters } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import {
    nodeEndpointAdapters,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { config } from '@perawallet/wallet-core-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { waitPastDoublePressGuard } from '@test-utils/rnw'
import { SettingsDeveloperNodeSettingsScreen } from '@modules/settings/screens/developer/SettingsDeveloperNodeSettingsScreen/SettingsDeveloperNodeSettingsScreen'

const MAINNET_RPC = 'https://mainnet.rpc.test/'
const SEPOLIA_RPC = 'https://sepolia.rpc.test/'
const SEPOLIA_OVERRIDE = 'https://my-sepolia-node.test/'
const MAINNET_ANSWERING = 'https://mainnet-node.test/'

// The integration setup registers whichever chains config enables; the test
// build carries no Ethereum RPC URLs of its own.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        chainEndpointsFor: (chainId: ChainId) =>
            chainId === 'ethereum'
                ? {
                      mainnet: 'https://mainnet.rpc.test/',
                      sepolia: 'https://sepolia.rpc.test/',
                  }
                : actual.chainEndpointsFor(chainId),
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const

const hostOf = (url: string) => new URL(url).host

const endpointText = (chainId: string, networkId: string) =>
    screen.getByTestId(`node_settings_${chainId}_${networkId}_endpoint`)
        .textContent

const openOverrideSheet = async () => {
    fireEvent.click(
        screen.getByTestId('node_settings_ethereum_sepolia_override_button'),
    )
    await waitFor(() => {
        expect(screen.getByTestId('endpoint_override_url_input')).toBeTruthy()
    })
}

const submitUrl = (url: string) => {
    fireEvent.change(screen.getByTestId('endpoint_override_url_input'), {
        target: { value: url },
    })
    fireEvent.click(screen.getByTestId('endpoint_override_save_button'))
}

describe('Flow: Settings → Developer Mode → Override RPC', () => {
    const requestedUrls: string[] = []

    beforeEach(() => {
        requestedUrls.length = 0
        server.events.on('request:start', ({ request }) => {
            requestedUrls.push(request.url)
        })
        server.use(
            ...evmRpcHandlers({
                rpcUrl: SEPOLIA_OVERRIDE,
                responses: { eth_chainId: '0xaa36a7' },
            }),
            ...evmRpcHandlers({
                rpcUrl: MAINNET_ANSWERING,
                responses: { eth_chainId: '0x1' },
            }),
        )
    })

    afterEach(() => {
        cleanup()
        server.events.removeAllListeners()
        useNetworkStore.getState().resetState()
    })

    it('Given Ethereum is registered, when the developer overrides Sepolia, then only Sepolia moves to the checked node, and Reset moves it back', async () => {
        renderWithNavigation(
            SettingsDeveloperNodeSettingsScreen,
            'NodeSettings',
        )
        await waitFor(() => {
            expect(screen.getByTestId('node_settings_screen')).toBeTruthy()
        })
        fireEvent.click(
            within(
                screen.getByTestId('node_settings_developer_mode_row'),
            ).getByRole('switch'),
        )
        await waitFor(() => {
            expect(endpointText('ethereum', 'sepolia')).toBe(
                hostOf(SEPOLIA_RPC),
            )
        })
        const algorandHost = endpointText('algorand', 'testnet')
        expect(algorandHost).toBe(hostOf(config.testnetAlgodUrl))

        await openOverrideSheet()
        submitUrl(MAINNET_ANSWERING)

        await waitFor(() => {
            expect(
                screen.getByText(
                    'settings.developer.node_settings.endpoint_wrong_network',
                ),
            ).toBeTruthy()
        })
        expect(useNetworkStore.getState().endpointOverridesByChain).toEqual({})

        await waitPastDoublePressGuard()
        submitUrl(SEPOLIA_OVERRIDE)

        await waitFor(() => {
            expect(
                screen.queryByTestId('endpoint_override_url_input'),
            ).toBeNull()
        })
        expect(endpointText('ethereum', 'sepolia')).toBe(
            'settings.developer.node_settings.endpoint_overridden',
        )
        expect(
            nodeEndpointAdapters.get('ethereum').endpointUrl('sepolia'),
        ).toBe(SEPOLIA_OVERRIDE)

        requestedUrls.length = 0
        await accountsChainAdapters
            .get('ethereum')
            .accountExists(ETH_ADDRESS, SEPOLIA)
        expect(requestedUrls.length).toBeGreaterThan(0)
        expect(requestedUrls.every(url => url === SEPOLIA_OVERRIDE)).toBe(true)

        expect(
            nodeEndpointAdapters.get('ethereum').endpointUrl('mainnet'),
        ).toBe(MAINNET_RPC)
        expect(endpointText('algorand', 'testnet')).toBe(algorandHost)

        await openOverrideSheet()
        fireEvent.click(screen.getByTestId('endpoint_override_reset_button'))

        await waitFor(() => {
            expect(endpointText('ethereum', 'sepolia')).toBe(
                hostOf(SEPOLIA_RPC),
            )
        })
        expect(useNetworkStore.getState().endpointOverridesByChain).toEqual({
            ethereum: {},
        })
    })
})
