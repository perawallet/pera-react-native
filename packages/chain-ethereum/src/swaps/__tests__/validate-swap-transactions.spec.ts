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
    erc20Abi,
    maxUint256,
    toFunctionSelector,
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
const SWAP_DATA = '0x5ae401dc'
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

const call = (overrides: Partial<EvmSwapCall> = {}): EvmSwapCall => ({
    chainId: 1,
    to: ROUTER,
    value: 0n,
    data: SWAP_DATA,
    ...overrides,
})
const approval = (overrides: Partial<EvmSwapCall> = {}): EvmSwapCall =>
    call({ to: TOKEN, data: approve(ROUTER, AMOUNT), ...overrides })

const validate = (
    calls: readonly EvmSwapCall[],
    request: SwapQuoteRequest = TOKEN_REQUEST,
    routeContracts: readonly Address[] = [ROUTER],
) =>
    validateEvmSwapTransactions({
        calls,
        request,
        scope,
        chain: ETHEREUM,
        routeContracts,
    })

const selectorCall = (signature: string): EvmSwapCall =>
    call({ data: `${toFunctionSelector(signature)}00` })

describe('validateEvmSwapTransactions', () => {
    it('accepts an approval of this amount followed by the swap', () => {
        const calls = [approval(), call()]

        expect(validate(calls)).toEqual({
            approval: calls[0],
            swap: calls[1],
        })
    })

    it('accepts a lone swap', () => {
        const swap = call({ value: AMOUNT })

        expect(validate([swap], NATIVE_REQUEST)).toEqual({
            approval: null,
            swap,
        })
    })

    it('accepts an approval below the amount', () => {
        const calls = [approval({ data: approve(ROUTER, AMOUNT - 1n) }), call()]

        expect(validate(calls).approval).toBe(calls[0])
    })

    it.each<[string, readonly EvmSwapCall[], SwapQuoteRequest?]>([
        ['no call at all', []],
        ['a call to an undeclared contract', [call({ to: STRANGER })]],
        [
            'more native value than requested',
            [call({ value: AMOUNT + 1n })],
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
        ['three calls', [approval(), approval(), call()]],
        ['a call for another chain', [call({ chainId: 8453 })]],
        ['a swap with no calldata', [call({ data: '0x' })]],
    ])('refuses %s', (_name, calls, request) => {
        expect(() => validate(calls, request)).toThrow(SwapQuoteMismatchError)
    })

    it('refuses everything while the route declares no contracts', () => {
        expect(() => validate([call()], TOKEN_REQUEST, [])).toThrow(
            SwapQuoteMismatchError,
        )
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
    ])('refuses %s even on a declared contract', signature => {
        expect(() => validate([selectorCall(signature)])).toThrow(
            SwapQuoteMismatchError,
        )
    })

    it('refuses a refused selector written in upper case', () => {
        const selector = toFunctionSelector('transfer(address,uint256)')
        const upper = `0x${selector.slice(2).toUpperCase()}` as Hex

        expect(() => validate([call({ data: upper })])).toThrow(
            SwapQuoteMismatchError,
        )
    })
})
