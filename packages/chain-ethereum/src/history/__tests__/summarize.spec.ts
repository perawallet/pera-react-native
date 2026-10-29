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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { getAddress } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { evmHistoryItem, evmNftTransferLeg } from '../api/msw-handlers'
import {
    evmHistoryItemSchema,
    type EvmHistoryItem,
    type EvmHistoryItemResponse,
} from '../api/schema'
import { summarizeEthereumHistoryItem } from '../summarize'
import { ETHEREUM } from '../../__tests__/evm-chains'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'
const CONTRACT = '0x00000000000000000000000000000000000000cc'
const OTHER = '0x00000000000000000000000000000000000000dd'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const USDC_CHECKSUMMED = getAddress(USDC)
const ETH_ID = 'eip155:1/slip44:60'
const USDC_ID = `eip155:1/erc20:${USDC}`

const row = (overrides: Parameters<typeof evmHistoryItem>[0]): EvmHistoryItem =>
    evmHistoryItemSchema.parse(evmHistoryItem(overrides))

const leg = (
    from: string,
    to: string,
    value = '250',
    details: Partial<
        Pick<
            EvmHistoryItemResponse['token_transfers'][number],
            'token_symbol' | 'token_decimals'
        >
    > = {},
) => ({
    asset_id: USDC_ID,
    contract: USDC,
    from,
    to,
    value,
    token_name: null,
    token_symbol: null,
    token_decimals: null,
    ...details,
})

const internal = (
    from: string,
    to: string,
    value: string,
    status: 'success' | 'failed' = 'success',
) => ({ from, to, value, status })

const NATIVE = { chainId: 'ethereum', assetId: 'native' }

const summarize = (item: EvmHistoryItem, address = ME) =>
    summarizeEthereumHistoryItem(item, address, SCOPE, ETHEREUM)

describe('summarizeEthereumHistoryItem', () => {
    it('reads an ETH send as an outgoing transfer', () => {
        const summary = summarize(
            row({ from: ME, to: PEER, value: '1000000000000000000' }),
        )

        expect(summary).toMatchObject({
            kind: 'transfer',
            title: { key: 'transactions.list_item.send' },
            icon: 'send',
            direction: 'out',
            counterparty: getAddress(PEER),
            amount: {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
            },
        })
        expect(summary.amount?.value).toEqual(
            new Decimal('1000000000000000000'),
        )
    })

    it('reads an ETH receive from the sender', () => {
        const summary = summarize(row({ from: PEER, to: ME, value: '5' }))

        expect(summary).toMatchObject({
            title: { key: 'transactions.list_item.receive' },
            icon: 'receive',
            direction: 'in',
            counterparty: getAddress(PEER),
        })
    })

    it('reads an ETH send to oneself as a self transfer', () => {
        const summary = summarize(row({ from: ME, to: ME, value: '5' }))

        expect(summary).toMatchObject({
            title: { key: 'transactions.list_item.send' },
            icon: 'self',
            direction: 'self',
            counterparty: getAddress(ME),
        })
    })

    it('keeps a failed ETH send a transfer', () => {
        const summary = summarize(
            row({ from: ME, to: PEER, value: '5', status: 'failed' }),
        )

        expect(summary.kind).toBe('transfer')
    })

    it('flags a failed row with an error notice', () => {
        const summary = summarize(
            row({ from: ME, to: PEER, value: '5', status: 'failed' }),
        )

        expect(summary.notice).toEqual({
            kind: 'error',
            title: { key: 'transactions.notice.failed' },
        })
    })

    it('carries no notice on a successful row', () => {
        const summary = summarize(
            row({ from: ME, to: PEER, value: '5', status: 'success' }),
        )

        expect(summary.notice).toBeUndefined()
    })

    it('reads a direct token transfer call as an outgoing token transfer', () => {
        const summary = summarize(
            row({
                from: ME,
                to: USDC,
                value: '0',
                method: 'transfer',
                token_transfers: [leg(ME, PEER)],
            }),
        )

        expect(summary).toMatchObject({
            kind: 'token-transfer',
            title: { key: 'transactions.list_item.send' },
            icon: 'send',
            direction: 'out',
            counterparty: getAddress(PEER),
            amount: {
                assetRef: { chainId: 'ethereum', assetId: USDC_CHECKSUMMED },
            },
        })
        expect(summary.amount?.value).toEqual(new Decimal(250))
    })

    it('reads a token leg on a row with no sender as a receive', () => {
        const summary = summarize(row({ token_transfers: [leg(PEER, ME)] }))

        expect(summary).toMatchObject({
            kind: 'token-transfer',
            title: { key: 'transactions.list_item.receive' },
            icon: 'receive',
            direction: 'in',
            counterparty: getAddress(PEER),
        })
    })

    it('reads an approval as a contract call carrying only the gas', () => {
        const summary = summarize(
            row({
                from: ME,
                to: USDC,
                value: '0',
                method: 'approve',
                balance_impacts: [{ asset_id: ETH_ID, amount: '-46000' }],
            }),
        )

        expect(summary).toMatchObject({
            kind: 'contract-call',
            title: { key: 'transactions.list_item.contract_call' },
            icon: 'contract-call',
            direction: 'none',
            counterparty: USDC_CHECKSUMMED,
        })
        expect(summary.balanceChanges).toEqual([
            {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                value: new Decimal(-46000),
            },
        ])
    })

    it('reads a plain value row we only received through a forwarder as a contract call', () => {
        const summary = summarize(
            row({
                from: PEER,
                to: USDC,
                value: '1000000000000000000',
                method: null,
                balance_impacts: [
                    { asset_id: ETH_ID, amount: '500000000000000000' },
                ],
            }),
        )

        expect(summary.kind).toBe('contract-call')
        expect(summary.balanceChanges?.[0]?.value).toEqual(
            new Decimal('500000000000000000'),
        )
    })

    it('reads a token leg moved between two other accounts as a contract call', () => {
        const summary = summarize(
            row({
                from: ME,
                to: USDC,
                value: '0',
                method: 'transferFrom',
                token_transfers: [
                    leg(PEER, '0x00000000000000000000000000000000000000cc'),
                ],
            }),
        )

        expect(summary.kind).toBe('contract-call')
    })

    it('reads a failed contract call as a contract call', () => {
        const summary = summarize(
            row({
                from: ME,
                to: USDC,
                value: '0',
                method: 'approve',
                status: 'failed',
                balance_impacts: [{ asset_id: ETH_ID, amount: '-46000' }],
            }),
        )

        expect(summary.kind).toBe('contract-call')
        expect(summary.balanceChanges).toEqual([
            {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                value: new Decimal(-46000),
            },
        ])
    })

    it('reads an ETH to token swap as a contract call with both changes', () => {
        const router = '0x00000000000000000000000000000000000000cc'
        const summary = summarize(
            row({
                from: ME,
                to: router,
                value: '1000',
                method: 'swapExactETHForTokens',
                token_transfers: [leg(router, ME)],
                balance_impacts: [
                    { asset_id: ETH_ID, amount: '-1046' },
                    { asset_id: USDC_ID, amount: '250' },
                ],
            }),
        )

        expect(summary.kind).toBe('contract-call')
        expect(summary.balanceChanges).toEqual([
            {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                value: new Decimal(-1046),
            },
            {
                assetRef: { chainId: 'ethereum', assetId: USDC_CHECKSUMMED },
                value: new Decimal(250),
            },
        ])
    })

    it('reads a token transfer that is not a call to the token as a contract call', () => {
        const router = '0x00000000000000000000000000000000000000cc'
        const summary = summarize(
            row({
                from: ME,
                to: router,
                value: '0',
                method: 'multicall',
                token_transfers: [leg(ME, PEER)],
            }),
        )

        expect(summary.kind).toBe('contract-call')
    })

    it('reads a withdrawal row as a receive of the native amount', () => {
        const summary = summarize(
            row({
                kind: 'withdrawal',
                hash: null,
                status: 'success',
                withdrawals: [{ index: 7, validator_index: 1, amount: '900' }],
                balance_impacts: [{ asset_id: ETH_ID, amount: '900' }],
            }),
        )

        expect(summary).toMatchObject({
            kind: 'transfer',
            title: { key: 'transactions.list_item.receive' },
            icon: 'receive',
            direction: 'in',
            amount: { assetRef: { chainId: 'ethereum', assetId: 'native' } },
        })
        expect(summary.amount?.value).toEqual(new Decimal(900))
    })

    it('reads the sender from a checksummed address against a lowercase row', () => {
        const summary = summarize(
            row({ from: ME, to: PEER, value: '5' }),
            getAddress(ME),
        )

        expect(summary.direction).toBe('out')
    })

    it('skips a balance impact whose asset id it cannot read', () => {
        const summary = summarize(
            row({
                from: ME,
                to: USDC,
                method: 'approve',
                balance_impacts: [
                    { asset_id: 'eip155:10/slip44:60', amount: '1' },
                    { asset_id: ETH_ID, amount: '-2' },
                ],
            }),
        )

        expect(summary.balanceChanges).toEqual([
            {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                value: new Decimal(-2),
            },
        ])
    })

    describe('NFT transfers', () => {
        const BAYC = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
        const APE = `${getAddress(BAYC)}/1234`
        const SWORD = `${getAddress(BAYC)}/7`

        it('reads an ERC-721 receive as an incoming NFT transfer named by its collection', () => {
            const summary = summarize(
                row({
                    from: PEER,
                    to: BAYC,
                    method: '0x42842e0e',
                    value: '0',
                    nft_transfers: [evmNftTransferLeg({ from: PEER, to: ME })],
                }),
            )

            expect(summary).toMatchObject({
                kind: 'nft-transfer',
                title: { key: 'transactions.list_item.receive' },
                icon: 'receive',
                direction: 'in',
                counterparty: getAddress(PEER),
                subtitle: {
                    key: 'transactions.list_item.nft_subtitle',
                    params: {
                        collection: 'Bored Ape Yacht Club',
                        tokenId: '1234',
                    },
                },
                amount: {
                    assetRef: { chainId: 'ethereum', assetId: APE },
                    display: { symbol: 'BAYC', decimals: 0 },
                },
            })
            expect(summary.amount?.value).toEqual(new Decimal(1))
        })

        it('names an unnamed collection by its contract', () => {
            const summary = summarize(
                row({
                    nft_transfers: [
                        evmNftTransferLeg({
                            from: PEER,
                            to: ME,
                            collection_name: null,
                        }),
                    ],
                }),
            )

            expect(summary.subtitle?.params?.collection).toBe(getAddress(BAYC))
        })

        it('reads an ERC-1155 send of three as outgoing', () => {
            const summary = summarize(
                row({
                    from: ME,
                    to: BAYC,
                    nft_transfers: [
                        evmNftTransferLeg({
                            standard: 'erc1155',
                            token_id: '7',
                            quantity: '3',
                            from: ME,
                            to: PEER,
                        }),
                    ],
                }),
            )

            expect(summary).toMatchObject({
                kind: 'nft-transfer',
                direction: 'out',
                title: { key: 'transactions.list_item.send' },
                counterparty: getAddress(PEER),
                amount: { assetRef: { assetId: SWORD } },
            })
            expect(summary.amount?.value).toEqual(new Decimal(3))
        })

        it('lists every NFT of a batch as a balance change', () => {
            const summary = summarize(
                row({
                    nft_transfers: [
                        evmNftTransferLeg({ from: PEER, to: ME }),
                        evmNftTransferLeg({
                            token_id: '7',
                            from: PEER,
                            to: ME,
                        }),
                    ],
                }),
            )

            expect(summary.kind).toBe('nft-transfer')
            expect(summary.amount).toBeUndefined()
            expect(
                summary.balanceChanges?.map(c => [
                    c.assetRef.assetId,
                    c.value.toFixed(),
                ]),
            ).toEqual([
                [APE, '1'],
                [SWORD, '1'],
            ])
        })

        it.each([
            ['when the backend lists the NFT', true],
            ['when the backend leaves the NFT out', false],
        ])(
            'reads a purchase as a call moving ETH out and the NFT in %s',
            (_, isListed) => {
                const summary = summarize(
                    row({
                        from: ME,
                        to: PEER,
                        method: '0xfb0f3ee1',
                        value: '50000000000000000',
                        nft_transfers: [
                            evmNftTransferLeg({ from: PEER, to: ME }),
                        ],
                        balance_impacts: [
                            { asset_id: ETH_ID, amount: '-50000000000000000' },
                            ...(isListed
                                ? [
                                      {
                                          asset_id: `eip155:1/erc721:${BAYC}/1234`,
                                          amount: '1',
                                      },
                                  ]
                                : []),
                        ],
                    }),
                )

                expect(summary.kind).toBe('contract-call')
                expect(
                    summary.balanceChanges?.map(c => [
                        c.assetRef.assetId,
                        c.value.toFixed(),
                    ]),
                ).toEqual([
                    ['native', '-50000000000000000'],
                    [APE, '1'],
                ])
                expect(summary.balanceChanges?.[1]?.display).toEqual({
                    symbol: 'BAYC',
                    decimals: 0,
                })
            },
        )

        it('drops an unreadable NFT leg, not the row', () => {
            const parsed = evmHistoryItemSchema.safeParse(
                evmHistoryItem({
                    from: PEER,
                    to: ME,
                    value: '5',
                    nft_transfers: [
                        { ...evmNftTransferLeg(), token_id: 'not-a-number' },
                    ],
                }),
            )

            expect(parsed.success).toBe(true)
            expect(parsed.data?.nft_transfers).toEqual([])
            expect(summarize(parsed.data!).kind).toBe('transfer')
        })

        it('reads an NFT sold for ETH paid internally as a contract call', () => {
            const summary = summarize(
                row({
                    from: ME,
                    to: CONTRACT,
                    value: '0',
                    method: 'swapNFTsForToken',
                    nft_transfers: [
                        evmNftTransferLeg({ from: ME, to: CONTRACT }),
                    ],
                    internal_transfers: [internal(CONTRACT, ME, '900')],
                    balance_impacts: [{ asset_id: ETH_ID, amount: '850' }],
                }),
            )

            expect(summary.kind).toBe('contract-call')
            expect(
                summary.balanceChanges?.map(c => [
                    c.assetRef.assetId,
                    c.value.toFixed(),
                ]),
            ).toEqual([
                ['native', '850'],
                [APE, '-1'],
            ])
        })
    })

    describe('internal transfers', () => {
        const paidByContract = {
            from: PEER,
            to: CONTRACT,
            value: '0',
            method: 'execTransaction',
            internal_transfers: [internal(CONTRACT, ME, '700')],
            balance_impacts: [],
        }

        it('shows ETH a contract call paid us through an internal transfer', () => {
            const summary = summarize(row(paidByContract))

            expect(summary.kind).toBe('contract-call')
            expect(summary.counterparty).toBe(getAddress(PEER))
            expect(summary.balanceChanges).toEqual([
                { assetRef: NATIVE, value: new Decimal(700) },
            ])
        })

        it("keeps the backend's native impact over the internal transfers", () => {
            const summary = summarize(
                row({
                    ...paidByContract,
                    balance_impacts: [{ asset_id: ETH_ID, amount: '650' }],
                }),
            )

            expect(summary.balanceChanges).toEqual([
                { assetRef: NATIVE, value: new Decimal(650) },
            ])
        })

        it('puts the derived ETH ahead of the token impacts', () => {
            const summary = summarize(
                row({
                    ...paidByContract,
                    balance_impacts: [{ asset_id: USDC_ID, amount: '250' }],
                }),
            )

            expect(summary.balanceChanges).toEqual([
                { assetRef: NATIVE, value: new Decimal(700) },
                {
                    assetRef: {
                        chainId: 'ethereum',
                        assetId: USDC_CHECKSUMMED,
                    },
                    value: new Decimal(250),
                },
            ])
        })

        it('counts the value the row paid us and the ETH we passed on', () => {
            const summary = summarize(
                row({
                    from: PEER,
                    to: ME,
                    method: 'forward',
                    value: '1000',
                    internal_transfers: [internal(ME, OTHER, '400')],
                }),
            )

            expect(summary.kind).toBe('contract-call')
            expect(summary.balanceChanges).toEqual([
                { assetRef: NATIVE, value: new Decimal(600) },
            ])
        })

        it.each([
            [
                'a failed internal leg',
                {
                    ...paidByContract,
                    internal_transfers: [
                        internal(CONTRACT, ME, '700', 'failed'),
                    ],
                },
            ],
            ['a failed row', { ...paidByContract, status: 'failed' as const }],
            [
                'a row the address sent',
                { ...paidByContract, from: ME, method: 'claim' },
            ],
        ])('moves no ETH for %s', (_, overrides) => {
            const summary = summarize(row(overrides))

            expect(summary.balanceChanges).toEqual([])
        })

        it('reads a token call that also pays us ETH as a contract call', () => {
            const summary = summarize(
                row({
                    from: ME,
                    to: USDC,
                    value: '0',
                    method: 'withdraw',
                    token_transfers: [leg(ME, OTHER)],
                    internal_transfers: [internal(USDC, ME, '250')],
                }),
            )

            expect(summary.kind).toBe('contract-call')
        })

        it('reads an ETH send refunded in part as a contract call', () => {
            const summary = summarize(
                row({
                    from: ME,
                    to: CONTRACT,
                    value: '1000',
                    method: null,
                    internal_transfers: [internal(CONTRACT, ME, '100')],
                    balance_impacts: [{ asset_id: ETH_ID, amount: '-946' }],
                }),
            )

            expect(summary.kind).toBe('contract-call')
            expect(summary.balanceChanges).toEqual([
                { assetRef: NATIVE, value: new Decimal(-946) },
            ])
        })

        it.each([
            ['a leg from and to us', [internal(ME, ME, '500')]],
            [
                'legs in and out that cancel',
                [internal(CONTRACT, ME, '500'), internal(ME, OTHER, '500')],
            ],
        ])('keeps a token receive a transfer with %s', (_, legs) => {
            const summary = summarize(
                row({
                    token_transfers: [leg(PEER, ME)],
                    internal_transfers: legs,
                }),
            )

            expect(summary.kind).toBe('token-transfer')
        })

        it('adds no ETH line when the internal legs net to zero', () => {
            const summary = summarize(
                row({
                    ...paidByContract,
                    internal_transfers: [
                        internal(CONTRACT, ME, '500'),
                        internal(ME, OTHER, '500'),
                    ],
                }),
            )

            expect(summary.balanceChanges).toEqual([])
        })

        it('drops an unreadable internal transfer, not the row', () => {
            const parsed = evmHistoryItemSchema.safeParse(
                evmHistoryItem({
                    ...paidByContract,
                    internal_transfers: [
                        { from: 'nope', to: ME, value: '1', status: 'success' },
                        internal(CONTRACT, ME, '700'),
                    ],
                }),
            )

            expect(parsed.success).toBe(true)
            expect(parsed.data?.internal_transfers).toHaveLength(1)
        })

        it('reads a row without internal transfers', () => {
            const { internal_transfers: _omitted, ...wire } = evmHistoryItem()

            const parsed = evmHistoryItemSchema.safeParse(wire)

            expect(parsed.success).toBe(true)
            expect(parsed.data?.internal_transfers).toEqual([])
        })
    })

    describe('token details', () => {
        it("names a received token with the history's symbol and decimals", () => {
            const summary = summarize(
                row({
                    token_transfers: [
                        leg(PEER, ME, '250000000', {
                            token_symbol: 'USDC',
                            token_decimals: 6,
                        }),
                    ],
                }),
            )

            expect(summary.kind).toBe('token-transfer')
            expect(summary.amount?.value).toEqual(new Decimal('250000000'))
            expect(summary.amount?.display).toEqual({
                symbol: 'USDC',
                decimals: 6,
            })
        })

        it('names the token line of a swap', () => {
            const summary = summarize(
                row({
                    from: ME,
                    to: CONTRACT,
                    value: '1000',
                    method: 'swapExactETHForTokens',
                    token_transfers: [
                        leg(CONTRACT, ME, '250', {
                            token_symbol: 'USDC',
                            token_decimals: 6,
                        }),
                    ],
                    balance_impacts: [
                        { asset_id: ETH_ID, amount: '-1046' },
                        { asset_id: USDC_ID, amount: '250' },
                    ],
                }),
            )

            expect(summary.balanceChanges?.[1]?.display).toEqual({
                symbol: 'USDC',
                decimals: 6,
            })
            expect(summary.balanceChanges?.[0]?.display).toBeUndefined()
        })

        it('gives no hint without decimals', () => {
            const summary = summarize(
                row({
                    token_transfers: [
                        leg(PEER, ME, '250', {
                            token_symbol: 'USDC',
                            token_decimals: null,
                        }),
                    ],
                }),
            )

            expect(summary.amount?.display).toBeUndefined()
        })

        it('keeps the decimals when the symbol is missing', () => {
            const summary = summarize(
                row({
                    token_transfers: [
                        leg(PEER, ME, '250', {
                            token_symbol: null,
                            token_decimals: 6,
                        }),
                    ],
                }),
            )

            expect(summary.amount?.display).toEqual({ symbol: '', decimals: 6 })
        })

        it.each([5, { name: 'USDC' }])(
            'reads a token row whose symbol is %j, naming it by decimals only',
            symbol => {
                const parsed = evmHistoryItemSchema.safeParse({
                    ...evmHistoryItem(),
                    token_transfers: [
                        {
                            ...leg(PEER, ME),
                            token_symbol: symbol,
                            token_decimals: 6,
                        },
                    ],
                })

                expect(parsed.success).toBe(true)
                const summary = summarize(parsed.data!)
                expect(summary.amount?.display).toEqual({
                    symbol: '',
                    decimals: 6,
                })
            },
        )

        it.each([-1, 256, '6', 1.5, undefined])(
            'reads a token row whose decimals are %s, without a hint',
            decimals => {
                const parsed = evmHistoryItemSchema.safeParse({
                    ...evmHistoryItem(),
                    token_transfers: [
                        { ...leg(PEER, ME), token_decimals: decimals },
                    ],
                })

                expect(parsed.success).toBe(true)
                const summary = summarize(parsed.data!)
                expect(summary.kind).toBe('token-transfer')
                expect(summary.amount?.display).toBeUndefined()
            },
        )
    })
})
