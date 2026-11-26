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

// The Swap History chips and See all across chains: Ethereum same-chain and
// cross-chain swaps sit beside Algorand ones, newest first. A See all row opens
// its swap's transaction details. EVM-only swaps are readable only when device
// registration sends the wallet's EVM addresses.

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
import { http, HttpResponse } from 'msw'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'

const RPC_URL = 'https://mainnet.rpc.test/'

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
        // History is keyed by the deployment's device id; the backend mock
        // only answers the deployment of a scope through `peraDeploymentOf`.
        deploymentOf: (scope: Parameters<typeof withBackend.deploymentOf>[0]) =>
            scope === null
                ? null
                : (withBackend.peraDeploymentOf(scope) ?? null),
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : withBackend.chainEndpointsFor(chainId),
    }
})

// The router is reached through the chain's Pera deployment. The integration
// setup loads the query client before this file's config mock exists, and the
// client reads its deployments once, so everything under test is loaded afresh,
// the test theme the setup installed included. The fixtures keep the server the
// setup is listening on.
vi.resetModules()
vi.doMock('@test-utils/msw-server', () => ({ server }))
// The setup's navigator mocks were evaluated before the reset, so left alone
// a row's `navigate` reaches a different copy of the navigator state.
vi.doMock(
    '@react-navigation/native',
    () => import('@test-utils/test-navigator'),
)
vi.doMock('@react-navigation/native-stack', async () => ({
    createNativeStackNavigator: (await import('@test-utils/test-navigator'))
        .createNativeStackNavigator,
}))
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { fireEvent, screen, waitFor, within } =
    await import('@testing-library/react')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { useDeviceStore } = await import('@perawallet/wallet-core-device')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { useSwapsStore } = await import('@perawallet/wallet-core-swaps')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { TransactionDetailsScreen } = await import('@modules/signing/routes')
const { evmHistoryItem } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { useBottomSheetStore } = await import('@modules/bottom-sheet')
const { SwapPairHistoryWidget } =
    await import('@modules/swap/components/SwapPairHistoryWidget')
const { SwapHistoryList } =
    await import('@modules/swap/components/SwapHistoryList')
const { ETH_ADDRESS, ETH_SCOPE, ALGO_SCOPE, TWO_CHAIN_ACCOUNT } =
    await import('./__fixtures__/multichainHoldings')
const { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } =
    await import('./__fixtures__/onboarding')
const { ALGORAND_MAINNET_CAIP2 } = await import('./__fixtures__/swapRouter')

const FORM_TIMEOUT = { timeout: 8000 }
const TEST_DEVICE_ID = 'device-swap-history-1'

const MAIN: WalletAccount = { ...TWO_CHAIN_ACCOUNT, id: 'main', name: 'Main' }
const SAVINGS: WalletAccount = {
    id: 'savings',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: HD_TEST_ADDRESS, keyPairId: 's-key' } },
    name: 'Savings',
}

const ETH_CAIP10 = `eip155:1:${ETH_ADDRESS}`
const MAIN_ALGO_CAIP10 = `${ALGORAND_MAINNET_CAIP2}:${ALGO25_TEST_ADDRESS}`
const SAVINGS_ALGO_CAIP10 = `${ALGORAND_MAINNET_CAIP2}:${HD_TEST_ADDRESS}`

const ETH_ID = 'eip155:1/slip44:60'
const USDC_ETH_ID = 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const ALGO_ID = `${ALGORAND_MAINNET_CAIP2}/asa:0`
const USDC_ALGO_ID = `${ALGORAND_MAINNET_CAIP2}/asa:31566704`
const SWAP_HASH = `0x${'aa'.repeat(32)}`
const COUNTERPARTY = '0x1111111111111111111111111111111111111111'

const routerAsset = (assetId: string, unitName: string, decimals: number) => ({
    asset_id: assetId,
    name: unitName,
    unit_name: unitName,
    fraction_decimals: decimals,
    logo: null,
    verification_tier: 'verified',
    cross_chain_asset_group: null,
})

const ETH_ASSET = routerAsset(ETH_ID, 'ETH', 18)
const USDC_ETH_ASSET = routerAsset(USDC_ETH_ID, 'USDC', 6)
const ALGO_ASSET = routerAsset(ALGO_ID, 'ALGO', 6)
const USDC_ALGO_ASSET = routerAsset(USDC_ALGO_ID, 'USDC', 6)

const order = (
    orderId: string,
    createdAt: string,
    sourceAccount: string,
    source: ReturnType<typeof routerAsset>,
    destination: ReturnType<typeof routerAsset>,
    transactions: { chain: string; tx_hash: string; role: string }[] = [],
) => ({
    order_id: orderId,
    aggregator: 'xo-v4',
    provider: 'xo',
    status: 'completed' as const,
    funding_method: 'wallet_transaction',
    source_account: sourceAccount,
    destination_account: sourceAccount,
    source_asset: source,
    destination_asset: destination,
    source_amount: '1000000',
    destination_amount_expected: '2000000',
    destination_amount_minimum: null,
    destination_amount_received: '2000000',
    source_amount_usd_value: null,
    destination_amount_usd_value: null,
    transactions,
    created_at: createdAt,
    updated_at: createdAt,
    expires_at: null,
})

// Newest first, as the router lists them.
const ORDERS = [
    order(
        'eth-usdc-to-eth',
        '2026-11-25T21:50:00Z',
        ETH_CAIP10,
        USDC_ETH_ASSET,
        ETH_ASSET,
        [{ chain: 'eip155:1', tx_hash: SWAP_HASH, role: 'swap' }],
    ),
    order(
        'eth-eth-to-usdc',
        '2026-11-25T21:40:00Z',
        ETH_CAIP10,
        ETH_ASSET,
        USDC_ETH_ASSET,
    ),
    order(
        'cross-algo-to-eth',
        '2026-11-25T21:30:00Z',
        MAIN_ALGO_CAIP10,
        ALGO_ASSET,
        ETH_ASSET,
    ),
    order(
        'savings-algo-to-usdc',
        '2026-11-25T21:20:00Z',
        SAVINGS_ALGO_CAIP10,
        ALGO_ASSET,
        USDC_ALGO_ASSET,
    ),
]

const requestedAccounts: string[][] = []

// The router answers for the accounts the request names, the way its ownership check does.
const serveHistory = () =>
    server.use(
        http.get('*/api/v4/swap/history/', ({ request }) => {
            const accounts = (
                new URL(request.url).searchParams.get('accounts') ?? ''
            )
                .split(',')
                .filter(Boolean)
            requestedAccounts.push(accounts)
            const named = new Set(accounts.map(id => id.toLowerCase()))
            return HttpResponse.json({
                next: null,
                results: ORDERS.filter(item =>
                    named.has(item.source_account.toLowerCase()),
                ),
            })
        }),
    )

const HistoryHost = () => (
    <>
        <SwapPairHistoryWidget scope={ALGO_SCOPE} />
        <SwapHistoryList onClose={() => undefined} />
    </>
)

const chipOrder = () =>
    screen.findAllByTestId(/^swap-pair-chip-/, {}, FORM_TIMEOUT)

describe('Flow: Swap History across chains', () => {
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        requestedAccounts.length = 0
        useAccountsStore.getState().setAccounts([MAIN, SAVINGS])
        useAccountsStore.getState().setSelectedAccountId(MAIN.id)
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('live', TEST_DEVICE_ID)
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        useSwapsStore.getState().resetState()
        await useRemoteConfigStore.persist.rehydrate()
        await resetTestDatabase()
        serveHistory()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        useRemoteConfigStore.getState().resetState()
    })

    it('Given device registration sends EVM addresses, when the Swap screen loads, then the chips and See all list every chain newest first, each with its payer and no network badge', async () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)

        renderWithNavigation(HistoryHost, 'Swap')

        const chips = await chipOrder()
        expect(chips).toHaveLength(4)
        const [usdcToEth, ethToUsdc, crossChain, savings] = chips
        expect(within(usdcToEth).getByText('USDC to ETH')).toBeTruthy()
        expect(within(usdcToEth).getByText('Main')).toBeTruthy()
        expect(within(ethToUsdc).getByText('ETH to USDC')).toBeTruthy()
        expect(within(crossChain).getByText('ALGO to ETH')).toBeTruthy()
        expect(within(savings).getByText('Savings')).toBeTruthy()

        const rows = await screen.findAllByTestId(
            /^swap-history-item-/,
            {},
            FORM_TIMEOUT,
        )
        expect(rows.map(row => row.getAttribute('data-testid'))).toEqual(
            ORDERS.map(item => `swap-history-item-${item.order_id}`),
        )
        for (const element of [...chips, ...rows]) {
            expect(
                within(element).queryByTestId(/^chain_avatar_badge_/),
            ).toBeNull()
        }
        expect(
            requestedAccounts.some(accounts =>
                accounts.some(id => id.startsWith('eip155:1:')),
            ),
        ).toBe(true)
    })

    it('Given an EVM swap the router lists with its transaction, when its See all row is pressed, then the real details screen shows that transaction, read from the history of the account that paid', async () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)
        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [ETH_ADDRESS]: [
                        [
                            evmHistoryItem({
                                hash: SWAP_HASH,
                                block_time: '2026-11-25T21:50:00Z',
                                from: ETH_ADDRESS,
                                to: COUNTERPARTY,
                                value: '1000000000000000000',
                            }),
                        ],
                    ],
                },
            }),
        )
        renderWithNavigation(HistoryHost, 'Swap', {
            additionalScreens: [
                {
                    name: 'TransactionDetails',
                    component: TransactionDetailsScreen,
                },
            ],
        })

        const listed = await screen.findByTestId(
            'swap-history-item-eth-usdc-to-eth',
            {},
            FORM_TIMEOUT,
        )
        const unlisted = await screen.findByTestId(
            'swap-history-item-eth-eth-to-usdc',
            {},
            FORM_TIMEOUT,
        )
        expect(unlisted.getAttribute('aria-disabled')).toBe('true')
        fireEvent.click(listed)

        const sender = await screen.findByTestId(
            'transaction_detail_from',
            {},
            FORM_TIMEOUT,
        )
        expect(sender.textContent).toContain('Main')
        expect(screen.getByText('Ethereum')).toBeTruthy()
        expect(screen.getByText('0xaaa...aaaaa')).toBeTruthy()
    })

    it('Given a cross-chain pair, when its chip is pressed, then the swap form restores the destination network too', async () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)
        renderWithNavigation(HistoryHost, 'Swap')

        const [, , crossChain] = await chipOrder()
        fireEvent.click(crossChain)

        await waitFor(() =>
            expect(useSwapsStore.getState().toAssetScope).toEqual(ETH_SCOPE),
        )
        expect(useSwapsStore.getState().sourceChainId).toBe('algorand')
    })

    it('Given device registration leaves out EVM addresses, when the Swap screen loads, then no EVM account is asked about and the Algorand-paid swaps still show', async () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', false)

        renderWithNavigation(HistoryHost, 'Swap')

        const chips = await chipOrder()
        expect(chips).toHaveLength(2)
        expect(within(chips[0]).getByText('ALGO to ETH')).toBeTruthy()
        expect(within(chips[1]).getByText('ALGO to USDC')).toBeTruthy()
        expect(requestedAccounts.length).toBeGreaterThan(0)
        expect(
            requestedAccounts.flat().some(id => id.startsWith('eip155:')),
        ).toBe(false)
    })
})
