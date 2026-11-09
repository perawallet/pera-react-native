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

// An Ethereum account's History reads the Pera backend's records page by page,
// since Ethereum keeps no cached history rows, and a refused read offers a
// retry rather than a skeleton that never resolves. Copy is asserted by key:
// this project renders i18n keys.

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
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { EvmHistoryItemResponse } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

// The test i18n drops params, which would hide the row label the hero wraps;
// the suffix has its own spec.
vi.mock('@modules/signing/hooks/useTransactionHeroTitle', () => ({
    useTransactionHeroTitle:
        () =>
        ({ key }: { key: string }) =>
            key,
}))

// Whether the Pera backend serves Ethereum NFT metadata, set per test.
const nftService = vi.hoisted(() => ({ isServed: false }))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        // An entry's calldata is read from the node, which the test build has no URL for.
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: ['https://mainnet.rpc.test/'] }
                : withBackend.chainEndpointsFor(chainId),
        // The chain context reads its services here and the request layer from
        // `hasPeraService`, so both follow the switch.
        hasPeraService: (
            scope: Parameters<typeof withBackend.hasPeraService>[0],
            service: Parameters<typeof withBackend.hasPeraService>[1],
        ) =>
            (scope.chainId === 'ethereum' &&
                service === 'nfts' &&
                nftService.isServed) ||
            withBackend.hasPeraService(scope, service),
        peraServicesFor: (
            scope: Parameters<typeof withBackend.peraServicesFor>[0],
        ) => {
            const services = withBackend.peraServicesFor(scope)
            return scope.chainId === 'ethereum' && nftService.isServed
                ? new Set([...services, 'nfts' as const])
                : services
        },
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
// The setup's navigator mocks were first evaluated before the reset, so left
// alone `useNavigation` and the stack navigator can end up on different copies
// of the navigator state, and a screen's `navigate` reaches nothing.
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
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { evmHistoryItem, evmNftTransferLeg, evmRpcHandlers, evmRpcTransaction } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const {
    nativeAssetFor,
    PeraAssetType,
    PeraAssetVerificationTier,
    upsertAssets,
} = await import('@perawallet/wallet-core-assets')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { setCapabilityOverrides } =
    await import('@test-utils/capability-overrides')
const { TransactionDetailsScreen } = await import('@modules/signing/routes')
const { useWebViewStore } = await import('@modules/webview')
const { closestPressable } = await import('@test-utils/rnw')
const { useRoute } = await import('@react-navigation/native')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { evmNftItem, peraEvmAssetHandlers } =
    await import('@packages/chain-ethereum/src/assets/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { createTestQueryClient, getTestTheme } =
    await import('@test-utils/render')
const { QueryClientProvider } = await import('@tanstack/react-query')
const { ThemeProvider } = await import('@rneui/themed')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountHistory } =
    await import('@modules/accounts/components/AccountHistory/AccountHistory')
const { useAccountHistory } =
    await import('@modules/accounts/components/AccountHistory/useAccountHistory')

const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const COUNTERPARTY = '0x1111111111111111111111111111111111111111'

const ETH_ACCOUNT: WalletAccount = {
    id: 'eth-watch',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ETH_ADDRESS } },
    name: 'Ethereum watch',
}

const hashOf = (n: number) => `0x${String(n).padStart(64, '0')}`

const received = (n: number, blockTime: string): EvmHistoryItemResponse =>
    evmHistoryItem({
        hash: hashOf(n),
        block_time: blockTime,
        from: COUNTERPARTY,
        to: ETH_ADDRESS,
        value: '1000000000000000000',
    })

const rowIds = () =>
    screen
        .queryAllByTestId(/^transaction_row_0x/)
        .map(row => row.getAttribute('data-testid'))

describe('Flow: History on an Ethereum account', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountsStore.getState().setAccounts([ETH_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ETH_ACCOUNT.id)
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    const serveTwoPages = () =>
        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [ETH_ADDRESS]: [
                        [
                            received(3, '2026-01-03T00:00:00Z'),
                            received(2, '2026-01-02T00:00:00Z'),
                        ],
                        [received(1, '2026-01-01T00:00:00Z')],
                    ],
                },
            }),
        )

    it('Given mined transactions, when History opens, then they list newest first', async () => {
        serveTwoPages()

        renderWithNavigation(AccountHistory, 'AccountHistory')

        await waitFor(
            () =>
                expect(rowIds()).toEqual([
                    `transaction_row_${hashOf(3)}`,
                    `transaction_row_${hashOf(2)}`,
                ]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen.queryByText('asset_details.transaction_list.empty_body'),
        ).toBeNull()
    })

    it('Given a second page, when the list reaches its end, then the older page follows', async () => {
        serveTwoPages()
        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ThemeProvider theme={getTestTheme()}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </ThemeProvider>
        )
        const { result } = renderHook(() => useAccountHistory(), { wrapper })
        const recordIds = () =>
            result.current.rows.flatMap(row =>
                row.kind === 'record' ? [row.record.id] : [],
            )

        await waitFor(
            () => expect(recordIds()).toEqual([hashOf(3), hashOf(2)]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(result.current.hasNextPage).toBe(true)

        // What the list's onEndReached calls; jsdom has no layout to scroll.
        act(() => result.current.handleLoadMore())

        await waitFor(
            () =>
                expect(recordIds()).toEqual([hashOf(3), hashOf(2), hashOf(1)]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    it('Given the history service refuses, when History opens, then it offers a retry that lists the history once it answers', async () => {
        server.use(...peraEvmHistoryHandlers({ history: 503 }))

        renderWithNavigation(AccountHistory, 'AccountHistory')

        await screen.findByText('common.error.title', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [ETH_ADDRESS]: [[received(1, '2026-01-01T00:00:00Z')]],
                },
            }),
        )
        fireEvent.click(screen.getByText('common.retry.label'))

        await waitFor(
            () => expect(rowIds()).toEqual([`transaction_row_${hashOf(1)}`]),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
    })

    describe('opening an entry', () => {
        const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
        const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        const SPENDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
        const APPROVE_HASH = hashOf(11)
        const REVOKE_HASH = hashOf(12)
        const nodeReads: string[] = []

        const approval = (hash: string) =>
            evmHistoryItem({
                hash,
                block_time: '2026-01-05T00:00:00Z',
                from: ETH_ADDRESS,
                to: USDC.toLowerCase(),
                value: '0',
                method: 'approve',
                fee: '46000000000000',
                balance_impacts: [
                    {
                        asset_id: 'eip155:1/slip44:60',
                        amount: '-46000000000000',
                    },
                ],
            })
        // approve(SPENDER, amount), hard-coded because viem isn't an apps/mobile dependency.
        const approveData = (amount: string): `0x${string}` =>
            `0x095ea7b3${SPENDER.slice(2).toLowerCase().padStart(64, '0')}${amount.padStart(64, '0')}`
        const calldata = new Map([
            [APPROVE_HASH, approveData('f'.repeat(64))],
            [REVOKE_HASH, approveData('0')],
        ])

        const serveApprovals = () => {
            nodeReads.length = 0
            server.use(
                ...peraEvmHistoryHandlers({
                    history: {
                        [ETH_ADDRESS]: [
                            [
                                {
                                    ...approval(REVOKE_HASH),
                                    block_time: '2026-01-06T00:00:00Z',
                                },
                                approval(APPROVE_HASH),
                            ],
                        ],
                    },
                }),
                ...evmRpcHandlers({
                    responses: {
                        eth_getTransactionByHash: params => {
                            const hash = String(params[0])
                            nodeReads.push(hash)
                            return evmRpcTransaction({
                                hash: hash as `0x${string}`,
                                from: ETH_ADDRESS as `0x${string}`,
                                to: USDC,
                                input: calldata.get(hash),
                            })
                        },
                    },
                }),
            )
        }

        const SWAP_HASH = hashOf(14)
        const UNKNOWN_TOKEN = '0x1111111111111111111111111111111111111112'
        const OTHER_TOKEN = '0x1111111111111111111111111111111111111113'
        const swapRow = (
            overrides: Parameters<typeof evmHistoryItem>[0] = {},
        ) =>
            evmHistoryItem({
                hash: SWAP_HASH,
                block_time: '2026-01-08T00:00:00Z',
                from: ETH_ADDRESS,
                to: COUNTERPARTY,
                value: '0',
                method: 'swapExactTokensForTokens',
                token_transfers: [
                    {
                        asset_id: `eip155:1/erc20:${UNKNOWN_TOKEN}`,
                        contract: UNKNOWN_TOKEN,
                        from: ETH_ADDRESS,
                        to: COUNTERPARTY,
                        value: '5',
                        token_name: null,
                        token_symbol: null,
                        token_decimals: null,
                    },
                    {
                        asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
                        contract: USDC.toLowerCase(),
                        from: COUNTERPARTY,
                        to: ETH_ADDRESS,
                        value: '9',
                        token_name: null,
                        token_symbol: null,
                        token_decimals: null,
                    },
                ],
                balance_impacts: [
                    {
                        asset_id: `eip155:1/erc20:${UNKNOWN_TOKEN}`,
                        amount: '-5',
                    },
                    {
                        asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
                        amount: '9',
                    },
                ],
                ...overrides,
            })
        const rpcRequests: string[] = []
        const serveSwap = (input: `0x${string}`, row = swapRow()) => {
            nodeReads.length = 0
            rpcRequests.length = 0
            server.use(
                ...peraEvmHistoryHandlers({
                    history: { [ETH_ADDRESS]: [[row]] },
                }),
                ...evmRpcHandlers({
                    responses: {
                        eth_getTransactionByHash: params => {
                            nodeReads.push(String(params[0]))
                            return evmRpcTransaction({
                                hash: SWAP_HASH as `0x${string}`,
                                from: ETH_ADDRESS as `0x${string}`,
                                to: COUNTERPARTY as `0x${string}`,
                                input,
                            })
                        },
                    },
                }),
            )
        }
        const trackRpc = ({ request }: { request: Request }) => {
            if (new URL(request.url).hostname === 'mainnet.rpc.test') {
                rpcRequests.push(request.url)
            }
        }
        beforeEach(() => server.events.on('request:start', trackRpc))
        afterEach(() => server.events.removeListener('request:start', trackRpc))

        // Stands in for the tab bar, so the route an NFT opens can be read.
        const TabBarProbe = () => (
            <div data-testid='tab_bar_route'>
                {JSON.stringify(useRoute().params)}
            </div>
        )

        const renderHistory = () =>
            renderWithNavigation(AccountHistory, 'AccountHistory', {
                additionalScreens: [
                    {
                        name: 'TransactionDetails',
                        component: TransactionDetailsScreen,
                    },
                    { name: 'TabBar', component: TabBarProbe },
                ],
            })

        const openRow = async (hash: string) => {
            const row = await screen.findByTestId(
                `transaction_row_${hash}`,
                undefined,
                {
                    timeout: SLOW_WAIT_TIMEOUT_MS,
                },
            )
            fireEvent.click(closestPressable(row) ?? row)
        }

        beforeEach(async () => {
            await upsertAssets({
                items: [
                    nativeAssetFor('ethereum'),
                    {
                        ...nativeAssetFor('ethereum'),
                        assetId: USDC,
                        name: 'USD Coin',
                        unitName: 'USDC',
                        decimals: 6,
                    },
                ],
                scope: SCOPE,
            })
        })

        afterEach(() => {
            useRemoteConfigStore.getState().resetState()
            nftService.isServed = false
        })

        const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7'
        const AUSDT = '0x23878914efe38d27c4d67ab83ed1b93a74d4086a'
        const ROUTER = '0x66a9893cc07d91d95644aedd05d03f95e1dba8af'
        const AAVE_POOL = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'
        const POOL = '0x00000000000000000000000000000000000000ee'
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
        const ROUTER_SWAP_HASH = hashOf(31)
        const USDT_APPROVE_HASH = hashOf(32)
        const SUPPLY_HASH = hashOf(33)
        const GAS = '21000000000000'
        const ETH_ASSET_ID = 'eip155:1/slip44:60'
        const erc20Leg = (
            token: string,
            symbol: string,
            from: string,
            to: string,
        ) => ({
            asset_id: `eip155:1/erc20:${token}`,
            contract: token,
            from,
            to,
            value: '2230000',
            token_name: symbol,
            token_symbol: symbol,
            token_decimals: 6,
        })
        // The QA account's rows: a router swap, a USDT approve and an Aave supply.
        const serveActionRows = () => {
            nodeReads.length = 0
            rpcRequests.length = 0
            server.use(
                ...peraEvmHistoryHandlers({
                    history: {
                        [ETH_ADDRESS]: [
                            [
                                evmHistoryItem({
                                    hash: SUPPLY_HASH,
                                    block_time: '2026-01-11T00:00:00Z',
                                    from: ETH_ADDRESS,
                                    to: AAVE_POOL,
                                    value: '0',
                                    method: 'supply',
                                    fee: GAS,
                                    token_transfers: [
                                        erc20Leg(
                                            USDT,
                                            'USDT',
                                            ETH_ADDRESS,
                                            AUSDT,
                                        ),
                                        erc20Leg(
                                            AUSDT,
                                            'aEthUSDT',
                                            ZERO_ADDRESS,
                                            ETH_ADDRESS,
                                        ),
                                    ],
                                    balance_impacts: [
                                        {
                                            asset_id: ETH_ASSET_ID,
                                            amount: `-${GAS}`,
                                        },
                                        {
                                            asset_id: `eip155:1/erc20:${USDT}`,
                                            amount: '-2230000',
                                        },
                                        {
                                            asset_id: `eip155:1/erc20:${AUSDT}`,
                                            amount: '2230000',
                                        },
                                    ],
                                }),
                                evmHistoryItem({
                                    hash: USDT_APPROVE_HASH,
                                    block_time: '2026-01-10T00:00:00Z',
                                    from: ETH_ADDRESS,
                                    to: USDT,
                                    value: '0',
                                    method: 'approve',
                                    fee: GAS,
                                    balance_impacts: [
                                        {
                                            asset_id: ETH_ASSET_ID,
                                            amount: `-${GAS}`,
                                        },
                                    ],
                                }),
                                evmHistoryItem({
                                    hash: ROUTER_SWAP_HASH,
                                    block_time: '2026-01-09T00:00:00Z',
                                    from: ETH_ADDRESS,
                                    to: ROUTER,
                                    value: '1143000000000000',
                                    method: 'execute',
                                    fee: GAS,
                                    token_transfers: [
                                        erc20Leg(
                                            USDT,
                                            'USDT',
                                            POOL,
                                            ETH_ADDRESS,
                                        ),
                                    ],
                                    balance_impacts: [
                                        {
                                            asset_id: ETH_ASSET_ID,
                                            amount: '-1164000000000000',
                                        },
                                        {
                                            asset_id: `eip155:1/erc20:${USDT}`,
                                            amount: '2230000',
                                        },
                                    ],
                                }),
                            ],
                        ],
                    },
                }),
                ...evmRpcHandlers({
                    responses: {
                        eth_getTransactionByHash: params => {
                            nodeReads.push(String(params[0]))
                            return null
                        },
                    },
                }),
            )
        }
        // The stored asset facts resolve after the row mounts, so wait for the amount too.
        const rowText = async (hash: string, settled: RegExp = /./) => {
            await waitFor(
                () =>
                    expect(
                        screen.getByTestId(`transaction_row_${hash}`)
                            .textContent,
                    ).toMatch(settled),
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
            return (
                screen.getByTestId(`transaction_row_${hash}`).textContent ?? ''
            )
        }

        describe('with contractDecoding on', () => {
            beforeEach(() => {
                setCapabilityOverrides({ contractDecoding: true }, 'ethereum')
            })

            it('Given approvals in History, when it lists, then each is named as an approval of its token and the node is not asked', async () => {
                serveApprovals()

                renderHistory()

                await waitFor(
                    () =>
                        expect(rowIds()).toEqual([
                            `transaction_row_${REVOKE_HASH}`,
                            `transaction_row_${APPROVE_HASH}`,
                        ]),
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(
                    screen.getAllByText('transactions.list_item.approve_asset'),
                ).toHaveLength(2)
                expect(nodeReads).toEqual([])
            })

            it('Given an unlimited USDC approval, when its row is opened, then it reads as an approval to its spender marked Unlimited, with its gas still shown', async () => {
                serveApprovals()
                renderHistory()

                await openRow(APPROVE_HASH)

                await waitFor(
                    () =>
                        expect(
                            screen.getAllByTestId(
                                'message-signing-spend-approval-warning',
                            ),
                        ).not.toHaveLength(0),
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(
                    screen.getAllByText('transactions.list_item.approve_asset'),
                ).not.toHaveLength(0)
                expect(
                    screen.getAllByText('signing.spend_approval.unlimited'),
                ).not.toHaveLength(0)
                expect(
                    screen.getByTestId('transaction_detail_fee'),
                ).toBeTruthy()
                expect(nodeReads).toEqual([APPROVE_HASH])
            })

            it('Given a call neither the decoder nor History can name, when its row is opened, then it keeps the function name and balance changes and says the call is not decoded', async () => {
                // Two tokens out and one in: no swap shape for History to name.
                serveSwap(
                    '0x38ed1739',
                    swapRow({
                        balance_impacts: [
                            ...swapRow().balance_impacts,
                            {
                                asset_id: `eip155:1/erc20:${OTHER_TOKEN}`,
                                amount: '-3',
                            },
                        ],
                    }),
                )
                renderHistory()

                await openRow(SWAP_HASH)

                await screen.findByTestId(
                    'ethereum_record_undecoded_warning',
                    undefined,
                    {
                        timeout: SLOW_WAIT_TIMEOUT_MS,
                    },
                )
                expect(nodeReads).toEqual([SWAP_HASH])
                expect(
                    screen.getByText(
                        'transactions.list_item.interpreted_title',
                    ),
                ).toBeTruthy()
                expect(
                    screen.queryByText(
                        'transactions.list_item.contract_interaction',
                    ),
                ).toBeNull()
                expect(
                    screen.getByTestId('ethereum_record_amount_1'),
                ).toBeTruthy()
            })

            it("Given the QA account's rows, when History lists them, then each says what it did with its own amounts and the approval carries a fee instead of a red ETH line", async () => {
                serveActionRows()

                renderHistory()

                const swap = await rowText(ROUTER_SWAP_HASH, /ETH/)
                expect(swap).toContain('transactions.list_item.swap_pair')
                expect(swap).toContain(
                    'transactions.list_item.interpreted_title',
                )
                expect(swap).toMatch(/-.*0\.001143.*ETH/)
                expect(swap).toMatch(/\+.*2\.23.*USDT/)
                expect(swap).not.toContain('transactions.common.fee')

                const approve = await rowText(USDT_APPROVE_HASH)
                expect(approve).toContain(
                    'transactions.list_item.approve_asset',
                )
                expect(approve).toContain('transactions.common.fee')
                expect(approve).not.toContain('-')
                expect(
                    within(
                        screen.getByTestId(
                            `transaction_row_${USDT_APPROVE_HASH}`,
                        ),
                    ).queryByText(/ETH/),
                ).not.toBeNull()

                const supply = await rowText(SUPPLY_HASH)
                expect(supply).toContain('transactions.list_item.supply')
                expect(supply).toMatch(/-.*2\.23.*USDT/)
                expect(supply).toMatch(/\+.*2\.23.*aEthUSDT/)
                expect(supply).not.toContain(
                    'transactions.list_item.more_impacts',
                )
                expect(supply).not.toContain('transactions.common.fee')
            })

            it('Given a named swap row, when it is opened, then the page carries the same title', async () => {
                serveActionRows()
                renderHistory()
                await rowText(ROUTER_SWAP_HASH)

                await openRow(ROUTER_SWAP_HASH)

                await screen.findByTestId('transaction_detail_fee', undefined, {
                    timeout: SLOW_WAIT_TIMEOUT_MS,
                })
                expect(
                    screen.getAllByText('transactions.list_item.swap_pair')
                        .length,
                ).toBeGreaterThan(0)
                expect(
                    screen.queryByText('transactions.list_item.contract_call'),
                ).toBeNull()
                expect(screen.queryByTestId('ethereum_record_asset')).toBeNull()
            })

            // A received NFT as the backend sends it: transfer log only, sender's gas still reported.
            const serveNftReceive = (hash: string) => {
                nodeReads.length = 0
                server.use(
                    ...peraEvmHistoryHandlers({
                        history: {
                            [ETH_ADDRESS]: [
                                [
                                    evmHistoryItem({
                                        hash,
                                        block_time: '2026-01-07T00:00:00Z',
                                        fee: '1950509299200',
                                        nft_transfers: [
                                            evmNftTransferLeg({
                                                from: COUNTERPARTY,
                                                to: ETH_ADDRESS,
                                            }),
                                        ],
                                    }),
                                ],
                            ],
                        },
                    }),
                    ...evmRpcHandlers({
                        responses: {
                            eth_getTransactionByHash: params => {
                                nodeReads.push(String(params[0]))
                                return null
                            },
                        },
                    }),
                )
            }

            it('Given an NFT received that the wallet has stored, when its row is opened, then it reads as a receive from the sender, named and pictured by its metadata, with no fee and no node read', async () => {
                const RECEIVE_HASH = hashOf(13)
                serveNftReceive(RECEIVE_HASH)
                await upsertAssets({
                    items: [
                        {
                            assetId:
                                '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/1234',
                            name: 'Bored Ape #1234',
                            unitName: 'BAYC',
                            decimals: 0,
                            totalSupply: new Decimal(0),
                            creator: {
                                address:
                                    '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
                            },
                            peraMetadata: {
                                isDeleted: false,
                                verificationTier:
                                    PeraAssetVerificationTier.verified,
                                type: PeraAssetType.collectible,
                                isUnique: true,
                                logo: null,
                                collectible: {
                                    title: 'Bored Ape #1234',
                                    standard: 'erc721',
                                    primaryImage:
                                        'https://nft.pera.test/bayc/1234-preview.png',
                                    mediaType: 'image',
                                    collection: {
                                        name: 'Bored Ape Yacht Club',
                                    },
                                    traits: [],
                                    media: [],
                                },
                            },
                        },
                    ],
                    scope: SCOPE,
                })
                renderHistory()

                await openRow(RECEIVE_HASH)

                const sender = await screen.findByTestId(
                    'transaction_detail_from',
                    undefined,
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(sender.textContent).toContain('transactions.common.from')
                expect(
                    screen.getAllByText('transactions.list_item.receive')
                        .length,
                ).toBeGreaterThan(0)
                expect(
                    screen.queryByText('transactions.list_item.send'),
                ).toBeNull()

                const title = await screen.findByText(
                    'Bored Ape #1234',
                    undefined,
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(title.getAttribute('data-testid')).toBe(
                    'ethereum_record_nft_title',
                )
                const card = screen.getByTestId('ethereum_record_nft')
                expect(
                    card
                        .querySelector('[data-testid="expo-image"]')
                        ?.getAttribute('recyclingkey'),
                ).toContain('bayc/1234-preview.png')
                const quantity = screen.getByTestId(
                    'ethereum_record_nft_quantity',
                ).textContent
                expect(quantity).toContain('1')
                expect(quantity).not.toContain('BAYC')
                expect(
                    screen.getByTestId('ethereum_record_nft_token_id'),
                ).toBeTruthy()
                expect(
                    screen.getByTestId('ethereum_record_nft_contract'),
                ).toBeTruthy()
                expect(screen.queryByTestId('ethereum_record_asset')).toBeNull()
                expect(
                    screen.queryByTestId('ethereum_record_amount_0'),
                ).toBeNull()
                expect(
                    screen.queryByTestId('transaction_detail_fee'),
                ).toBeNull()
                expect(nodeReads).toEqual([])
            })

            const expectFallbackCard = async () => {
                const title = await screen.findByTestId(
                    'ethereum_record_nft_title',
                    undefined,
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(title.textContent).toBe(
                    'transactions.record_detail.nft_fallback',
                )
                expect(
                    screen
                        .getByTestId('ethereum_record_nft')
                        .querySelector('[data-testid="expo-image"]'),
                ).toBeNull()
                expect(
                    screen.queryByTestId('ethereum_record_nft_subtitle'),
                ).toBeNull()
            }

            it('Given an NFT received that the wallet has not stored, when its row is opened, then the NFT service names and pictures it', async () => {
                const RECEIVE_HASH = hashOf(16)
                nftService.isServed = true
                serveNftReceive(RECEIVE_HASH)
                server.use(
                    ...peraEvmAssetHandlers({
                        nfts: {
                            'eip155:1/erc721:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d/1234':
                                evmNftItem(),
                        },
                    }),
                )
                renderHistory()

                await openRow(RECEIVE_HASH)

                await screen.findByText('Bored Ape #1234', undefined, {
                    timeout: SLOW_WAIT_TIMEOUT_MS,
                })
                expect(
                    screen
                        .getByTestId('ethereum_record_nft')
                        .querySelector('[data-testid="expo-image"]')
                        ?.getAttribute('recyclingkey'),
                ).toContain('bayc/1234-preview.png')
                expect(nodeReads).toEqual([])

                const card = screen.getByTestId('ethereum_record_nft_open')
                fireEvent.click(closestPressable(card) ?? card)

                const route = await screen.findByTestId('tab_bar_route')
                expect(JSON.parse(route.textContent ?? '{}')).toEqual({
                    screen: 'Home',
                    params: {
                        screen: 'CollectibleDetails',
                        params: {
                            assetId:
                                '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/1234',
                            chainId: 'ethereum',
                        },
                    },
                })
            })

            it('Given an NFT the NFT service does not know, when its row is opened, then it reads by its collection and token id with a placeholder image', async () => {
                const RECEIVE_HASH = hashOf(17)
                nftService.isServed = true
                serveNftReceive(RECEIVE_HASH)
                server.use(...peraEvmAssetHandlers({ nfts: {} }))
                renderHistory()

                await openRow(RECEIVE_HASH)

                await expectFallbackCard()
            })

            it('Given no NFT service and nothing stored, when an NFT row is opened, then it reads by its collection and token id and nothing is fetched', async () => {
                const RECEIVE_HASH = hashOf(15)
                serveNftReceive(RECEIVE_HASH)
                const nftReads: string[] = []
                const trackNftReads = ({ request }: { request: Request }) => {
                    if (request.url.includes('/nfts')) {
                        nftReads.push(request.url)
                    }
                }
                server.events.on('request:start', trackNftReads)
                try {
                    renderHistory()

                    await openRow(RECEIVE_HASH)

                    await expectFallbackCard()
                } finally {
                    server.events.removeListener('request:start', trackNftReads)
                }
                expect(nftReads).toEqual([])
                expect(nodeReads).toEqual([])
            })

            it('Given a later revocation, when its row is opened, then it reads as a revocation', async () => {
                serveApprovals()
                renderHistory()

                await openRow(REVOKE_HASH)

                await waitFor(
                    () =>
                        expect(
                            screen.getAllByText(
                                'transactions.list_item.revoke_approval',
                            ),
                        ).not.toHaveLength(0),
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(
                    screen.queryByTestId(
                        'message-signing-spend-approval-warning',
                    ),
                ).toBeNull()
            })

            it('Given the node has no record of the transaction, when an approval row is opened, then the page still shows what the history gave, with a notice', async () => {
                serveApprovals()
                server.use(
                    ...evmRpcHandlers({
                        responses: { eth_getTransactionByHash: null },
                    }),
                )
                renderHistory()

                await openRow(APPROVE_HASH)

                await screen.findByTestId(
                    'ethereum_record_read_failed',
                    undefined,
                    {
                        timeout: SLOW_WAIT_TIMEOUT_MS,
                    },
                )
                expect(
                    screen.getByTestId('transaction_detail_fee'),
                ).toBeTruthy()
            })
        })

        describe('with contractDecoding off', () => {
            it('Given a swap of a token the wallet has never held, when its row is opened, then the page names the balance changes without asking the node anything', async () => {
                serveSwap('0x38ed1739')
                renderHistory()

                await openRow(SWAP_HASH)

                await screen.findByTestId(
                    'ethereum_record_undecoded_warning',
                    undefined,
                    {
                        timeout: SLOW_WAIT_TIMEOUT_MS,
                    },
                )
                expect(
                    screen.getByTestId('ethereum_record_amount_0'),
                ).toBeTruthy()
                expect(
                    screen.getByTestId('ethereum_record_amount_1'),
                ).toBeTruthy()
                expect(rpcRequests).toEqual([])
            })

            it("Given the QA account's rows, when History lists them, then the approval is still named and the router call reads Contract interaction", async () => {
                serveActionRows()

                renderHistory()

                const approve = await rowText(USDT_APPROVE_HASH)
                expect(approve).toContain(
                    'transactions.list_item.approve_asset',
                )
                expect(approve).toContain('transactions.common.fee')

                const swap = await rowText(ROUTER_SWAP_HASH)
                expect(swap).toContain(
                    'transactions.list_item.contract_interaction',
                )
                expect(swap).not.toContain('transactions.list_item.swap_pair')
                expect(swap).not.toContain(
                    'transactions.list_item.interpreted_title',
                )
                expect(rpcRequests).toEqual([])
            })

            it('Given an approval, when its row is opened, then the page shows the approval the history gave with its fee, no notice that the call is not decoded, and the node is not asked', async () => {
                serveApprovals()
                renderHistory()

                await openRow(APPROVE_HASH)

                await screen.findByTestId('transaction_detail_fee', undefined, {
                    timeout: SLOW_WAIT_TIMEOUT_MS,
                })
                expect(
                    screen.queryByTestId('ethereum_record_undecoded_warning'),
                ).toBeNull()
                expect(
                    screen.queryByTestId(
                        'message-signing-spend-approval-warning',
                    ),
                ).toBeNull()
                expect(nodeReads).toEqual([])
            })

            it('Given a sent transfer, when its row is opened, then it reads as the shared hero and cards on Ethereum, with its fee in ETH and its own explorer', async () => {
                const SENT_HASH = hashOf(21)
                nodeReads.length = 0
                server.use(
                    ...peraEvmHistoryHandlers({
                        history: {
                            [ETH_ADDRESS]: [
                                [
                                    evmHistoryItem({
                                        hash: SENT_HASH,
                                        block_number: 19_000_000,
                                        block_time: '2026-01-08T00:00:00Z',
                                        from: ETH_ADDRESS,
                                        to: COUNTERPARTY,
                                        value: '1000000000000000000',
                                        fee: '21000000000000',
                                    }),
                                ],
                            ],
                        },
                    }),
                )
                useWebViewStore.getState().clearWebViews()
                renderHistory()

                await openRow(SENT_HASH)

                const network = await screen.findByTestId(
                    'transaction_detail_network',
                    undefined,
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(network.textContent).toContain('Ethereum')
                expect(
                    screen.getByTestId('transaction_detail_status').textContent,
                ).toBe('transactions.common.completed')
                expect(
                    screen.getByTestId('transaction_detail_amount'),
                ).toBeTruthy()
                expect(
                    screen.getByTestId('transaction_detail_block').textContent,
                ).toContain('19000000')
                expect(
                    screen.getByTestId('transaction_detail_fee').textContent,
                ).toMatch(/0\.000021.*ETH|ETH.*0\.000021/)
                expect(
                    screen.getByTestId('transaction_detail_from_account')
                        .textContent,
                ).toContain(ETH_ACCOUNT.name)
                expect(
                    screen.queryByTestId('transaction_detail_to_account'),
                ).toBeNull()

                const cards = [
                    'transaction_detail_network',
                    'transaction_detail_id',
                    'transaction_detail_date',
                    'transaction_detail_block',
                    'transaction_detail_from',
                    'transaction_detail_to',
                    'transaction_detail_fee',
                    'transaction_detail_explorer',
                ].map(testID => screen.getByTestId(testID))
                cards.slice(1).forEach((card, index) => {
                    expect(
                        cards[index]!.compareDocumentPosition(card) &
                            Node.DOCUMENT_POSITION_FOLLOWING,
                    ).toBeTruthy()
                })

                fireEvent.click(
                    closestPressable(
                        screen.getByTestId('transaction_detail_explorer'),
                    ) ?? screen.getByTestId('transaction_detail_explorer'),
                )
                expect(
                    useWebViewStore.getState().openWebViews.map(v => v.url),
                ).toEqual([`https://etherscan.io/tx/${SENT_HASH}`])
                expect(nodeReads).toEqual([])
            })
        })
    })
})
