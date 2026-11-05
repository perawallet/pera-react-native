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
import { serializeTransaction } from 'viem'
import type { Hex, TransactionSerializable } from 'viem'
import { SwapQuoteMismatchError } from '@perawallet/wallet-core-swaps'
import { decodeSwapTransaction } from '../decode-swap-transaction'

const ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
const DATA = '0x5ae401dc'
const CALL = { chainId: 1, to: ROUTER, value: 5n, data: DATA } as const
const VERSIONED_HASH = `0x01${'00'.repeat(31)}` as Hex

const serialize = (transaction: TransactionSerializable): Hex =>
    serializeTransaction(transaction)

describe('decodeSwapTransaction', () => {
    it('keeps only the call of a type 2 transaction', () => {
        const encoded = serialize({
            ...CALL,
            type: 'eip1559',
            nonce: 99,
            gas: 21_000n,
            maxFeePerGas: 7n,
            maxPriorityFeePerGas: 1n,
        })

        expect(decodeSwapTransaction(encoded)).toEqual(CALL)
    })

    it('keeps only the call of a legacy transaction', () => {
        const encoded = serialize({
            ...CALL,
            type: 'legacy',
            nonce: 99,
            gas: 21_000n,
            gasPrice: 7n,
        })

        expect(decodeSwapTransaction(encoded)).toEqual(CALL)
    })

    it('reads a call that sends no value and no data', () => {
        const encoded = serialize({
            chainId: 1,
            to: ROUTER,
            type: 'eip1559',
            maxFeePerGas: 7n,
        })

        expect(decodeSwapTransaction(encoded)).toEqual({
            chainId: 1,
            to: ROUTER,
            value: 0n,
            data: '0x',
        })
    })

    it('refuses a contract creation', () => {
        const encoded = serialize({
            chainId: 1,
            data: DATA,
            type: 'eip1559',
            maxFeePerGas: 7n,
        })

        expect(() => decodeSwapTransaction(encoded)).toThrow(
            SwapQuoteMismatchError,
        )
    })

    it('refuses a blob transaction', () => {
        const encoded = serialize({
            ...CALL,
            type: 'eip4844',
            blobVersionedHashes: [VERSIONED_HASH],
            maxFeePerBlobGas: 7n,
            maxFeePerGas: 7n,
        })

        expect(() => decodeSwapTransaction(encoded)).toThrow(
            SwapQuoteMismatchError,
        )
    })

    it('refuses an authorization list', () => {
        const encoded = serialize({
            ...CALL,
            type: 'eip7702',
            maxFeePerGas: 7n,
            authorizationList: [
                {
                    address: ROUTER,
                    chainId: 1,
                    nonce: 0,
                    r: `0x${'11'.repeat(32)}`,
                    s: `0x${'22'.repeat(32)}`,
                    yParity: 0,
                },
            ],
        })

        expect(() => decodeSwapTransaction(encoded)).toThrow(
            SwapQuoteMismatchError,
        )
    })

    it.each(['not hex', '0x', '0xdeadbeef'])('refuses %s', encoded => {
        expect(() => decodeSwapTransaction(encoded)).toThrow(
            SwapQuoteMismatchError,
        )
    })
})
