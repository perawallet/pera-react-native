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

// With a chain's Pera backend switched off, its RPC reads keep syncing and
// settling, and nothing else reaches the backend; switched back on, the next
// tick reads the backend again.

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
import type {
    SigningResult,
    SourceMetadata,
} from '@perawallet/wallet-core-signing'
import { VIEM_TRANSFER_NONCE_0 } from '@packages/chain-ethereum/src/signing/__tests__/fixtures'

const RPC_URL = 'https://mainnet.rpc.test/'
const PERA_SERVICES = ['blockFollowing', 'assets', 'prices', 'history'] as const

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        // The chain context reads its services here, so it must honour the switch itself.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? withBackend.isPeraBackendSwitchedOff('ethereum')
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
const { createSyncStorePorts, SyncService, useSyncCursorStore } =
    await import('@perawallet/wallet-core-background')
const { useNetworkStore } = await import('@perawallet/wallet-core-chain-shared')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { broadcasterChainAdapters, getOpenSubmissionAttempts } =
    await import('@perawallet/wallet-core-signing')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const {
    erc20CallResponder,
    evmRpcHandlers,
    evmTransactionReceipt,
    peraEvmHandlers,
} = await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { i18nKey } = await import('@perawallet/wallet-core-chain-contract')
const { Decimal } = await import('decimal.js')

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const SWITCH_KEY = 'chain_ethereum_overrides'
const SWITCH_OFF = '{"enabled":false}'
const PERA_URL = 'https://pera.test'

const BYTES = Uint8Array.from(
    Buffer.from(VIEM_TRANSFER_NONCE_0.slice(2), 'hex'),
)

const SEND: SigningResult = {
    signedData: {
        type: 'signed-transactions',
        signed: [{ scope: SCOPE, id: 'unused', bytes: BYTES }],
        historyEntries: [
            {
                summary: {
                    kind: 'transfer',
                    title: { key: i18nKey('transactions.list_item.send') },
                    direction: 'out',
                    icon: 'send',
                },
                chainData: { family: 'evm' },
            },
        ],
    },
    signers: [],
}

const switchEthereum = (value: string | null) =>
    useRemoteConfigStore.getState().setConfigOverride(SWITCH_KEY, value)

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

// ETH_ADDRESS, checksummed, as the balance fixture keys holders.
const HOLDER = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const broadcast = async (): Promise<string> => {
    const result = await broadcasterChainAdapters
        .get('ethereum')
        .createSubmitTransport(SCOPE)
        .send(SEND, { type: 'local' } as SourceMetadata)
    if (result.type !== 'submitted') throw new Error('not submitted')
    return result.txIds[0]
}

describe('Flow: Ethereum switched off remotely, then back on', () => {
    const requests: string[] = []

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useSyncCursorStore.getState().resetState()
        useNetworkStore.getState().setMode('live')
        useRemoteConfigStore.getState().resetState()
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
                    eth_getTransactionReceipt: params =>
                        evmTransactionReceipt({
                            transactionHash: params[0] as `0x${string}`,
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
    })

    it('Given Ethereum off, when a sync tick runs, then its balance is read over RPC, no Ethereum request reaches the Pera backend, and its stored token is read over RPC too', async () => {
        switchEthereum(SWITCH_OFF)

        await runTick()

        expect(requests.some(url => url === RPC_URL)).toBe(true)
        expect(requests.filter(isEthereumPeraRequest)).toEqual([])
        const held = await getAccountHoldings({
            accountAddress: ETH_ADDRESS,
            scope: SCOPE,
        })
        expect(held.map(row => row.assetId).sort()).toEqual(
            ['native', USDC].sort(),
        )
        expect(
            held.find(row => row.assetId === 'native')?.amount.toFixed(),
        ).toBe('1')
        // Sold down while the backend was off: the RPC value replaces the stale row.
        expect(held.find(row => row.assetId === USDC)?.amount.toFixed()).toBe(
            '3000000',
        )
    })

    it('Given a send broadcast and still open and Ethereum off, when a tick runs with a confirmed receipt, then the attempt settles', async () => {
        await broadcast()
        expect(
            await getOpenSubmissionAttempts({ chainId: 'ethereum' }),
        ).toHaveLength(1)
        switchEthereum(SWITCH_OFF)

        await runTick()

        expect(
            await getOpenSubmissionAttempts({ chainId: 'ethereum' }),
        ).toHaveLength(0)
        expect(requests.filter(isEthereumPeraRequest)).toEqual([])
    })

    it('Given one running sync and Ethereum switched back on, when the next tick runs, then it reads the Pera backend again although the backend reports no change', async () => {
        const service = newService()
        switchEthereum(SWITCH_OFF)
        await runTick(service)
        expect(requests.filter(isEthereumPeraRequest)).toEqual([])

        switchEthereum(null)
        await runTick(service)

        expect(
            requests.some(url => url.includes('/api/v3/evm/1/tokens/')),
        ).toBe(true)
    })
})
