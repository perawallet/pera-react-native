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

import { describe, expect, test } from 'vitest'
import { Decimal } from 'decimal.js'
import { concat, encodeFunctionData, maxUint256, stringToHex } from 'viem'
import type { Address, Hex } from 'viem'
import { decodeEvmVerifiedCall } from '../verified-calls'
import type { EvmVerifiedAbi } from '../types'

const SIGNER: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const DAI: Address = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const IMPLEMENTATION: Address = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

const SWAP_EXACT_ETH_FOR_TOKENS = {
    type: 'function',
    name: 'swapExactETHForTokens',
    stateMutability: 'payable',
    inputs: [
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'path', type: 'address[]' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
} as const

const DEPOSIT = {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
} as const

const SET_MEMO = {
    type: 'function',
    name: 'setMemo',
    stateMutability: 'nonpayable',
    inputs: [
        { name: 'memo', type: 'string' },
        { name: '', type: 'bool' },
    ],
    outputs: [],
} as const

const MULTI_ORDER = {
    type: 'function',
    name: 'fill',
    stateMutability: 'nonpayable',
    inputs: [
        {
            name: 'orders',
            type: 'tuple[]',
            components: [
                { name: 'maker', type: 'address' },
                { name: 'amounts', type: 'uint256[2]' },
                { name: 'salt', type: 'bytes32' },
            ],
        },
        { name: 'signature', type: 'bytes' },
        { name: 'delta', type: 'int256' },
    ],
    outputs: [],
} as const

const verified = (
    abi: readonly unknown[],
    implementation?: Address,
): EvmVerifiedAbi => ({
    status: 'verified',
    abi,
    ...(implementation && { proxy: { implementation } }),
})

const swapData = encodeFunctionData({
    abi: [SWAP_EXACT_ETH_FOR_TOKENS],
    functionName: 'swapExactETHForTokens',
    args: [2_400_000_000_000_000_000n, [WETH, DAI], SIGNER, 1_800_000_000n],
})

describe('decodeEvmVerifiedCall', () => {
    test('names a call whose calldata re-encodes exactly under the verified ABI', () => {
        const call = decodeEvmVerifiedCall(
            swapData,
            verified([SWAP_EXACT_ETH_FOR_TOKENS]),
        )

        expect(call).toEqual({
            functionName: 'swapExactETHForTokens',
            signature:
                'swapExactETHForTokens(uint256,address[],address,uint256)',
            arguments: [
                {
                    name: 'amountOutMin',
                    type: 'uint256',
                    value: {
                        kind: 'integer',
                        value: new Decimal('2400000000000000000'),
                    },
                },
                {
                    name: 'path',
                    type: 'address[]',
                    value: {
                        kind: 'array',
                        items: [
                            { kind: 'address', value: WETH },
                            { kind: 'address', value: DAI },
                        ],
                    },
                },
                {
                    name: 'to',
                    type: 'address',
                    value: { kind: 'address', value: SIGNER },
                },
                {
                    name: 'deadline',
                    type: 'uint256',
                    value: { kind: 'integer', value: new Decimal(1_800_000_000) },
                },
            ],
        })
    })

    test("carries the proxy's implementation when the ABI is a proxy's", () => {
        const call = decodeEvmVerifiedCall(
            swapData,
            verified([SWAP_EXACT_ETH_FOR_TOKENS], IMPLEMENTATION),
        )

        expect(call?.proxy).toEqual({ implementation: IMPLEMENTATION })
    })

    test('reads nothing when no function in the ABI has the selector', () => {
        expect(decodeEvmVerifiedCall(swapData, verified([DEPOSIT]))).toBeUndefined()
    })

    test('reads nothing when bytes trail the encoded arguments', () => {
        const padded = concat([swapData, `0x${'00'.repeat(32)}`])

        expect(
            decodeEvmVerifiedCall(padded, verified([SWAP_EXACT_ETH_FOR_TOKENS])),
        ).toBeUndefined()
    })

    test('reads nothing when one trailing byte is added', () => {
        expect(
            decodeEvmVerifiedCall(
                concat([swapData, '0x01']),
                verified([SWAP_EXACT_ETH_FOR_TOKENS]),
            ),
        ).toBeUndefined()
    })

    test('reads nothing when the arguments are cut short', () => {
        expect(
            decodeEvmVerifiedCall(
                swapData.slice(0, -64) as Hex,
                verified([SWAP_EXACT_ETH_FOR_TOKENS]),
            ),
        ).toBeUndefined()
    })

    test('reads nothing when two different signatures claim the selector', () => {
        const burn = {
            type: 'function',
            name: 'burn',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'amount', type: 'uint256' }],
            outputs: [],
        } as const
        // Shares burn(uint256)'s selector, 0x42966c68.
        const collision = {
            type: 'function',
            name: 'collate_propagate_storage',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'key', type: 'bytes16' }],
            outputs: [],
        } as const
        const data = encodeFunctionData({
            abi: [burn],
            functionName: 'burn',
            args: [1n],
        })

        expect(
            decodeEvmVerifiedCall(data, verified([burn, collision])),
        ).toBeUndefined()
    })

    test('reads a call when the same function is listed twice', () => {
        expect(
            decodeEvmVerifiedCall(
                swapData,
                verified([SWAP_EXACT_ETH_FOR_TOKENS, SWAP_EXACT_ETH_FOR_TOKENS]),
            )?.functionName,
        ).toBe('swapExactETHForTokens')
    })

    test('ignores malformed ABI items rather than throwing', () => {
        const call = decodeEvmVerifiedCall(
            swapData,
            verified([
                null,
                'transfer(address,uint256)',
                { type: 'function', name: 7, inputs: [] },
                { type: 'function', name: 'broken', inputs: 'nope' },
                { type: 'function', name: 'badType', inputs: [{ type: 'uint7' }] },
                SWAP_EXACT_ETH_FOR_TOKENS,
            ]),
        )

        expect(call?.functionName).toBe('swapExactETHForTokens')
    })

    test('reads a function that takes no arguments', () => {
        expect(decodeEvmVerifiedCall('0xd0e30db0', verified([DEPOSIT]))).toEqual({
            functionName: 'deposit',
            signature: 'deposit()',
            arguments: [],
        })
    })

    test('reads nothing from calldata shorter than a selector', () => {
        expect(decodeEvmVerifiedCall('0xd0e3', verified([DEPOSIT]))).toBeUndefined()
    })

    test('reads nested tuples, fixed arrays, bytes and signed integers', () => {
        const data = encodeFunctionData({
            abi: [MULTI_ORDER],
            functionName: 'fill',
            args: [
                [
                    {
                        maker: SIGNER,
                        amounts: [1n, maxUint256],
                        salt: `0x${'ab'.repeat(32)}`,
                    },
                ],
                '0xdeadbeef',
                -5n,
            ],
        })

        const call = decodeEvmVerifiedCall(data, verified([MULTI_ORDER]))

        expect(call?.signature).toBe(
            'fill((address,uint256[2],bytes32)[],bytes,int256)',
        )
        expect(call?.arguments).toEqual([
            {
                name: 'orders',
                type: 'tuple[]',
                value: {
                    kind: 'array',
                    items: [
                        {
                            kind: 'tuple',
                            fields: [
                                {
                                    name: 'maker',
                                    type: 'address',
                                    value: { kind: 'address', value: SIGNER },
                                },
                                {
                                    name: 'amounts',
                                    type: 'uint256[2]',
                                    value: {
                                        kind: 'array',
                                        items: [
                                            {
                                                kind: 'integer',
                                                value: new Decimal(1),
                                            },
                                            {
                                                kind: 'integer',
                                                value: new Decimal(
                                                    maxUint256.toString(),
                                                ),
                                            },
                                        ],
                                    },
                                },
                                {
                                    name: 'salt',
                                    type: 'bytes32',
                                    value: {
                                        kind: 'bytes',
                                        value: `0x${'ab'.repeat(32)}`,
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
            {
                name: 'signature',
                type: 'bytes',
                value: { kind: 'bytes', value: '0xdeadbeef' },
            },
            {
                name: 'delta',
                type: 'int256',
                value: { kind: 'integer', value: new Decimal(-5) },
            },
        ])
    })

    test('shows a printable string as text and leaves an unnamed parameter unnamed', () => {
        const data = encodeFunctionData({
            abi: [SET_MEMO],
            functionName: 'setMemo',
            args: ['gm', true],
        })

        expect(decodeEvmVerifiedCall(data, verified([SET_MEMO]))?.arguments).toEqual([
            { name: 'memo', type: 'string', value: { kind: 'string', value: 'gm' } },
            { type: 'bool', value: { kind: 'bool', value: true } },
        ])
    })

    test('shows a string hiding bidi or format characters as its bytes', () => {
        const spoof = 'Approve ‮0 CDSU'
        const data = encodeFunctionData({
            abi: [SET_MEMO],
            functionName: 'setMemo',
            args: [spoof, false],
        })

        expect(
            decodeEvmVerifiedCall(data, verified([SET_MEMO]))?.arguments[0],
        ).toEqual({
            name: 'memo',
            type: 'string',
            value: { kind: 'bytes', value: stringToHex(spoof) },
        })
    })

    test('shows a string with a soft hyphen as its bytes', () => {
        const hidden = 'pay­me'
        const data = encodeFunctionData({
            abi: [SET_MEMO],
            functionName: 'setMemo',
            args: [hidden, false],
        })

        expect(
            decodeEvmVerifiedCall(data, verified([SET_MEMO]))?.arguments[0]
                .value,
        ).toEqual({ kind: 'bytes', value: stringToHex(hidden) })
    })
})
