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

// Typing an ENS name on the watch-account screen finds the address through
// Pera's backend alone and watches the account on Ethereum. No node is read
// while typing.

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
import { server } from '@test-utils/msw-server'
import { ALICE_ETHEREUM, L1_RPC, searchResult } from './__fixtures__/ens-send'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    const { L1_RPC } = await import('./__fixtures__/ens-send')
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: {
                enabled: ['algorand', 'ethereum'],
                capabilities: {},
            },
        },
        hasPeraBackend: (
            scope: Parameters<typeof withBackend.hasPeraBackend>[0],
        ) =>
            scope.chainId === 'algorand'
                ? withBackend.hasPeraBackend(scope)
                : true,
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) => {
            return chainId === 'ethereum'
                ? { mainnet: [L1_RPC], sepolia: [L1_RPC] }
                : withBackend.chainEndpointsFor(chainId)
        },
    }
})

vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { fireEvent, screen, waitFor } = await import('@testing-library/react')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { evmRpcHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { mockNameSearch } =
    await import('@perawallet/wallet-core-names/test-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestKeystore } = await import('@test-utils/algorand-keystore-test')
const { isElementDisabled } = await import('@test-utils/rnw')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { WatchAccountScreen } =
    await import('@modules/onboarding/screens/WatchAccountScreen/WatchAccountScreen')
const { NameAccountScreen } =
    await import('@modules/onboarding/screens/NameAccountScreen/NameAccountScreen')
const { SLOW_WAIT_TIMEOUT_MS } = await import('./__fixtures__/timeouts')

describe('Flow: Add Account → Watch an ENS name', () => {
    const nodeReads: string[] = []
    const recordRequest = ({ request }: { request: Request }) => {
        if (request.url.startsWith(L1_RPC)) nodeReads.push(request.url)
    }

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        nodeReads.length = 0
        server.events.on('request:start', recordRequest)
        server.use(
            ...evmRpcHandlers({ rpcUrl: L1_RPC }),
            mockNameSearch({
                response: {
                    count: 1,
                    results: [
                        searchResult('alice.eth', ALICE_ETHEREUM, 'eip155:1'),
                    ],
                },
            }),
        )
    })

    afterEach(() => {
        server.events.removeListener('request:start', recordRequest)
    })

    it("Given the watch screen, when the user types an ENS name, then no node is read and the account is watched on Ethereum at ENS's address", async () => {
        renderWithNavigation(WatchAccountScreen, 'WatchAccount', {
            additionalScreens: [
                { name: 'NameAccount', component: NameAccountScreen },
            ],
        })

        fireEvent.change(
            await screen.findByTestId('watch_account_address_input'),
            { target: { value: 'Alice.ETH' } },
        )

        await waitFor(
            () =>
                expect(
                    isElementDisabled(
                        screen.getByTestId('watch_account_submit_button'),
                    ),
                ).toBe(false),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(nodeReads).toEqual([])

        fireEvent.click(screen.getByTestId('watch_account_submit_button'))

        await waitFor(() =>
            expect(useAccountsStore.getState().accounts).toHaveLength(1),
        )
        expect(
            useAccountsStore.getState().accounts[0].chains.ethereum?.address,
        ).toBe(ALICE_ETHEREUM)
    })
})
