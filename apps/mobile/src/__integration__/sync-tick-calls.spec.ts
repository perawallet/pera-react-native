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
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    accountsChainAdapters,
    useAccountsStore,
    type AccountsChainAdapter,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    createSyncStorePorts,
    SyncService,
    useSyncCursorStore,
} from '@perawallet/wallet-core-background'
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    mockAlgodAccountInformation,
    mockShouldRefresh,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { createEthereumAccountsAdapter } from '@packages/chain-ethereum/src/accounts'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const RPC_URL = 'https://mainnet.rpc.test/'

const watchAccount = (
    id: string,
    chains: WalletAccount['chains'],
): WalletAccount => ({ id, custody: { kind: 'watch' }, chains })

const requestKey = (request: Request): string =>
    `${request.method} ${new URL(request.url).pathname}`

// The tick has no completion signal; its in-progress flag is the only one.
const isTickRunning = (service: SyncService): boolean =>
    (service as unknown as { syncInProgress: boolean }).syncInProgress

const runTick = async (service: SyncService): Promise<void> => {
    service.start()
    await vi.waitFor(() => expect(isTickRunning(service)).toBe(false), {
        timeout: 10_000,
    })
    service.stop()
}

const newService = (): SyncService =>
    new SyncService({
        queryClient: new QueryClient(),
        stores: createSyncStorePorts(),
        chains: getProvider().chains,
    })

// Every request the tick makes is recorded; anything without a fixture fails
// fast here rather than reaching a real backend.
const notFound = http.all('*', () => HttpResponse.json({}, { status: 404 }))

describe('sync tick network calls', () => {
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
    })

    afterEach(() => {
        server.events.removeAllListeners()
        vi.restoreAllMocks()
    })

    it('makes the same calls on each tick with only Algorand accounts', async () => {
        useAccountsStore.getState().setAccounts([
            watchAccount('a', { algorand: { address: HD_TEST_ADDRESS } }),
            watchAccount('b', {
                algorand: { address: ALGO25_TEST_ADDRESS },
            }),
        ])
        server.use(
            mockAlgodAccountInformation({
                address: HD_TEST_ADDRESS,
                response: { round: 100 },
            }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: { round: 100 },
            }),
            notFound,
        )
        const service = newService()
        const accountReads = [
            `GET /v2/accounts/${HD_TEST_ADDRESS}`,
            `GET /v2/accounts/${ALGO25_TEST_ADDRESS}`,
        ]
        const historyReads = [
            `GET /v1/accounts/${HD_TEST_ADDRESS}/transactions/`,
            `GET /v1/accounts/${ALGO25_TEST_ADDRESS}/transactions/`,
        ]
        const shouldRefresh = 'POST /v1/accounts/should-refresh/'
        // The calls a tick made before it read through the accounts adapter.
        const expectedTicks = [
            [...accountReads, 'GET /v1/public/assets/0/', ...historyReads],
            [
                shouldRefresh,
                ...accountReads,
                'GET /v1/public/assets/0/',
                ...historyReads,
            ],
            [shouldRefresh],
        ]

        for (const [index, refresh] of [true, true, false].entries()) {
            server.use(mockShouldRefresh({ response: { refresh, round: 120 } }))
            const calls: string[] = []
            server.events.on('request:start', ({ request }) => {
                calls.push(requestKey(request))
            })

            await runTick(service)
            server.events.removeAllListeners()

            expect([...calls].sort()).toEqual([...expectedTicks[index]].sort())
            // Reads within a phase run concurrently; the phases themselves
            // run in order: signal, account reads, assets, history.
            const phaseOf = (call: string): number =>
                [
                    [shouldRefresh],
                    accountReads,
                    ['GET /v1/public/assets/0/'],
                    historyReads,
                ].findIndex(phase => phase.includes(call))
            const phases = calls.map(phaseOf)
            expect(phases).toEqual([...phases].sort((a, b) => a - b))
        }
    })

    it('reads 10 Ethereum accounts in at most 4 RPC requests', async () => {
        const ctx: ChainContext = {
            getScope: () => ({ chainId: 'ethereum', networkId: 'mainnet' }),
            getEndpoints: () => ({ mainnet: RPC_URL, sepolia: RPC_URL }),
            getPeraBackend: () => ({ baseUrl: '', services: new Set() }),
            timeouts: { readMs: 1000, submitMs: 1000 },
            kms: {} as ChainContext['kms'],
        }
        const ethereum = createEthereumAccountsAdapter(ctx)
        let pendingReads = 0
        let hasReadStarted = false
        const counted: AccountsChainAdapter = {
            ...ethereum,
            fetchAccountState: async (...args) => {
                hasReadStarted = true
                pendingReads += 1
                try {
                    return await ethereum.fetchAccountState(...args)
                } finally {
                    pendingReads -= 1
                }
            },
        }
        const get = accountsChainAdapters.get.bind(accountsChainAdapters)
        const has = accountsChainAdapters.has.bind(accountsChainAdapters)
        vi.spyOn(accountsChainAdapters, 'get').mockImplementation(chainId =>
            chainId === 'ethereum' ? counted : get(chainId),
        )
        vi.spyOn(accountsChainAdapters, 'has').mockImplementation(
            chainId => chainId === 'ethereum' || has(chainId),
        )
        const addresses = Array.from(
            { length: 10 },
            (_, i) => `0x${String(i + 1).padStart(40, '0')}`,
        )
        useAccountsStore
            .getState()
            .setAccounts(
                addresses.map(address =>
                    watchAccount(address, { ethereum: { address } }),
                ),
            )
        server.use(...evmRpcHandlers({ rpcUrl: RPC_URL }), notFound)
        let rpcRequests = 0
        // Only the account reads count; the asset and history passes after
        // them are other features' requests.
        server.events.on('request:start', ({ request }) => {
            if (request.url === RPC_URL && pendingReads > 0) rpcRequests += 1
        })

        await runTick(newService())

        expect(hasReadStarted).toBe(true)
        expect(rpcRequests).toBeGreaterThan(0)
        expect(rpcRequests).toBeLessThanOrEqual(4)
    })
})
