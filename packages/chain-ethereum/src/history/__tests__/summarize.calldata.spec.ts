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
import {
    encodeFunctionData,
    getAddress,
    maxUint256,
    parseAbi,
    type Address,
    type Hex,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { ETHEREUM } from '../../__tests__/evm-chains'
import {
    V3_EXACT_IN_PERMIT_SWEEP,
    V4_SWAP,
} from '../../signing/__tests__/contract-action-fixtures'
import { evmHistoryItem } from '../api/msw-handlers'
import {
    evmHistoryItemSchema,
    type EvmHistoryItem,
    type EvmHistoryItemResponse,
} from '../api/schema'
import { summarizeEthereumHistoryItem } from '../summarize'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME: Address = '0x00000000000000000000000000000000000000aa'
const PEER: Address = '0x00000000000000000000000000000000000000bb'
const USDC: Address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const AUSDC: Address = '0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c'
const WETH: Address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const APE: Address = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
const POOL: Address = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'
const POSITIONS: Address = '0xc36442b4a4522e871399cd717abdd847ab11fe88'
const ROUTER = V3_EXACT_IN_PERMIT_SWEEP.to
const ETH_ID = 'eip155:1/slip44:60'
const USDC_ID = `eip155:1/erc20:${USDC}`
const WETH_ID = `eip155:1/erc20:${WETH}`
const AUSDC_ID = `eip155:1/erc20:${AUSDC}`
const FEE = '46000000000000'

const ABI = parseAbi([
    'function approve(address spender, uint256 value)',
    'function increaseAllowance(address spender, uint256 addedValue)',
    'function setApprovalForAll(address operator, bool approved)',
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function withdraw(address asset, uint256 amount, address to)',
    'function deposit()',
    'struct DecreaseLiquidityParams { uint256 tokenId; uint128 liquidity; uint256 amount0Min; uint256 amount1Min; uint256 deadline; }',
    'function decreaseLiquidity(DecreaseLiquidityParams params)',
    'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params)',
    'function multicall(bytes[] data)',
])

type CallRow = {
    from?: Address
    to: Address
    input: Nullable<Hex>
    value?: bigint
    method?: string
    impacts?: { asset_id: string; amount: string }[]
    tokenTransfers?: EvmHistoryItemResponse['token_transfers']
}

// The backend folds the gas into the native impact of a row the account sent.
const sent = ({
    from = ME,
    to,
    input,
    value = 0n,
    method = '0x00000000',
    impacts = [],
    tokenTransfers = [],
}: CallRow): EvmHistoryItem =>
    evmHistoryItemSchema.parse(
        evmHistoryItem({
            from,
            to,
            value: value.toString(),
            fee: FEE,
            method,
            input,
            token_transfers: tokenTransfers,
            balance_impacts: [
                {
                    asset_id: ETH_ID,
                    amount: new Decimal(value.toString())
                        .plus(FEE)
                        .negated()
                        .toFixed(),
                },
                ...impacts,
            ],
        }),
    )

const summarize = (item: EvmHistoryItem, isDecoding = true, address = ME) =>
    summarizeEthereumHistoryItem(item, address, SCOPE, ETHEREUM, isDecoding)

const tokenLeg = (
    contract: Address,
    symbol: string,
    decimals: number,
    from: Address,
    to: Address,
    value: string,
) => ({
    asset_id: `eip155:1/erc20:${contract}`,
    contract,
    from,
    to,
    value,
    token_name: null,
    token_symbol: symbol,
    token_decimals: decimals,
})

const approve = (spender: Address, value: bigint) =>
    encodeFunctionData({
        abi: ABI,
        functionName: 'approve',
        args: [spender, value],
    })

describe('summarizeEthereumHistoryItem with the row calldata', () => {
    describe('approvals, whatever the capabilities', () => {
        it.each([true, false])(
            'names an unlimited approval after its token and known spender (decoding %s)',
            isDecoding => {
                const summary = summarize(
                    sent({ to: USDC, input: approve(ROUTER, maxUint256) }),
                    isDecoding,
                )

                expect(summary).toMatchObject({
                    kind: 'approval',
                    icon: 'approval',
                    title: {
                        key: 'transactions.list_item.approve_asset',
                        params: { asset: '0xA0b8...eB48' },
                    },
                    titleAssets: {
                        asset: {
                            chainId: 'ethereum',
                            assetId: getAddress(USDC),
                        },
                    },
                    subtitle: {
                        key: 'transactions.list_item.unlimited_approval_for',
                        params: { spender: 'Uniswap' },
                    },
                    counterparty: ROUTER,
                })
                expect(summary.amount).toBeUndefined()
                expect(summary.isActionUnknown).toBeUndefined()
            },
        )

        it('names a limited approval for its known spender, with no amount line', () => {
            const summary = summarize(
                sent({ to: USDC, input: approve(ROUTER, 1_000_000n) }),
            )

            expect(summary.subtitle).toEqual({
                key: 'transactions.list_item.approval_for',
                params: { spender: 'Uniswap' },
            })
            expect(summary.amount).toBeUndefined()
        })

        it('reads an increaseAllowance as an approval', () => {
            const input = encodeFunctionData({
                abi: ABI,
                functionName: 'increaseAllowance',
                args: [PEER, maxUint256],
            })

            const summary = summarize(sent({ to: USDC, input }), false)

            expect(summary.kind).toBe('approval')
            expect(summary.subtitle).toEqual({
                key: 'transactions.list_item.unlimited_approval_for',
                params: { spender: '0x0000...00bb' },
            })
        })

        it('calls an allowance of zero a revocation, whatever the method says', () => {
            const summary = summarize(
                sent({
                    to: USDC,
                    input: approve(ROUTER, 0n),
                    method: 'approve',
                }),
                false,
            )

            expect(summary.title).toEqual({
                key: 'transactions.list_item.revoke_approval',
            })
            expect(summary.titleAssets).toBeUndefined()
            expect(summary.counterparty).toBe(ROUTER)
        })

        it('names a collection approval and its withdrawal', () => {
            const forAll = (approved: boolean) =>
                sent({
                    to: APE,
                    input: encodeFunctionData({
                        abi: ABI,
                        functionName: 'setApprovalForAll',
                        args: [PEER, approved],
                    }),
                })

            const granted = summarize(forAll(true), false)
            const revoked = summarize(forAll(false), false)

            expect(granted).toMatchObject({
                kind: 'approval',
                title: {
                    key: 'transactions.list_item.approve_all',
                    params: { collection: '0xBC4C...f13D' },
                },
                counterparty: getAddress(PEER),
            })
            expect(granted.titleAssets).toBeUndefined()
            expect(revoked.title).toEqual({
                key: 'transactions.list_item.revoke_approval',
            })
        })
    })

    describe('contract calls, only while decoding', () => {
        const supply = sent({
            to: POOL,
            input: encodeFunctionData({
                abi: ABI,
                functionName: 'supply',
                args: [getAddress(USDC), 1_000_000n, ME, 0],
            }),
            impacts: [
                { asset_id: USDC_ID, amount: '-1000000' },
                { asset_id: AUSDC_ID, amount: '1000000' },
            ],
        })

        it('names an Aave supply from its calldata though its method is a raw selector, keeping the balance changes', () => {
            const summary = summarize(supply)

            expect(summary).toMatchObject({
                kind: 'contract-call',
                title: { key: 'transactions.list_item.supply' },
                subtitle: { params: { title: 'Aave' } },
            })
            expect(summary.isInferred).toBeUndefined()
            expect(
                summary.balanceChanges?.map(change => [
                    change.assetRef.assetId,
                    change.value.toFixed(),
                ]),
            ).toEqual([
                [getAddress(USDC), '-1000000'],
                [getAddress(AUSDC), '1000000'],
            ])
        })

        it('names an Aave withdraw', () => {
            const summary = summarize(
                sent({
                    to: POOL,
                    input: encodeFunctionData({
                        abi: ABI,
                        functionName: 'withdraw',
                        args: [getAddress(USDC), maxUint256, ME],
                    }),
                    impacts: [
                        { asset_id: AUSDC_ID, amount: '-1000000' },
                        { asset_id: USDC_ID, amount: '1000000' },
                    ],
                }),
            )

            expect(summary.title.key).toBe('transactions.list_item.withdraw')
        })

        it('names a wrap', () => {
            const value = 10n ** 17n
            const summary = summarize(
                sent({
                    to: WETH,
                    input: encodeFunctionData({
                        abi: ABI,
                        functionName: 'deposit',
                    }),
                    value,
                    impacts: [{ asset_id: WETH_ID, amount: value.toString() }],
                }),
            )

            expect(summary.title.key).toBe('transactions.list_item.wrap')
        })

        // The router decoder reads the swap from its sender's side, so the row is the recorded call's.
        it('names a Universal Router swap with the pair its balance changes show', () => {
            const { from } = V3_EXACT_IN_PERMIT_SWEEP
            const summary = summarize(
                sent({
                    from,
                    to: ROUTER,
                    input: V3_EXACT_IN_PERMIT_SWEEP.data,
                    tokenTransfers: [
                        tokenLeg(USDC, 'USDC', 6, from, PEER, '1000000'),
                        tokenLeg(
                            WETH,
                            'WETH',
                            18,
                            PEER,
                            from,
                            '300000000000000',
                        ),
                    ],
                    impacts: [
                        { asset_id: USDC_ID, amount: '-1000000' },
                        { asset_id: WETH_ID, amount: '300000000000000' },
                    ],
                }),
                true,
                from,
            )

            expect(summary).toMatchObject({
                kind: 'swap',
                title: {
                    key: 'transactions.list_item.swap_pair',
                    params: { from: 'USDC', to: 'WETH' },
                },
                subtitle: { params: { title: 'Uniswap' } },
            })
            expect(summary.isInferred).toBeUndefined()
        })

        it('names a removal wrapped in the position manager multicall', () => {
            const decrease = encodeFunctionData({
                abi: ABI,
                functionName: 'decreaseLiquidity',
                args: [
                    {
                        tokenId: 7n,
                        liquidity: 1_000n,
                        amount0Min: 0n,
                        amount1Min: 0n,
                        deadline: 1_800_000_000n,
                    },
                ],
            })
            const collect = encodeFunctionData({
                abi: ABI,
                functionName: 'collect',
                args: [
                    {
                        tokenId: 7n,
                        recipient: ME,
                        amount0Max: 2n ** 128n - 1n,
                        amount1Max: 2n ** 128n - 1n,
                    },
                ],
            })

            const summary = summarize(
                sent({
                    to: POSITIONS,
                    input: encodeFunctionData({
                        abi: ABI,
                        functionName: 'multicall',
                        args: [[decrease, collect]],
                    }),
                    impacts: [
                        { asset_id: USDC_ID, amount: '500000' },
                        { asset_id: WETH_ID, amount: '100000000000000' },
                    ],
                }),
            )

            expect(summary.title.key).toBe(
                'transactions.list_item.remove_liquidity',
            )
            expect(summary.isInferred).toBeUndefined()
        })

        it('leaves a decodable call unnamed with the capability off', () => {
            const summary = summarize(supply, false)

            expect(summary.title.key).toBe(
                'transactions.list_item.contract_interaction',
            )
            expect(summary.isActionUnknown).toBe(true)
        })

        it('falls back to the balance changes for a call its decoders leave out, such as a V4 swap', () => {
            const impacts = [
                { asset_id: USDC_ID, amount: '-1000000' },
                { asset_id: WETH_ID, amount: '300000000000000' },
            ]

            const withInput = summarize(
                sent({ to: V4_SWAP.to, input: V4_SWAP.data, impacts }),
            )
            const without = summarize(
                sent({ to: V4_SWAP.to, input: null, impacts }),
            )

            expect(withInput).toEqual(without)
            expect(withInput.isInferred).toBe(true)
        })
    })

    it('reads a row without calldata as it did before the backend sent it', () => {
        const legacy = evmHistoryItemSchema.parse(
            Object.fromEntries(
                Object.entries(
                    evmHistoryItem({
                        from: ME,
                        to: USDC,
                        value: '0',
                        method: 'approve',
                    }),
                ).filter(([key]) => key !== 'input'),
            ),
        )

        const summary = summarize(legacy, false)

        expect(legacy.input).toBeNull()
        expect(summary).toMatchObject({
            kind: 'approval',
            title: { key: 'transactions.list_item.approve_asset' },
        })
        expect(summary.subtitle).toBeUndefined()
    })

    it('drops malformed calldata, not the row', () => {
        const item = evmHistoryItemSchema.parse(
            evmHistoryItem({ from: ME, to: USDC, input: 'not hex' }),
        )

        expect(item.input).toBeNull()
    })
})
