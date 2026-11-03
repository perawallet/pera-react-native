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

// A chain the Pera backend doesn't serve, whether its chain list leaves the
// chain out or a request answers 422, goes quiet: its RPC reads keep syncing,
// nothing more reaches the backend, and no surface reports a failure.

import React from 'react'
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
import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@test-utils/msw-server'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const RPC_URL = 'https://mainnet.rpc.test/'
const PERA_SERVICES = ['blockFollowing', 'assets', 'prices', 'history'] as const

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        // The chain context reads its services here, so it must honour a refusal itself.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? withBackend.isPeraScopeRefused(scope)
                    ? new Set()
                    : new Set(PERA_SERVICES)
                : withBackend.peraServicesFor(scope),
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : withBackend.chainEndpointsFor(chainId),
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so every module under
// test is loaded afresh.
vi.resetModules()
const { getAccountHoldings, insertAssetHolding, useAccountsStore } =
    await import('@perawallet/wallet-core-accounts')
const { useHoldingsRefreshStore } =
    await import('@perawallet/wallet-core-accounts')
const { createSyncStorePorts, SyncService, useSyncCursorStore } =
    await import('@perawallet/wallet-core-background')
const { useNetworkStore } = await import('@perawallet/wallet-core-chain-shared')
const { isPeraScopeRefused, resetPeraScopeRefusals } =
    await import('@perawallet/wallet-core-config')
const { mockGetPeraChains } =
    await import('@perawallet/wallet-core-device/test-handlers')
const { isChainRefusedError, isPeraServiceUnavailableError } =
    await import('@perawallet/wallet-core-shared')
const { historyChainAdapters } =
    await import('@perawallet/wallet-core-transactions')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const { erc20CallResponder, evmRpcHandlers, peraEvmHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { render } = await import('@test-utils/render')
const { PeraServedChainsSync } = await import('@providers/PeraServedChainsSync')
const { Decimal } = await import('decimal.js')

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const PERA_URL = 'https://pera.test'
const ALGORAND_MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

// ETH_ADDRESS, checksummed, as the balance fixture keys holders.
const HOLDER = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

// The tick has no completion signal; its in-progress flag is the only one.
const isTickRunning = (service: InstanceType<typeof SyncService>): boolean =>
    (service as unknown as { syncInProgress: boolean }).syncInProgress

const newService = () =>
    new SyncService({
        queryClient: new QueryClient(),
        stores: createSyncStorePorts(),
        chains: getProvider().chains,
    })

const runTick = async (service = newService()): Promise<void> => {
    service.start()
    await vi.waitFor(() => expect(isTickRunning(service)).toBe(false), {
        timeout: 10_000,
    })
    service.stop()
}

// Every Pera route an Ethereum scope reads.
const isEthereumPeraRequest = (url: string): boolean => {
    const { origin, pathname } = new URL(url)
    return (
        origin === PERA_URL &&
        (pathname.includes('/api/v3/evm/') ||
            pathname.includes('/api/v4/accounts/should-refresh/'))
    )
}

const isPeraRequest = (url: string): boolean => new URL(url).origin === PERA_URL

const isHoldingsRefreshFailed = (): boolean =>
    Object.values(useHoldingsRefreshStore.getState().failed).some(
        byAddress => byAddress?.[ETH_ADDRESS] === true,
    )

const readHistory = () =>
    historyChainAdapters
        .get('ethereum')
        .getTransactionHistory(ETH_ADDRESS, SCOPE)
        .catch((error: unknown) => error)

describe('Flow: the Pera backend refuses Ethereum', () => {
    const requests: string[] = []

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetPeraScopeRefusals()
        useSyncCursorStore.getState().resetState()
        useHoldingsRefreshStore.getState().resetState()
        useNetworkStore.getState().setMode('live')
        useAccountsStore.getState().setAccounts([
            {
                id: 'eth-watch',
                custody: { kind: 'watch' },
                chains: { ethereum: { address: ETH_ADDRESS } },
            },
        ])
        await insertAssetHolding({
            accountAddress: ETH_ADDRESS,
            assetId: USDC,
            scope: SCOPE,
            amount: new Decimal('5000000'),
        })
        requests.length = 0
        server.events.on('request:start', ({ request }) => {
            requests.push(request.url)
        })
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_blockNumber: '0x64',
                    eth_getBalance: '0x1',
                    eth_call: erc20CallResponder({
                        [USDC]: {
                            name: 'USD Coin',
                            symbol: 'USDC',
                            decimals: 6,
                            totalSupply: 10n ** 12n,
                            balances: { [HOLDER]: 3_000_000n },
                        },
                    }),
                },
            }),
            ...peraEvmHandlers({ baseUrl: PERA_URL }),
            http.all('*', () => HttpResponse.json({}, { status: 404 })),
        )
    })

    afterEach(() => {
        server.events.removeAllListeners()
        useAccountsStore.getState().setAccounts([])
        resetPeraScopeRefusals()
    })

    it("Given the deployment's chain list leaves Ethereum out, when a sync tick runs and history is read, then no Ethereum request reaches the Pera backend, the balance comes over RPC, and nothing reports a failure", async () => {
        server.use(mockGetPeraChains({ chainIds: [ALGORAND_MAINNET] }))
        render(<PeraServedChainsSync />)
        await vi.waitFor(() => expect(isPeraScopeRefused(SCOPE)).toBe(true))

        await runTick()
        const history = await readHistory()

        expect(requests.filter(isEthereumPeraRequest)).toEqual([])
        expect(requests.some(url => url === RPC_URL)).toBe(true)
        const held = await getAccountHoldings({
            accountAddress: ETH_ADDRESS,
            scope: SCOPE,
        })
        expect(
            held.find(row => row.assetId === 'native')?.amount.toFixed(),
        ).toBe('1')
        expect(held.find(row => row.assetId === USDC)?.amount.toFixed()).toBe(
            '3000000',
        )
        expect(isHoldingsRefreshFailed()).toBe(false)
        expect(isPeraServiceUnavailableError(history)).toBe(true)
        expect(isChainRefusedError(history)).toBe(true)
    })

    it("Given the chain list serves Ethereum, when the sync tick runs, then it reads Ethereum's Pera routes as usual", async () => {
        server.use(
            mockGetPeraChains({ chainIds: [ALGORAND_MAINNET, 'eip155:1'] }),
        )
        render(<PeraServedChainsSync />)
        await vi.waitFor(() =>
            expect(requests.some(url => url.endsWith('/api/v4/chains/'))).toBe(
                true,
            ),
        )

        await runTick()

        expect(isPeraScopeRefused(SCOPE)).toBe(false)
        expect(
            requests.some(url => url.includes('/api/v3/evm/1/tokens/')),
        ).toBe(true)
    })

    it('Given the backend answers 422 chain_not_enabled for Ethereum, when two sync ticks run, then only the first asks it, and nothing reports a failure', async () => {
        // Only Ethereum is synced here, so every Pera request is one of its.
        server.use(
            http.all(`${PERA_URL}/api/*`, () =>
                HttpResponse.json(
                    { error: 'Chain 1 is not enabled.', code: 'chain_not_enabled' },
                    { status: 422 },
                ),
            ),
        )
        const service = newService()

        await runTick(service)
        const askedFirst = requests.filter(isPeraRequest).length
        await runTick(service)
        const history = await readHistory()

        expect(askedFirst).toBeGreaterThan(0)
        expect(requests.filter(isPeraRequest)).toHaveLength(askedFirst)
        expect(isPeraScopeRefused(SCOPE)).toBe(true)
        expect(isHoldingsRefreshFailed()).toBe(false)
        expect(isChainRefusedError(history)).toBe(true)
    })
})
