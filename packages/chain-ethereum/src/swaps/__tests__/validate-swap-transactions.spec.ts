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
    concat,
    encodeFunctionData,
    erc20Abi,
    maxUint256,
    parseAbi,
    toFunctionSelector,
    zeroAddress,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
    SwapQuoteMismatchError,
    type SwapQuoteRequest,
} from '@perawallet/wallet-core-swaps'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import type { EvmSwapCall } from '../decode-swap-transaction'
import { validateEvmSwapTransactions } from '../validate-swap-transactions'

const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const OTHER_TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
const STRANGER = '0x000000000000000000000000000000000000dEaD'
// Universal Router's execute(bytes,bytes[],uint256); the wallet never reads its arguments.
const SWAP_DATA = '0x3593564c'
const AMOUNT = 1_000_000n

const scope = evmScopeOf(ETHEREUM)

const requestFor = (assetId: string): SwapQuoteRequest => ({
    sourceAsset: { ...scope, assetId },
    destinationAsset: { ...scope, assetId: TOKEN },
    sourceAmount: new Decimal(AMOUNT.toString()),
    sourceAddress: SENDER,
    destinationAddress: SENDER,
    slippage: null,
})
const TOKEN_REQUEST = requestFor(TOKEN)
const NATIVE_REQUEST = requestFor(ETHEREUM.nativeAsset.assetId)

const approve = (spender: Address, amount: bigint): Hex =>
    encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
    })
const transfer = (recipient: Address, amount: bigint): Hex =>
    encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient, amount],
    })

const MULTICALL_ABI = parseAbi([
    'function multicall(bytes[] data)',
    'function multicall(uint256 deadline, bytes[] data)',
])
const multicall = (inner: readonly Hex[]): Hex =>
    encodeFunctionData({
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [[...inner]],
    })
const multicallWithDeadline = (inner: readonly Hex[]): Hex =>
    encodeFunctionData({
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [1n, [...inner]],
    })

const call = (overrides: Partial<EvmSwapCall> = {}): EvmSwapCall => ({
    chainId: 1,
    to: ROUTER,
    value: 0n,
    data: SWAP_DATA,
    ...overrides,
})
const approval = (overrides: Partial<EvmSwapCall> = {}): EvmSwapCall =>
    call({ to: TOKEN, data: approve(ROUTER, AMOUNT), ...overrides })
const deposit = (overrides: Partial<EvmSwapCall> = {}): EvmSwapCall =>
    call({ to: TOKEN, data: transfer(STRANGER, AMOUNT), ...overrides })

const validate = (
    calls: readonly EvmSwapCall[],
    request: SwapQuoteRequest = TOKEN_REQUEST,
) =>
    validateEvmSwapTransactions({
        calls,
        request,
        scope,
        chain: ETHEREUM,
    })

const selectorOf = (signature: string): Hex =>
    `${toFunctionSelector(signature)}00`

describe('validateEvmSwapTransactions', () => {
    it('accepts an approval of this amount followed by the swap', () => {
        const calls = [approval(), call()]

        expect(validate(calls)).toEqual({
            approval: calls[0],
            swap: calls[1],
            counterparty: ROUTER,
            isPaidOutLater: false,
        })
    })

    it('accepts a lone swap', () => {
        const swap = call({ value: AMOUNT })

        expect(validate([swap], NATIVE_REQUEST)).toEqual({
            approval: null,
            swap,
            counterparty: ROUTER,
            isPaidOutLater: false,
        })
    })

    it('accepts a swap to whichever contract and function the order names', () => {
        const calls = [
            approval({ data: approve(STRANGER, AMOUNT) }),
            call({ to: STRANGER, data: '0x12345678' }),
        ]

        expect(validate(calls).swap.to).toBe(STRANGER)
    })

    it('accepts an approval below the amount', () => {
        const calls = [approval({ data: approve(ROUTER, AMOUNT - 1n) }), call()]

        expect(validate(calls).approval).toBe(calls[0])
    })

    it('accepts a token deposit of exactly the amount, paid out later', () => {
        const swap = deposit()

        expect(validate([swap])).toEqual({
            approval: null,
            swap,
            counterparty: STRANGER,
            isPaidOutLater: true,
        })
    })

    it('accepts a plain native send as a deposit, paid out later', () => {
        const swap = call({ to: STRANGER, value: AMOUNT, data: '0x' })

        expect(validate([swap], NATIVE_REQUEST)).toEqual({
            approval: null,
            swap,
            counterparty: STRANGER,
            isPaidOutLater: true,
        })
    })

    it('accepts a multicall whose inner calls are all swaps', () => {
        const swap = call({
            data: multicallWithDeadline([SWAP_DATA, multicall([SWAP_DATA])]),
        })

        expect(validate([approval(), swap]).swap).toBe(swap)
    })

    it.each<[string, readonly EvmSwapCall[], SwapQuoteRequest?]>([
        ['no call at all', []],
        [
            'a deposit of less than the amount',
            [deposit({ data: transfer(STRANGER, AMOUNT - 1n) })],
        ],
        [
            'a deposit to the zero address',
            [deposit({ data: transfer(zeroAddress, AMOUNT) })],
        ],
        [
            'a deposit back to the sender',
            [deposit({ data: transfer(SENDER, AMOUNT) })],
        ],
        ['a deposit with native value', [deposit({ value: 1n })]],
        [
            'a deposit with trailing bytes',
            [deposit({ data: concat([transfer(STRANGER, AMOUNT), '0x00']) })],
        ],
        [
            'a deposit with dirty upper address bytes',
            [
                deposit({
                    data: `0xa9059cbb${'ff'.repeat(12)}${transfer(STRANGER, AMOUNT).slice(34)}`,
                }),
            ],
        ],
        ['a deposit after an approval', [approval(), deposit()]],
        ['a transfer of another token', [deposit({ to: OTHER_TOKEN })]],
        [
            'more native value than requested',
            [call({ value: AMOUNT + 1n })],
            NATIVE_REQUEST,
        ],
        [
            'a native deposit of more than the amount',
            [call({ to: STRANGER, value: AMOUNT + 1n, data: '0x' })],
            NATIVE_REQUEST,
        ],
        ['native value on a token source', [call({ value: 1n })]],
        [
            'an approval above the amount',
            [approval({ data: approve(ROUTER, AMOUNT + 1n) }), call()],
        ],
        [
            'an unlimited approval',
            [approval({ data: approve(ROUTER, maxUint256) }), call()],
        ],
        [
            'an approval for another spender',
            [approval({ data: approve(STRANGER, AMOUNT) }), call()],
        ],
        [
            'an approval of another token',
            [approval({ to: OTHER_TOKEN }), call()],
        ],
        ['an approval with value', [approval({ value: 1n }), call()]],
        ['an approval last', [call(), approval()]],
        ['a lone approval', [approval()]],
        [
            'an approval on a native source',
            [approval(), call({ value: AMOUNT })],
            NATIVE_REQUEST,
        ],
        [
            'a first call that is no approval',
            [call({ to: TOKEN, data: SWAP_DATA }), call()],
        ],
        [
            'a swap that calls the source token',
            [approval({ data: approve(TOKEN, AMOUNT) }), call({ to: TOKEN })],
        ],
        ['three calls', [approval(), approval(), call()]],
        ['a call for another chain', [call({ chainId: 8453 })]],
        ['a token swap with no calldata', [call({ data: '0x' })]],
        [
            'a multicall running a transfer',
            [
                call({
                    data: multicall([SWAP_DATA, transfer(STRANGER, AMOUNT)]),
                }),
            ],
            NATIVE_REQUEST,
        ],
        [
            'a nested multicall collecting an LP position',
            [
                call({
                    data: multicallWithDeadline([
                        multicall([
                            selectorOf(
                                'collect((uint256,address,uint128,uint128))',
                            ),
                        ]),
                    ]),
                }),
            ],
            NATIVE_REQUEST,
        ],
        [
            'multicalls nested past the limit',
            [
                call({
                    data: multicall([
                        multicall([multicall([multicall([SWAP_DATA])])]),
                    ]),
                }),
            ],
            NATIVE_REQUEST,
        ],
        [
            'an unreadable multicall',
            [call({ data: selectorOf('multicall(bytes[])') })],
            NATIVE_REQUEST,
        ],
    ])('refuses %s', (_name, calls, request) => {
        expect(() => validate(calls, request)).toThrow(SwapQuoteMismatchError)
    })

    it('refuses a source on another chain', () => {
        const request = {
            ...TOKEN_REQUEST,
            sourceAsset: {
                chainId: 'base',
                networkId: 'mainnet',
                assetId: TOKEN,
            },
        }

        expect(() => validate([call()], request)).toThrow(
            SwapQuoteMismatchError,
        )
    })

    it.each([
        'approve(address,uint256)',
        'transfer(address,uint256)',
        'transferFrom(address,address,uint256)',
        'setApprovalForAll(address,bool)',
        'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)',
        'permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)',
        'safeTransferFrom(address,address,uint256)',
        'safeTransferFrom(address,address,uint256,bytes)',
        'safeTransferFrom(address,address,uint256,uint256,bytes)',
        'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
        'increaseAllowance(address,uint256)',
        'approve(address,address,uint160,uint48)',
        'transferAndCall(address,uint256)',
        'transferAndCall(address,uint256,bytes)',
        'transferFromAndCall(address,address,uint256)',
        'transferFromAndCall(address,address,uint256,bytes)',
        'approveAndCall(address,uint256)',
        'approveAndCall(address,uint256,bytes)',
        'send(address,uint256,bytes)',
        'operatorSend(address,address,uint256,bytes,bytes)',
        'authorizeOperator(address)',
        'withdraw(address,uint256,uint32,bytes)',
        'withdrawTo(address,address,uint256,uint32,bytes)',
        'bridgeERC20(address,address,uint256,uint32,bytes)',
        'bridgeERC20To(address,address,address,uint256,uint32,bytes)',
        'outboundTransfer(address,address,uint256,bytes)',
        'withdrawTo(address,uint256)',
        'redeem(uint256,address,address)',
        'withdraw(uint256,address,address)',
        'withdraw(address,uint256,address)',
        'withdrawTo(address,address,uint256)',
        'withdrawFrom(address,address,address,uint256)',
        'transferAsset(address,address,uint256)',
        'allow(address,bool)',
        'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))',
        'collect((uint256,address,uint128,uint128))',
        'modifyLiquidities(bytes,uint256)',
        'modifyLiquiditiesWithoutUnlock(bytes,bytes[])',
        'setOwner(bytes32,address)',
        'transferOwnership(address)',
    ])('refuses a swap calling %s on any contract', signature => {
        expect(() =>
            validate([call({ data: selectorOf(signature) })], NATIVE_REQUEST),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('refuses a refused call written in upper case', () => {
        const selector = toFunctionSelector(
            'transferAndCall(address,uint256,bytes)',
        )
        const upper = `0x${selector.slice(2).toUpperCase()}` as Hex

        expect(() => validate([call({ data: upper })], NATIVE_REQUEST)).toThrow(
            SwapQuoteMismatchError,
        )
    })
})
