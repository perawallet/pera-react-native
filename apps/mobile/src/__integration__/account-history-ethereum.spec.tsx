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
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { EvmHistoryItemResponse } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

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
                ? { mainnet: 'https://mainnet.rpc.test/' }
                : withBackend.chainEndpointsFor(chainId),
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
const { nativeAssetFor, upsertAssets } =
    await import('@perawallet/wallet-core-assets')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { setCapabilityOverrides } =
    await import('@test-utils/capability-overrides')
const { TransactionDetailsScreen } = await import('@modules/signing/routes')
const { closestPressable } = await import('@test-utils/rnw')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
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
        const swapRow = () =>
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
            })
        const rpcRequests: string[] = []
        const serveSwap = (input: `0x${string}`) => {
            nodeReads.length = 0
            rpcRequests.length = 0
            server.use(
                ...peraEvmHistoryHandlers({
                    history: { [ETH_ADDRESS]: [[swapRow()]] },
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

        const renderHistory = () =>
            renderWithNavigation(AccountHistory, 'AccountHistory', {
                additionalScreens: [
                    {
                        name: 'TransactionDetails',
                        component: TransactionDetailsScreen,
                    },
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
        })

        describe('with contractDecoding on', () => {
            beforeEach(() => {
                setCapabilityOverrides({ contractDecoding: true }, 'ethereum')
            })

            it('Given approvals in History, when it lists, then each is named by its function and the node is not asked', async () => {
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
                    screen.getAllByText(
                        'transactions.list_item.interpreted_title',
                    ),
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
                    screen.getAllByText('transactions.list_item.approval'),
                ).not.toHaveLength(0)
                expect(
                    screen.getAllByText('signing.spend_approval.unlimited'),
                ).not.toHaveLength(0)
                expect(
                    screen.getByTestId('ethereum_record_amount_0'),
                ).toBeTruthy()
                expect(nodeReads).toEqual([APPROVE_HASH])
            })

            it('Given a swap the decoder does not know, when its row is opened, then it keeps the function name and balance changes and says the call is not decoded', async () => {
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
                expect(nodeReads).toEqual([SWAP_HASH])
                expect(
                    screen.getByText(
                        'transactions.list_item.interpreted_title',
                    ),
                ).toBeTruthy()
                expect(
                    screen.queryByText('transactions.list_item.contract_call'),
                ).toBeNull()
                expect(
                    screen.getByTestId('ethereum_record_amount_1'),
                ).toBeTruthy()
            })

            it('Given an NFT received, when its row is opened, then it still reads as a receive from the sender and the node is not asked', async () => {
                const RECEIVE_HASH = hashOf(13)
                nodeReads.length = 0
                server.use(
                    ...peraEvmHistoryHandlers({
                        history: {
                            [ETH_ADDRESS]: [
                                [
                                    evmHistoryItem({
                                        hash: RECEIVE_HASH,
                                        block_time: '2026-01-07T00:00:00Z',
                                        from: COUNTERPARTY,
                                        to: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
                                        value: '0',
                                        method: 'safeTransferFrom',
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
                renderHistory()

                await openRow(RECEIVE_HASH)

                const counterparty = await screen.findByTestId(
                    'ethereum_record_counterparty',
                    undefined,
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                )
                expect(counterparty.textContent).toContain(
                    'transactions.common.from',
                )
                expect(
                    screen.getAllByText('transactions.list_item.receive')
                        .length,
                ).toBeGreaterThan(0)
                expect(
                    screen.queryByText('transactions.list_item.send'),
                ).toBeNull()
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
                    screen.getByTestId('ethereum_record_amount_0'),
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

            it('Given an approval, when its row is opened, then the page shows what the history gave with a notice that the call is not decoded, and the node is not asked', async () => {
                serveApprovals()
                renderHistory()

                await openRow(APPROVE_HASH)

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
                    screen.queryByTestId(
                        'message-signing-spend-approval-warning',
                    ),
                ).toBeNull()
                expect(nodeReads).toEqual([])
            })
        })
    })
})
