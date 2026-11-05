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

// A swap from an Algorand account into the same user's Ethereum address: quote,
// order, sign and broadcast the source leg, then follow the order until the
// router reports it final.

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
import React, { useEffect, useRef } from 'react'
import { renderHook } from '@testing-library/react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'

import { server } from '@test-utils/msw-server'
import { createQueryClientWrapper } from '@test-utils/render'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { registerEthereumAccountsAdapter } from '@test-utils/ethereumAccountsAdapter'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    seedAlgo25Signer,
    waitFor,
    REVIEW_RECEIVER_ADDRESS,
} from '@test-utils/signing-review'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { evmChainOf } from '@packages/chain-ethereum/src/chains/table'
import { createEvmSwapAdapter } from '@packages/chain-ethereum/src/swaps'
import { getAccountBalancesQueryKey } from '@packages/accounts/src/hooks/querykeys'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { mockAlgodAccountInformation } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { usePreferences } from '@perawallet/wallet-core-settings'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    swapChainAdapters,
    useCreateQuotesMutation,
    useSwapOrderTracker,
    useSwapTrackingStore,
    type SwapQuote,
    type SwapQuoteRequest,
    type SwapStatus,
} from '@perawallet/wallet-core-swaps'
import {
    mockCreateSwapQuotes,
    mockFetchSwapOrder,
    mockSwapPairs,
} from '@perawallet/wallet-core-swaps/test-handlers'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { SigningOverlays } from '@modules/signing/shell'
import {
    useSwapExecution,
    type SwapExecutionOutcome,
} from '@modules/swap/hooks/useSwapExecution'
import { useSwapToAssetSelectionList } from '@modules/swap/components/SwapToAssetSelectionList/useSwapToAssetSelectionList'

import { registerChainAdapters } from '../bootstrap/chain-adapters'
import { addressOf } from './__fixtures__/accounts'
import {
    ALGO_SCOPE,
    ETH_ADDRESS,
    ETH_SCOPE,
} from './__fixtures__/multichainHoldings'
import {
    ALGORAND_MAINNET_CAIP2,
    SWAP_ORDER_ID,
    mockSwapOrderWithPayment,
    spyOnSwapSubmissionAndReports,
} from './__fixtures__/swapRouter'

const ALGO_ID = `${ALGORAND_MAINNET_CAIP2}/asa:0`
const ETH_ID = 'eip155:1/slip44:60'
const ETH_ASSET = evmChainOf('ethereum').nativeAsset.assetId

const routerAsset = (assetId: string, unitName: string, decimals: number) => ({
    asset_id: assetId,
    name: unitName,
    unit_name: unitName,
    fraction_decimals: decimals,
    logo: null,
    verification_tier: 'verified',
    cross_chain_asset_group: null,
})

const crossChainOffer = (depositAddress: string) => ({
    quote_id: 'quote-xo-1',
    aggregator: 'xo-v4',
    provider: 'xo',
    source_asset: routerAsset(ALGO_ID, 'ALGO', 6),
    destination_asset: routerAsset(ETH_ID, 'ETH', 18),
    source_amount: '1000000',
    destination_amount_expected: '50000000000000',
    destination_amount_minimum: '49000000000000',
    source_amount_usd_value: null,
    destination_amount_usd_value: null,
    fees: [],
    funding_method: 'wallet_transaction',
    expires_at: null,
    deposit_address: depositAddress,
    extras: null,
})

const routerOrder = (status: SwapStatus) => ({
    order_id: SWAP_ORDER_ID,
    aggregator: 'xo-v4',
    provider: 'xo',
    status,
    funding_method: 'wallet_transaction',
    source_account: null,
    destination_account: null,
    source_asset: null,
    destination_asset: null,
    source_amount: null,
    destination_amount_expected: null,
    destination_amount_minimum: null,
    destination_amount_received: null,
    source_amount_usd_value: null,
    destination_amount_usd_value: null,
    transactions: [],
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    expires_at: null,
})

type HostApi = {
    execute: (quote: SwapQuote) => Promise<SwapExecutionOutcome>
    createQuotes: (request: SwapQuoteRequest) => Promise<SwapQuote[]>
    queryClient: QueryClient
}
let host: Nullable<HostApi> = null

const CrossChainHost = () => {
    const { execute } = useSwapExecution()
    const { mutateAsync: createQuotes } = useCreateQuotesMutation()
    const queryClient = useQueryClient()
    const { setPreference } = usePreferences()
    const prepared = useRef(false)
    useSwapOrderTracker()
    useEffect(() => {
        if (!prepared.current) {
            prepared.current = true
            setPreference('hasSeenTransactionRequestFAQ', true)
        }
        host = { execute, createQuotes, queryClient }
    }, [execute, createQuotes, queryClient, setPreference])
    return <SigningOverlays />
}

const withEthereum = (account: WalletAccount): WalletAccount => ({
    ...account,
    chains: {
        ...account.chains,
        ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' },
    },
})

const selectAccount = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

const startHost = async (): Promise<{ sender: string; api: HostApi }> => {
    const signer = withEthereum(await seedAlgo25Signer())
    selectAccount(signer)
    renderWithNavigation(CrossChainHost, 'CrossChainHost')
    await waitFor(() => expect(host).not.toBeNull())
    const sender = addressOf(signer)
    server.use(
        mockAlgodAccountInformation({
            address: sender,
            response: { amount: 5_000_000, 'min-balance': 100_000 },
        }),
    )
    return { sender, api: host! }
}

const requestOf = (sender: string): SwapQuoteRequest => ({
    sourceAsset: { ...ALGO_SCOPE, assetId: '0' },
    destinationAsset: { ...ETH_SCOPE, assetId: ETH_ASSET },
    sourceAmount: new Decimal(1_000_000),
    sourceAddress: sender,
    destinationAddress: ETH_ADDRESS,
    slippage: null,
})

const quoteFor = async (api: HostApi, sender: string, deposit: string) => {
    server.use(
        mockCreateSwapQuotes({
            response: { results: [crossChainOffer(deposit)] },
        }),
    )
    const [quote] = await api.createQuotes(requestOf(sender))
    return quote
}

describe('Flow: Cross-chain swap (Algorand into an own Ethereum address)', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })
    beforeEach(async () => {
        registerEthereumChain()
        registerEthereumAccountsAdapter()
        if (!swapChainAdapters.has('ethereum')) {
            swapChainAdapters.register(
                createEvmSwapAdapter(evmChainOf('ethereum')),
            )
        }
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
        useSwapTrackingStore.getState().resetState()
        // Hydration landing after the override would clobber it.
        await useRemoteConfigStore.persist.rehydrate()
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_cross_chain_swap', true)
    })
    afterEach(() => {
        host = null
        vi.restoreAllMocks()
        useRemoteConfigStore.getState().resetState()
        getProvider().chains.reset()
        registerChainAdapters()
    })

    it("Given a quote into the user's Ethereum address, when the swap runs, then the order is tracked until completed and the Ethereum balance is refreshed", async () => {
        const { sender, api } = await startHost()
        mockSwapOrderWithPayment({ sender, receiver: REVIEW_RECEIVER_ADDRESS })
        const { algodBodies, reports } = spyOnSwapSubmissionAndReports()
        server.use(mockFetchSwapOrder({ order: routerOrder('in_progress') }))
        const balanceKey = getAccountBalancesQueryKey(ETH_ADDRESS, ETH_SCOPE)
        // Test clients default to gcTime 0, which would drop this unobserved entry.
        api.queryClient.setQueryDefaults(balanceKey, { gcTime: Infinity })
        api.queryClient.setQueryData(balanceKey, { seeded: true })

        const quote = await quoteFor(api, sender, REVIEW_RECEIVER_ADDRESS)
        expect(quote.routeKind).toBe('cross-chain')
        const outcome = await api.execute(quote)

        expect(outcome).toEqual({ kind: 'success' })
        expect(algodBodies).toHaveLength(1)
        await waitFor(() => expect(reports).toHaveLength(1))
        expect(useSwapTrackingStore.getState().orders[SWAP_ORDER_ID]).toEqual(
            expect.objectContaining({
                sourceAddress: sender,
                destinationAddress: ETH_ADDRESS,
                sourceScope: ALGO_SCOPE,
                destinationScope: ETH_SCOPE,
            }),
        )
        await waitFor(() =>
            expect(
                useSwapTrackingStore.getState().orders[SWAP_ORDER_ID].status,
            ).toBe('in_progress'),
        )
        expect(api.queryClient.getQueryState(balanceKey)?.isInvalidated).toBe(
            false,
        )

        server.use(mockFetchSwapOrder({ order: routerOrder('completed') }))
        // Stands in for the next poll: the interval itself is pinned by the tracker's spec.
        await api.queryClient.refetchQueries({ queryKey: ['swaps', 'order'] })

        await waitFor(() =>
            expect(
                useSwapTrackingStore.getState().orders[SWAP_ORDER_ID].status,
            ).toBe('completed'),
        )
        await waitFor(() =>
            expect(
                api.queryClient.getQueryState(balanceKey)?.isInvalidated,
            ).toBe(true),
        )
    })

    it('Given an order whose source leg pays someone other than the quoted deposit address, when the swap runs, then nothing is broadcast and nothing is tracked', async () => {
        const { sender, api } = await startHost()
        mockSwapOrderWithPayment({ sender, receiver: REVIEW_RECEIVER_ADDRESS })
        const { algodBodies } = spyOnSwapSubmissionAndReports()

        const quote = await quoteFor(api, sender, sender)
        const outcome = await api.execute(quote)

        expect(outcome.kind).toBe('error')
        expect(algodBodies).toHaveLength(0)
        expect(useSwapTrackingStore.getState().orders).toEqual({})
    })

    describe('the receive picker', () => {
        const offeredChains = async (account: WalletAccount) => {
            selectAccount(account)
            server.use(
                mockSwapPairs({
                    response: {
                        results: [
                            {
                                kind: 'token',
                                asset: routerAsset(ETH_ID, 'ETH', 18),
                            },
                            {
                                kind: 'token',
                                asset: routerAsset(
                                    `${ALGORAND_MAINNET_CAIP2}/asa:31566704`,
                                    'USDC',
                                    6,
                                ),
                            },
                        ],
                    },
                }),
            )
            const { result } = renderHook(
                () =>
                    useSwapToAssetSelectionList({
                        scope: ALGO_SCOPE,
                        fromAssetId: '0',
                        onAssetSelected: vi.fn(),
                    }),
                { wrapper: createQueryClientWrapper() },
            )
            await waitFor(() => expect(result.current.isLoading).toBe(false))
            return result.current.items.map(item => item.swapAsset.ref.chainId)
        }

        it('Given an account with a signing Ethereum address, when the picker lists pairs, then ETH is offered', async () => {
            const chains = await offeredChains(
                withEthereum(await seedAlgo25Signer()),
            )

            expect(chains).toEqual(['ethereum', 'algorand'])
        })

        it('Given no account on Ethereum, when the picker lists pairs, then ETH is not offered', async () => {
            const chains = await offeredChains(await seedAlgo25Signer())

            expect(chains).toEqual(['algorand'])
        })

        it('Given the flag is off, when the picker lists pairs, then ETH is not offered', async () => {
            useRemoteConfigStore
                .getState()
                .setConfigOverride('enable_cross_chain_swap', false)

            const chains = await offeredChains(
                withEthereum(await seedAlgo25Signer()),
            )

            expect(chains).toEqual(['algorand'])
        })
    })
})
