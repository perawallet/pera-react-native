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
import { zeroAddress } from 'viem'
import type { Address, Hex } from 'viem'
import { decodeEvmContractAction } from '../contract-actions'
import { findKnownEvmContract } from '../known-contracts'
import type { UniversalRouterVersion } from '../known-contracts'
import { decodeUniversalRouterSwap } from '../universal-router'
import { V4_SWAP } from './contract-action-fixtures'
import { SENDER } from './fixtures'
import {
    CONTRACT_BALANCE,
    MSG_SENDER,
    ROUTER_SELF,
    routerExecute,
    routerPayPortion,
    routerPermit,
    routerSweep,
    settle,
    settleAll,
    settlePair,
    swapExactIn,
    swapExactInSingle,
    swapExactOut,
    swapExactOutSingle,
    take,
    takeAll,
    takePortion,
    v4Swap,
    type Layout,
    type PlannedAction,
    type PoolKey,
    type RouterCommand,
} from './uniswap-v4-fixtures'

// Mainnet routers, by the release their deployment list names them after.
const ROUTER_2_1: Address = '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85'
const ROUTER_2_0: Address = '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af'
const ROUTER_1_2: Address = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'

const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI: Address = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const FEE_TAKER: Address = '0x7FFC3DBF3B2b50Ff3A1D5523bc24Bb5043837B14'
const OTHER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const USDC_IN = 100_000_000n
const ETH_OUT_MIN = 3n * 10n ** 16n
const ETH_IN = 5n * 10n ** 16n
const USDC_OUT_MIN = 140_000_000n

const ETH_USDC: PoolKey = {
    currency0: zeroAddress,
    currency1: USDC,
    fee: 500,
    tickSpacing: 10,
    hooks: zeroAddress,
}
const USDC_WETH: PoolKey = { ...ETH_USDC, currency0: USDC, currency1: WETH }

const dec = (value: bigint) => new Decimal(value.toString())

const decode = (
    commands: readonly RouterCommand[],
    {
        value = 0n,
        version = '2.1',
    }: { value?: bigint; version?: UniversalRouterVersion } = {},
) =>
    decodeUniversalRouterSwap(
        {
            from: SENDER,
            to: version === '2.0' ? ROUTER_2_0 : ROUTER_2_1,
            data: routerExecute(...commands),
            value,
        },
        WETH,
        version,
    )

const usdcToEth = (
    layout: Layout = 'with-hop-price',
    ...payout: readonly PlannedAction[]
): RouterCommand =>
    v4Swap(
        swapExactInSingle(ETH_USDC, false, USDC_IN, ETH_OUT_MIN, layout),
        settleAll(USDC, USDC_IN),
        ...(payout.length > 0 ? payout : [takeAll(zeroAddress, ETH_OUT_MIN)]),
    )

const usdcToWeth = (...payout: readonly PlannedAction[]): RouterCommand =>
    v4Swap(
        swapExactInSingle(
            USDC_WETH,
            true,
            USDC_IN,
            ETH_OUT_MIN,
            'with-hop-price',
        ),
        settleAll(USDC, USDC_IN),
        ...payout,
    )

const ethToUsdc = (payment: PlannedAction): RouterCommand =>
    v4Swap(
        swapExactInSingle(
            ETH_USDC,
            true,
            ETH_IN,
            USDC_OUT_MIN,
            'with-hop-price',
        ),
        payment,
        takeAll(USDC, USDC_OUT_MIN),
    )

describe('decodeUniversalRouterSwap, V4 swaps', () => {
    it('reads a token to ether exact-in swap funded by a permit', () => {
        const action = decode([routerPermit(USDC, ROUTER_2_1), usdcToEth()])

        expect(action).toEqual({
            kind: 'swap',
            input: {
                asset: { kind: 'token', contract: USDC },
                amount: dec(USDC_IN),
                bound: 'exact',
            },
            output: {
                asset: { kind: 'native' },
                amount: dec(ETH_OUT_MIN),
                bound: 'at-least',
            },
            fees: [],
        })
    })

    it('reads the swap parameters without a per-hop price on a 2.0 router', () => {
        const action = decode([usdcToEth('without-hop-price')], {
            version: '2.0',
        })

        expect(action?.output.amount).toEqual(dec(ETH_OUT_MIN))
    })

    it.each([
        ['the exact value', settle(zeroAddress, ETH_IN, false)],
        ['the router balance', settle(zeroAddress, CONTRACT_BALANCE, false)],
    ])(
        'reads ether in as exactly the value when the settle spends %s',
        (_name, payment) => {
            const action = decode([ethToUsdc(payment)], { value: ETH_IN })

            expect(action?.input).toEqual({
                asset: { kind: 'native' },
                amount: dec(ETH_IN),
                bound: 'exact',
            })
            expect(action?.output).toEqual({
                asset: { kind: 'token', contract: USDC },
                amount: dec(USDC_OUT_MIN),
                bound: 'at-least',
            })
        },
    )

    it('reads ether in as at most the value when the unspent ether is swept back', () => {
        const action = decode(
            [
                ethToUsdc(settleAll(zeroAddress, ETH_IN)),
                routerSweep(zeroAddress, MSG_SENDER, 0n),
            ],
            { value: ETH_IN },
        )

        expect(action?.input).toEqual({
            asset: { kind: 'native' },
            amount: dec(ETH_IN),
            bound: 'at-most',
        })
    })

    it('reads an exact-out swap as at most its cap in and exactly its amount out', () => {
        const action = decode([
            v4Swap(
                swapExactOutSingle(
                    USDC_WETH,
                    true,
                    ETH_OUT_MIN,
                    USDC_IN,
                    'with-hop-price',
                ),
                settleAll(USDC, USDC_IN),
                takeAll(WETH, ETH_OUT_MIN),
            ),
        ])

        expect(action?.input).toEqual({
            asset: { kind: 'token', contract: USDC },
            amount: dec(USDC_IN),
            bound: 'at-most',
        })
        expect(action?.output).toEqual({
            asset: { kind: 'token', contract: WETH },
            amount: dec(ETH_OUT_MIN),
            bound: 'exact',
        })
    })

    it('reads the ends of a multi-hop path in both directions', () => {
        const exactIn = decode([
            v4Swap(
                swapExactIn(USDC, [WETH, DAI], USDC_IN, 1n, 'with-hop-price'),
                settleAll(USDC, USDC_IN),
                takeAll(DAI, 1n),
            ),
        ])
        const exactOut = decode([
            v4Swap(
                swapExactOut(
                    DAI,
                    [USDC, WETH],
                    10n ** 18n,
                    USDC_IN,
                    'with-hop-price',
                ),
                settleAll(USDC, USDC_IN),
                takeAll(DAI, 10n ** 18n),
            ),
        ])

        expect(exactIn?.input.asset).toEqual({ kind: 'token', contract: USDC })
        expect(exactIn?.output.asset).toEqual({ kind: 'token', contract: DAI })
        expect(exactOut?.input.asset).toEqual({ kind: 'token', contract: USDC })
        expect(exactOut?.output.asset).toEqual({ kind: 'token', contract: DAI })
    })

    it('carries a portion taken in V4 as a fee, with only the final take bounding the output', () => {
        const action = decode([
            usdcToWeth(
                takePortion(WETH, FEE_TAKER, 25n),
                takeAll(WETH, ETH_OUT_MIN - 1n),
            ),
        ])

        expect(action?.fees).toEqual([
            {
                token: WETH,
                recipient: FEE_TAKER,
                size: { kind: 'bips', bips: 25 },
            },
        ])
        expect(action?.output).toEqual({
            asset: { kind: 'token', contract: WETH },
            amount: dec(ETH_OUT_MIN - 1n),
            bound: 'at-least',
        })
    })

    it('reads output taken into the router, charged a fee there and swept to the signer', () => {
        const action = decode([
            usdcToWeth(take(WETH, ROUTER_SELF, 0n)),
            routerPayPortion(WETH, FEE_TAKER, 25n),
            routerSweep(WETH, MSG_SENDER, ETH_OUT_MIN - 2n),
        ])

        expect(action?.fees).toEqual([
            {
                token: WETH,
                recipient: FEE_TAKER,
                size: { kind: 'bips', bips: 25 },
            },
        ])
        expect(action?.output).toEqual({
            asset: { kind: 'token', contract: WETH },
            amount: dec(ETH_OUT_MIN - 2n),
            bound: 'at-least',
        })
    })

    it.each([
        [
            'output taken to someone else',
            () => [usdcToWeth(take(WETH, OTHER, 0n))],
        ],
        [
            'output taken into the router and swept to someone else',
            () => [
                usdcToWeth(take(WETH, ROUTER_SELF, 0n)),
                routerSweep(WETH, OTHER, 0n),
            ],
        ],
        [
            'output taken into the router and left there',
            () => [usdcToWeth(take(WETH, ROUTER_SELF, 0n))],
        ],
        [
            'a router fee on output paid straight to the signer',
            () => [
                usdcToWeth(takeAll(WETH, ETH_OUT_MIN)),
                routerPayPortion(WETH, FEE_TAKER, 25n),
            ],
        ],
        [
            'part of the output taken, leaving the rest for another action',
            () => [usdcToWeth(take(WETH, MSG_SENDER, 1n))],
        ],
        [
            'a portion of another currency',
            () => [
                usdcToWeth(
                    takePortion(USDC, FEE_TAKER, 25n),
                    takeAll(WETH, 0n),
                ),
            ],
        ],
        [
            'a fee on ether out, whose row has no token to name',
            () => [
                usdcToEth(
                    'with-hop-price',
                    takePortion(zeroAddress, FEE_TAKER, 25n),
                    takeAll(zeroAddress, 0n),
                ),
            ],
        ],
        [
            'a permit for another spender',
            () => [routerPermit(USDC, OTHER), usdcToEth()],
        ],
        [
            'a permit for another token',
            () => [routerPermit(DAI, ROUTER_2_1), usdcToEth()],
        ],
        [
            'a token settled for the open delta',
            () => [
                v4Swap(
                    swapExactInSingle(
                        USDC_WETH,
                        true,
                        USDC_IN,
                        1n,
                        'with-hop-price',
                    ),
                    settle(USDC, 0n, true),
                    takeAll(WETH, 1n),
                ),
            ],
        ],
        [
            'a token settled from the router balance',
            () => [
                v4Swap(
                    swapExactInSingle(
                        USDC_WETH,
                        true,
                        USDC_IN,
                        1n,
                        'with-hop-price',
                    ),
                    settle(USDC, USDC_IN, false),
                    takeAll(WETH, 1n),
                ),
            ],
        ],
        [
            'a settle of another currency',
            () => [
                v4Swap(
                    swapExactInSingle(
                        USDC_WETH,
                        true,
                        USDC_IN,
                        1n,
                        'with-hop-price',
                    ),
                    settleAll(DAI, USDC_IN),
                    takeAll(WETH, 1n),
                ),
            ],
        ],
        [
            'two routes',
            () => [
                v4Swap(
                    swapExactInSingle(
                        USDC_WETH,
                        true,
                        USDC_IN,
                        1n,
                        'with-hop-price',
                    ),
                    swapExactInSingle(
                        ETH_USDC,
                        false,
                        USDC_IN,
                        1n,
                        'with-hop-price',
                    ),
                    settleAll(USDC, 2n * USDC_IN),
                    takeAll(WETH, 1n),
                ),
            ],
        ],
        [
            'a swap sized by an earlier one',
            () => [
                v4Swap(
                    swapExactInSingle(
                        USDC_WETH,
                        true,
                        0n,
                        1n,
                        'with-hop-price',
                    ),
                    settleAll(USDC, USDC_IN),
                    takeAll(WETH, 1n),
                ),
            ],
        ],
        [
            'an action a swap plan does not use',
            () => [usdcToWeth(settlePair(USDC, WETH), takeAll(WETH, 1n))],
        ],
        [
            'a sweep of an unrelated token',
            () => [
                usdcToWeth(takeAll(WETH, 1n)),
                routerSweep(DAI, MSG_SENDER, 0n),
            ],
        ],
        [
            'parameters laid out for the other release',
            () => [usdcToEth('without-hop-price')],
        ],
    ] as const)('gives nothing for %s', (_name, build) => {
        expect(decode(build())).toBeUndefined()
    })

    it.each([
        ['ether without a refund', settleAll(zeroAddress, ETH_IN), ETH_IN],
        [
            'a token settled with ether sent',
            settle(zeroAddress, ETH_IN, false),
            0n,
        ],
    ])('gives nothing for %s', (_name, payment, value) => {
        expect(decode([ethToUsdc(payment)], { value })).toBeUndefined()
    })

    it('gives nothing for a token swap that also sends ether', () => {
        expect(decode([usdcToEth()], { value: 1n })).toBeUndefined()
    })

    it('gives nothing for a router whose release is unknown', () => {
        expect(
            decodeUniversalRouterSwap(
                {
                    from: SENDER,
                    to: ROUTER_2_1,
                    data: routerExecute(usdcToEth()),
                    value: 0n,
                },
                WETH,
            ),
        ).toBeUndefined()
    })

    it('gives nothing for the recorded chain of open-delta swaps paying a third party', () => {
        expect(decodeUniversalRouterSwap(V4_SWAP, WETH, '2.1')).toBeUndefined()
    })
})

describe('decodeEvmContractAction, V4 swaps by router release', () => {
    const decodeAt = (to: Address, data: Hex) => {
        const contract = findKnownEvmContract(1, to)
        if (!contract) throw new Error(`${to} is not registered`)
        return decodeEvmContractAction(
            { from: SENDER, to, data, value: 0n },
            contract,
            WETH,
        )
    }

    it('reads a V4 swap on a 2.1 router', () => {
        expect(decodeAt(ROUTER_2_1, routerExecute(usdcToEth()))?.kind).toBe(
            'swap',
        )
    })

    it('reads the 2.0 layout on a 2.0 router', () => {
        expect(
            decodeAt(ROUTER_2_0, routerExecute(usdcToEth('without-hop-price')))
                ?.kind,
        ).toBe('swap')
    })

    // Before 2.0 the same command byte is a Seaport order.
    it('gives nothing for the same command on a 1.2 router', () => {
        expect(
            decodeAt(ROUTER_1_2, routerExecute(usdcToEth('without-hop-price'))),
        ).toBeUndefined()
    })
})
