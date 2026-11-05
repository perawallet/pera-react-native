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

// An Ethereum account swapping: the router's prepared calls are checked, then
// signed and broadcast one at a time with the app's own nonces and fees.

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
import type { QueryClient } from '@tanstack/react-query'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapQuote, SwapStatus } from '@perawallet/wallet-core-swaps'
import { server } from '@test-utils/msw-server'
import type { SwapExecutionOutcome } from '@modules/swap/hooks/useSwapExecution'

const RPC_URL = 'https://mainnet.rpc.test/'
const panelAccount = vi.hoisted(() => ({
    current: null as Nullable<WalletAccount>,
}))
const ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
const NODE_BALANCE = '0x8ac7230489e80000'
const SWAP_DATA = '0x5ae401dc'
const FORM_TIMEOUT = { timeout: 8000 }
const TOKEN_UNITS = 12_500_000n
const WEI = 10n ** 17n
const ALGO_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

// The integration setup registers whichever chains config enables, and hands
// each chain the endpoints config gives it; tests leave Ethereum's RPC unset.
// The panel reads its account from the overview screen, which this flow doesn't mount.
vi.mock(
    '@modules/accounts/components/AccountOverview/AccountOverviewModalContext',
    () => ({
        useAccountOverviewModal: () => ({ account: panelAccount.current }),
    }),
)

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : withBackend.chainEndpointsFor(chainId),
    }
})

// The router is reached through the source chain's Pera deployment. The
// integration setup loads the query client before this file's config mock
// exists, and the client reads its deployments once, so everything under test
// is loaded afresh, the test theme the setup installed included. The fixtures
// keep the server the setup is listening on.
vi.resetModules()
vi.doMock('@test-utils/msw-server', () => ({ server }))
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { useEffect, useRef } = await import('react')
const { useQueryClient } = await import('@tanstack/react-query')
const { act, fireEvent, renderHook, screen, waitFor } =
    await import('@testing-library/react')
const { Decimal } = await import('decimal.js')
const { insertAssetHolding, useAccountChainStateStore, useAccountsStore } =
    await import('@perawallet/wallet-core-accounts')
const { getAccountBalancesQueryKey } =
    await import('@packages/accounts/src/hooks/querykeys')
const { DeeplinkType } = await import('@perawallet/wallet-core-deeplinks')
const {
    encodeErc20Approve,
    encodeUnsignedEvmCall,
    evmRpcHandlers,
    evmTransactionReceipt,
    readRawEvmTransaction,
} = await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { kmsCore } = await import('@perawallet/wallet-core-kms')
const { chainOverridesKey, useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { usePreferences } = await import('@perawallet/wallet-core-settings')
const {
    swapChainAdapters,
    useSwapOrderTracker,
    useSwapsStore,
    useSwapSigningAccounts,
    useSwapTrackingStore,
} = await import('@perawallet/wallet-core-swaps')
const { mockCreateSwapQuotes, mockFetchSwapOrder } =
    await import('@perawallet/wallet-core-swaps/test-handlers')
const { getProvider } = await import('@perawallet/wallet-extension-provider')
const { evmChainOf } = await import('@packages/chain-ethereum/src/chains/table')
const { createEvmSwapAdapter } =
    await import('@packages/chain-ethereum/src/swaps')
const { resetTestKeystore } = await import('@test-utils/algorand-keystore-test')
const {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} = await import('@test-utils/database-setup')
const { createQueryClientWrapper } = await import('@test-utils/render')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { findEnabledByTestId, isElementDisabled } =
    await import('@test-utils/rnw')
const { seedAlgo25Signer } = await import('@test-utils/signing-review')
const { useButtonPanel } =
    await import('@modules/accounts/components/ButtonPanel/useButtonPanel')
const { useAssetActionButtons } =
    await import('@modules/assets/components/holdings/AssetActionButtons/useAssetActionButtons')
const { capabilityRequirementForDeeplink } =
    await import('@modules/deeplink/capability-policy')
const { useCapabilityCheck } = await import('@hooks/useCapability')
const { SigningOverlays } = await import('@modules/signing/shell')
const { SwapForm } = await import('@modules/swap/components/SwapForm')
const { SwapScreen } =
    await import('@modules/swap/screens/SwapScreen/SwapScreen')
const { useSwapExecution } =
    await import('@modules/swap/hooks/useSwapExecution')
const {
    ETH_SCOPE,
    ETHEREUM_SENDER,
    seedEthereumAssets,
    seedSenderEther,
    RECEIVER,
    selectSender,
    SENDER,
    signWithSenderKey,
    TOKEN,
} = await import('./__fixtures__/ethereum-send')
const { mockEthereumSwapOrder, spyOnSwapSubmissionAndReports, SWAP_ORDER_ID } =
    await import('./__fixtures__/swapRouter')

const ETH_ASSET = evmChainOf('ethereum').nativeAsset.assetId

const evmContext: ChainContext = {
    getScope: () => ETH_SCOPE,
    getEndpoints: () => ({ mainnet: [RPC_URL] }),
    getPeraBackend: () => ({
        baseUrl: '',
        services: new Set(),
        isChainRefused: false,
    }),
    timeouts: { readMs: 1000, submitMs: 1000 },
    kms: kmsCore,
}

// The shipped table names no router yet, which is the fail-closed path.
const pinFixtureRouter = () => {
    const registered = swapChainAdapters.get('ethereum')
    const pinned = createEvmSwapAdapter(evmContext, evmChainOf('ethereum'), {
        routeContractsOf: () => [ROUTER],
    })
    vi.spyOn(registered, 'executeSwap').mockImplementation(pinned.executeSwap)
    vi.spyOn(registered, 'estimateSourceCost').mockImplementation(
        pinned.estimateSourceCost,
    )
}

const swapAsset = (
    scope: typeof ETH_SCOPE | typeof ALGO_SCOPE,
    assetId: string,
    unitName: string,
    decimals: number,
) => ({
    assetId,
    ref: { ...scope, assetId },
    name: unitName,
    unitName,
    decimals,
    verificationTier: 'verified',
    crossChainAssetGroup: null,
})

const ethereumQuote = (overrides: Partial<SwapQuote>): SwapQuote =>
    ({
        quoteId: 'quote-eth-1',
        provider: 'xo',
        routeKind: 'single-chain',
        amountOut: new Decimal(1),
        minimumAmountOut: new Decimal(1),
        amountInUsdValue: null,
        amountOutUsdValue: null,
        fees: [],
        priceImpact: null,
        expiresAt: null,
        fetchedAt: Date.now(),
        depositAddress: null,
        ...overrides,
    }) as SwapQuote

const tokenToEtherQuote = (): SwapQuote =>
    ethereumQuote({
        request: {
            sourceAsset: { ...ETH_SCOPE, assetId: TOKEN },
            destinationAsset: { ...ETH_SCOPE, assetId: ETH_ASSET },
            sourceAmount: new Decimal(TOKEN_UNITS.toString()),
            sourceAddress: SENDER,
            destinationAddress: SENDER,
            slippage: null,
        },
        assetIn: swapAsset(ETH_SCOPE, TOKEN, 'USDC', 6),
        assetOut: swapAsset(ETH_SCOPE, ETH_ASSET, 'ETH', 18),
        amountIn: new Decimal(TOKEN_UNITS.toString()),
    } as Partial<SwapQuote>)

const etherToAlgoQuote = (algoAddress: string): SwapQuote =>
    ethereumQuote({
        routeKind: 'cross-chain',
        request: {
            sourceAsset: { ...ETH_SCOPE, assetId: ETH_ASSET },
            destinationAsset: { ...ALGO_SCOPE, assetId: '0' },
            sourceAmount: new Decimal(WEI.toString()),
            sourceAddress: SENDER,
            destinationAddress: algoAddress,
            slippage: null,
        },
        assetIn: swapAsset(ETH_SCOPE, ETH_ASSET, 'ETH', 18),
        assetOut: swapAsset(ALGO_SCOPE, '0', 'ALGO', 6),
        amountIn: new Decimal(WEI.toString()),
    } as Partial<SwapQuote>)

const routerAsset = (assetId: string, unitName: string, decimals: number) => ({
    asset_id: assetId,
    name: unitName,
    unit_name: unitName,
    fraction_decimals: decimals,
    logo: null,
    verification_tier: 'verified',
    cross_chain_asset_group: null,
})

const tokenToEtherOffer = {
    quote_id: 'quote-eth-1',
    aggregator: 'xo-v4',
    provider: 'xo',
    source_asset: routerAsset(
        `eip155:1/erc20:${TOKEN.toLowerCase()}`,
        'USDC',
        6,
    ),
    destination_asset: routerAsset('eip155:1/slip44:60', 'ETH', 18),
    source_amount: TOKEN_UNITS.toString(),
    destination_amount_expected: '5000000000000000',
    destination_amount_minimum: '4900000000000000',
    source_amount_usd_value: null,
    destination_amount_usd_value: null,
    fees: [],
    funding_method: 'wallet_transaction',
    expires_at: null,
    deposit_address: null,
    extras: null,
}

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

const APPROVE_TX = encodeUnsignedEvmCall(
    TOKEN,
    encodeErc20Approve(ROUTER, TOKEN_UNITS),
)
const TOKEN_SWAP_TX = encodeUnsignedEvmCall(ROUTER, SWAP_DATA)
const ETHER_SWAP_TX = encodeUnsignedEvmCall(ROUTER, SWAP_DATA, WEI)

const lowerCased = (address?: Nullable<string>) => address?.toLowerCase()

const uint256 = (value: bigint) =>
    `0x${value.toString(16).padStart(64, '0')}` as const

/** A node that mines at once, and records what it was sent, in order. */
const fakeNode = (allowance = 0n, balance: `0x${string}` = NODE_BALANCE) => {
    const sent: ReturnType<typeof readRawEvmTransaction>[] = []
    server.use(
        ...evmRpcHandlers({
            rpcUrl: RPC_URL,
            responses: {
                eth_getBalance: balance,
                eth_call: uint256(allowance),
                eth_getTransactionCount: () => `0x${sent.length.toString(16)}`,
                eth_sendRawTransaction: params => {
                    const transaction = readRawEvmTransaction(
                        params[0] as `0x${string}`,
                    )
                    sent.push(transaction)
                    return transaction.hash
                },
                eth_getTransactionReceipt: params => {
                    const hash = params[0] as `0x${string}`
                    return sent.some(transaction => transaction.hash === hash)
                        ? evmTransactionReceipt({ transactionHash: hash })
                        : null
                },
            },
        }),
    )
    return sent
}

type HostApi = {
    execute: (quote: SwapQuote) => Promise<SwapExecutionOutcome>
    queryClient: QueryClient
}
let host: Nullable<HostApi> = null

const SwapHost = () => {
    const { execute } = useSwapExecution()
    const queryClient = useQueryClient()
    const { setPreference } = usePreferences()
    const prepared = useRef(false)
    useSwapOrderTracker()
    useEffect(() => {
        if (!prepared.current) {
            prepared.current = true
            setPreference('hasSeenTransactionRequestFAQ', true)
        }
        host = { execute, queryClient }
    }, [execute, queryClient, setPreference])
    return <SigningOverlays />
}

const SwapFormHost = () => (
    <>
        <SwapHost />
        <SwapForm scope={ETH_SCOPE} />
    </>
)

const swapDeeplinkRequirement = () =>
    capabilityRequirementForDeeplink({
        type: DeeplinkType.SWAP,
        target: { ...ETH_SCOPE },
    } as Parameters<typeof capabilityRequirementForDeeplink>[0])!

const selectTwoChainAccount = async () => {
    const signer = await seedAlgo25Signer()
    const account: WalletAccount = {
        ...signer,
        custody: ETHEREUM_SENDER.custody,
        chains: { ...signer.chains, ...ETHEREUM_SENDER.chains },
    }
    selectSender(account)
    return account
}

// Long enough for a remount's effects and their store writes to land.
const settleRender = () =>
    act(() => new Promise(resolve => setTimeout(resolve, 100)))

const startHost = async (): Promise<HostApi> => {
    renderWithNavigation(SwapHost, 'SwapHost')
    await waitFor(() => expect(host).not.toBeNull())
    return host!
}

/** Takes a token swap from the real form as far as the open confirmation. */
const openConfirmation = async () => {
    selectSender(ETHEREUM_SENDER)
    await seedSenderEther('10000000000000000000')
    await insertAssetHolding({
        accountAddress: SENDER,
        assetId: TOKEN,
        scope: ETH_SCOPE,
        amount: new Decimal('100000000'),
    })
    useSwapsStore.getState().setFromAsset(TOKEN)
    useSwapsStore.getState().setToAsset(ETH_ASSET)
    server.use(
        mockCreateSwapQuotes({ response: { results: [tokenToEtherOffer] } }),
    )
    mockEthereumSwapOrder([APPROVE_TX, TOKEN_SWAP_TX])
    const { reports } = spyOnSwapSubmissionAndReports()
    renderWithNavigation(SwapFormHost, 'SwapFormHost')
    await waitFor(() => expect(host).not.toBeNull())

    fireEvent.change(await screen.findByTestId('swap-pay-input'), {
        target: { value: '12.5' },
    })
    fireEvent.click(await findEnabledByTestId('swap-button', FORM_TIMEOUT))
    return { reports }
}

describe('Flow: Swap from an Ethereum account', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })
    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await seedEthereumAssets()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
        useSwapTrackingStore.getState().resetState()
        useSwapsStore.getState().resetState()
        await useRemoteConfigStore.persist.rehydrate()
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderKey)
        pinFixtureRouter()
    })
    afterEach(() => {
        host = null
        vi.restoreAllMocks()
        useRemoteConfigStore.getState().resetState()
    })

    it('Given an ERC-20 with no allowance, when the swap runs, then the approval is signed and sent first, then the swap, and both are reported', async () => {
        selectSender(ETHEREUM_SENDER)
        await seedSenderEther('10000000000000000000')
        const api = await startHost()
        const sent = fakeNode()
        mockEthereumSwapOrder([APPROVE_TX, TOKEN_SWAP_TX])
        const { reports } = spyOnSwapSubmissionAndReports()

        const outcome = await api.execute(tokenToEtherQuote())

        expect(outcome).toEqual({ kind: 'success' })
        expect(sent.map(({ to }) => lowerCased(to))).toEqual(
            [TOKEN, ROUTER].map(lowerCased),
        )
        expect(sent.map(({ nonce }) => nonce)).toEqual([0, 1])
        await waitFor(() => expect(reports).toHaveLength(1))
        expect(reports[0]).toEqual({
            status: 'sent',
            transactions: [
                {
                    chain: 'eip155:1',
                    tx_hash: sent[0].hash,
                    purpose: 'approval',
                },
                {
                    chain: 'eip155:1',
                    tx_hash: sent[1].hash,
                    purpose: 'swap',
                },
            ],
        })
    })

    it('Given an ERC-20 swap confirmed on the form, when it lands, then both transactions are sent and balances go stale', async () => {
        const sent = fakeNode()
        await openConfirmation()
        // Another account's entry: nothing observes it, so the mark stays readable.
        const balanceKey = getAccountBalancesQueryKey(RECEIVER, ETH_SCOPE)
        // Test clients default to gcTime 0, which would drop this unobserved entry.
        host!.queryClient.setQueryDefaults(balanceKey, { gcTime: Infinity })
        host!.queryClient.setQueryData(balanceKey, { seeded: true })

        fireEvent.click(
            await findEnabledByTestId('swap-confirm-slide', FORM_TIMEOUT),
        )

        await waitFor(() => expect(sent).toHaveLength(2), FORM_TIMEOUT)
        expect(sent.map(({ to }) => lowerCased(to))).toEqual(
            [TOKEN, ROUTER].map(lowerCased),
        )
        await waitFor(
            () =>
                expect(
                    host!.queryClient.getQueryState(balanceKey)?.isInvalidated,
                ).toBe(true),
            FORM_TIMEOUT,
        )
    })

    it('Given too little ether for the network fee and an approval to sign, when the confirmation opens, then it says so and cannot be confirmed', async () => {
        fakeNode(0n, '0x1')
        await openConfirmation()

        expect(
            await screen.findByTestId(
                'swap-confirm-insufficient-fee',
                undefined,
                FORM_TIMEOUT,
            ),
        ).toBeTruthy()
        expect(
            isElementDisabled(screen.getByTestId('swap-confirm-slide')),
        ).toBe(true)
    })

    it('Given too little ether for the network fee and no approval to sign, when the user confirms anyway, then nothing is signed and the order is cancelled', async () => {
        const sent = fakeNode(TOKEN_UNITS, '0x1')
        const { reports } = await openConfirmation()

        await screen.findByTestId(
            'swap-confirm-insufficient-fee',
            undefined,
            FORM_TIMEOUT,
        )
        fireEvent.click(
            await findEnabledByTestId('swap-confirm-slide', FORM_TIMEOUT),
        )

        await waitFor(
            () => expect(reports).toEqual([{ status: 'cancelled' }]),
            FORM_TIMEOUT,
        )
        expect(sent).toEqual([])
        expect(kmsCore.sign).not.toHaveBeenCalled()
    })

    it('Given an account on two chains, when it picks Ethereum on the swap screen, then the form stays on Ethereum', async () => {
        await selectTwoChainAccount()
        fakeNode()
        renderWithNavigation(SwapScreen, 'Swap')

        fireEvent.click(await screen.findByTestId('swap_source_chain'))
        fireEvent.click(
            await screen.findByTestId('swap_source_chain_row_ethereum'),
        )

        await waitFor(() =>
            expect(useSwapsStore.getState().sourceChainId).toBe('ethereum'),
        )
        await settleRender()
        expect(useSwapsStore.getState().sourceChainId).toBe('ethereum')
    })

    it('Given an allowance that covers the amount, when the swap runs, then only the swap is sent', async () => {
        selectSender(ETHEREUM_SENDER)
        await seedSenderEther('10000000000000000000')
        const api = await startHost()
        const sent = fakeNode(TOKEN_UNITS)
        mockEthereumSwapOrder([APPROVE_TX, TOKEN_SWAP_TX])
        spyOnSwapSubmissionAndReports()

        const outcome = await api.execute(tokenToEtherQuote())

        expect(outcome).toEqual({ kind: 'success' })
        expect(sent.map(({ to }) => lowerCased(to))).toEqual([
            lowerCased(ROUTER),
        ])
    })

    it('Given an order calling a contract the route never declared, when the swap runs, then nothing is signed and the order is cancelled', async () => {
        selectSender(ETHEREUM_SENDER)
        await seedSenderEther('10000000000000000000')
        const api = await startHost()
        const sent = fakeNode()
        mockEthereumSwapOrder([encodeUnsignedEvmCall(TOKEN, SWAP_DATA)])
        const { reports } = spyOnSwapSubmissionAndReports()

        const outcome = await api.execute(tokenToEtherQuote())

        expect(outcome).toMatchObject({ kind: 'error', phase: 'prepare' })
        expect(sent).toEqual([])
        expect(kmsCore.sign).not.toHaveBeenCalled()
        await waitFor(() => expect(reports).toEqual([{ status: 'cancelled' }]))
    })

    it("Given ether swapped into the account's own Algorand address, when the swap runs, then the order is tracked until completed", async () => {
        const account = await selectTwoChainAccount()
        useSwapsStore.getState().setSourceChainId('ethereum')
        await seedSenderEther('10000000000000000000')
        const api = await startHost()
        const sent = fakeNode()
        mockEthereumSwapOrder([ETHER_SWAP_TX])
        spyOnSwapSubmissionAndReports()
        server.use(mockFetchSwapOrder({ order: routerOrder('in_progress') }))

        const algoAddress = account.chains.algorand?.address ?? ''
        const outcome = await api.execute(etherToAlgoQuote(algoAddress))

        expect(outcome).toEqual({ kind: 'success' })
        expect(sent[0].value).toBe(WEI)
        expect(useSwapTrackingStore.getState().orders[SWAP_ORDER_ID]).toEqual(
            expect.objectContaining({
                sourceAddress: SENDER,
                destinationAddress: algoAddress,
                sourceScope: ETH_SCOPE,
                destinationScope: ALGO_SCOPE,
            }),
        )

        server.use(mockFetchSwapOrder({ order: routerOrder('completed') }))
        await api.queryClient.refetchQueries({ queryKey: ['swaps', 'order'] })

        await waitFor(() =>
            expect(
                useSwapTrackingStore.getState().orders[SWAP_ORDER_ID].status,
            ).toBe('completed'),
        )
    })

    it('Given no override, then an Ethereum account can reach swap', () => {
        selectSender(ETHEREUM_SENDER)
        panelAccount.current = ETHEREUM_SENDER

        const { result: buttons } = renderHook(
            () => useAssetActionButtons(ETHEREUM_SENDER, 'ethereum'),
            { wrapper: createQueryClientWrapper() },
        )
        const { result: panel } = renderHook(() => useButtonPanel(), {
            wrapper: createQueryClientWrapper(),
        })

        const { result: isDeeplinkAllowed } = renderHook(
            () => useCapabilityCheck(),
            { wrapper: createQueryClientWrapper() },
        )

        expect(buttons.current.canSwap).toBe(true)
        expect(panel.current.canSwap).toBe(true)
        expect(isDeeplinkAllowed.current(swapDeeplinkRequirement())).toBe(true)
    })

    it('Given the remote override turns swap off, then an Ethereum account has no way into it', () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride(
                chainOverridesKey('ethereum'),
                JSON.stringify({ capabilities: { swap: false } }),
            )
        selectSender(ETHEREUM_SENDER)
        panelAccount.current = ETHEREUM_SENDER

        const { result: signers } = renderHook(() => useSwapSigningAccounts(), {
            wrapper: createQueryClientWrapper(),
        })
        const { result: isDeeplinkAllowed } = renderHook(
            () => useCapabilityCheck(),
            { wrapper: createQueryClientWrapper() },
        )
        const { result: buttons } = renderHook(
            () => useAssetActionButtons(ETHEREUM_SENDER, 'ethereum'),
            { wrapper: createQueryClientWrapper() },
        )

        const { result: panel } = renderHook(() => useButtonPanel(), {
            wrapper: createQueryClientWrapper(),
        })

        expect(signers.current).toEqual([])
        expect(buttons.current.canSwap).toBe(false)
        expect(panel.current.canSwap).toBe(false)
        expect(getProvider().chains.capabilities('ethereum').swap).toBe(false)
        expect(isDeeplinkAllowed.current(swapDeeplinkRequirement())).toBe(false)
    })
})
