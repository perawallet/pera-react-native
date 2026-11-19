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
import type { Address } from 'viem'
import type {
    EvmActionAsset,
    EvmContractAction,
    EvmSwapLeg,
} from '../contract-action-types'
import { decodeEvmContractAction } from '../contract-actions'
import { findKnownEvmContract, wrappedNativeOf } from '../known-contracts'
import type { RecordedCall } from './contract-action-fixtures'
import {
    V3_COLLECT,
    V4_ETH_IN_EXACT,
    V4_ETH_IN_REFUND,
    V4_HOP_PRICE_ETH_IN,
    V4_HOP_PRICE_EXACT_IN,
    V4_MULTI_HOP_EXACT_IN,
    V4_MULTI_HOP_EXACT_OUT,
    V4_PERMIT_TOKEN_SWAP,
    V4_POSITIONS_BURN,
    V4_POSITIONS_COLLECT,
    V4_POSITIONS_DECREASE,
    V4_POSITIONS_ETH_MINT,
    V4_POSITIONS_INCREASE,
    V4_POSITIONS_MINT,
    V4_POSITIONS_MINT_TO_DEAD,
    V4_POSITIONS_PERMIT_MINT,
    V4_POSITIONS_POOL_MINT,
    V4_TAKE_TO_OTHER,
    V4_TOKEN_TO_ETH,
} from './uniswap-v4-recorded'

// These decode real calldata, not plans built with the decoder's own ABI strings.

const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDT: Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const SPX: Address = '0xE76c5b78f93909d34404E9eb4C1f19e7582a5dE1'

const decode = (call: RecordedCall) => {
    const contract = findKnownEvmContract(1, call.to)
    if (!contract) throw new Error(`${call.to} is not registered`)
    return decodeEvmContractAction(call, contract, wrappedNativeOf(1))
}

const dec = (value: bigint) => new Decimal(value.toString())
const token = (contract: Address): EvmActionAsset => ({
    kind: 'token',
    contract,
})
const native: EvmActionAsset = { kind: 'native' }

type Leg = readonly [EvmActionAsset, bigint, EvmSwapLeg['bound']]

const swap = (
    [inAsset, inAmount, inBound]: Leg,
    [outAsset, outAmount, outBound]: Leg,
): EvmContractAction => ({
    kind: 'swap',
    input: { asset: inAsset, amount: dec(inAmount), bound: inBound },
    output: { asset: outAsset, amount: dec(outAmount), bound: outBound },
    fees: [],
})

describe('decodeEvmContractAction, recorded Uniswap V4 router calls', () => {
    it.each([
        [
            'a 2.0 token to ether swap',
            V4_TOKEN_TO_ETH,
            swap(
                [
                    token('0xc8Fb80fCc03f699C70ff0CC08C09106288888888'),
                    562_639_872_083_338_784_981n,
                    'exact',
                ],
                [native, 61_505_180_075_496_598n, 'at-least'],
            ),
        ],
        [
            'a 2.0 ether swap for exactly the value, with no refund',
            V4_ETH_IN_EXACT,
            swap(
                [native, 30_000_000_000_000_000n, 'exact'],
                [
                    token('0xB3A6ADd33f777AC6ea0ec88Bdf533573c8BBbC03'),
                    0n,
                    'at-least',
                ],
            ),
        ],
        [
            'a 2.0 ether swap with a refund sweep',
            V4_ETH_IN_REFUND,
            swap(
                [native, 813_236_388_735_403_145n, 'exact'],
                [
                    token('0x512728Ec54BF8892E215ddA25A9a5C0137b06181'),
                    0n,
                    'at-least',
                ],
            ),
        ],
        [
            'a 2.0 token swap funded by a permit',
            V4_PERMIT_TOKEN_SWAP,
            swap(
                [token(SPX), 6_698_000_000_000_000_000_000n, 'exact'],
                [token(USDT), 109_087_682n, 'at-least'],
            ),
        ],
        [
            'a 2.0 multi-hop exact-in swap',
            V4_MULTI_HOP_EXACT_IN,
            swap(
                [
                    token('0x14D6C649292c5c9790c5196D1a9EA039307947a1'),
                    77_431_188_313_589_998_869_387n,
                    'exact',
                ],
                [
                    token('0x95669A6589A81A6704bab1020722d0C405841885'),
                    7_554_760_649_772n,
                    'at-least',
                ],
            ),
        ],
        [
            'a 2.0 multi-hop exact-out swap',
            V4_MULTI_HOP_EXACT_OUT,
            swap(
                [token(USDC), 495_947_551n, 'at-most'],
                [
                    token('0xf326C8c9A691319f6330e27aa4A39F2d22C88dC5'),
                    4_519_000_000_000_000_000_000n,
                    'exact',
                ],
            ),
        ],
        [
            'a 2.1.1 multi-hop swap laid out with the per-hop price',
            V4_HOP_PRICE_EXACT_IN,
            swap(
                [token(SPX), 18_864_000_000_000_000_000_000n, 'exact'],
                [token(USDT), 299_907_656n, 'at-least'],
            ),
        ],
        [
            'a 2.1.2 ether swap with a refund sweep',
            V4_HOP_PRICE_ETH_IN,
            swap(
                [native, 428_679_116_815_664_465n, 'exact'],
                [
                    token('0x79280C74255c4C7Fce1BBB0B1204fe755aF0B69c'),
                    1_416_192_447_867_245_860_676_965n,
                    'at-least',
                ],
            ),
        ],
    ] as const)('reads %s', (_name, call, expected) => {
        expect(decode(call)).toEqual(expected)
    })

    it('gives nothing for a swap whose output is taken to an address other than the sender', () => {
        expect(decode(V4_TAKE_TO_OTHER)).toBeUndefined()
    })
})

describe('decodeEvmContractAction, recorded Uniswap position manager calls', () => {
    it.each([
        [
            'a V4 token-pair mint',
            V4_POSITIONS_MINT,
            {
                kind: 'add-liquidity',
                deposits: [
                    { asset: token(USDC), maxAmount: dec(1_600_197_525n) },
                    {
                        asset: token(
                            '0xC30A91A854cFff001656cEA8F76005009bf62546',
                        ),
                        maxAmount: dec(17_275_661_026_107_688_562n),
                    },
                ],
                position: { kind: 'new' },
            },
        ],
        [
            'a V4 ether-pair mint with the unspent ether swept back',
            V4_POSITIONS_ETH_MINT,
            {
                kind: 'add-liquidity',
                deposits: [
                    { asset: native, maxAmount: dec(160_000_000_000_000_000n) },
                    {
                        asset: token(
                            '0x817162975186d4D53dBF5a7377dd45376e2D2fc5',
                        ),
                        maxAmount: dec(1_423_501_000_000_000_000_000_000n),
                    },
                ],
                position: { kind: 'new' },
            },
        ],
        [
            'a V4 mint behind a Permit2 permit for the manager',
            V4_POSITIONS_PERMIT_MINT,
            {
                kind: 'add-liquidity',
                deposits: [
                    {
                        asset: token(
                            '0x6440f144b7e50D6a8439336510312d2F54beB01D',
                        ),
                        maxAmount: dec(14_872_435_671_211_885_678_230n),
                    },
                    { asset: token(USDC), maxAmount: dec(14_848_699_246n) },
                ],
                position: { kind: 'new' },
            },
        ],
        [
            'a V4 mint into a pool the batch creates',
            V4_POSITIONS_POOL_MINT,
            {
                kind: 'add-liquidity',
                deposits: [
                    {
                        asset: token(
                            '0x2dA719DB753dFA10a62E140f436E1d67F2ddB0d6',
                        ),
                        maxAmount: dec(1_354_117_471_081_294n),
                    },
                    { asset: token(USDT), maxAmount: dec(500_000_000n) },
                ],
                position: { kind: 'new' },
            },
        ],
        [
            'a V4 increase',
            V4_POSITIONS_INCREASE,
            {
                kind: 'add-liquidity',
                deposits: [],
                position: { kind: 'existing', tokenId: '517383' },
            },
        ],
        [
            'a V4 decrease',
            V4_POSITIONS_DECREASE,
            { kind: 'remove-liquidity', tokenId: '517858', isClosing: false },
        ],
        [
            'a V4 decrease of no liquidity',
            V4_POSITIONS_COLLECT,
            { kind: 'collect-fees', tokenId: '518078' },
        ],
        [
            'a V4 burn',
            V4_POSITIONS_BURN,
            { kind: 'remove-liquidity', tokenId: '518978', isClosing: true },
        ],
        [
            'a standalone V3 collect',
            V3_COLLECT,
            { kind: 'collect-fees', tokenId: '1405227' },
        ],
    ] as const)('reads %s', (_name, call, expected) => {
        expect(decode(call)).toEqual(expected)
    })

    it('gives nothing for a V4 mint whose position goes to 0xdEaD rather than the sender', () => {
        expect(decode(V4_POSITIONS_MINT_TO_DEAD)).toBeUndefined()
    })
})
