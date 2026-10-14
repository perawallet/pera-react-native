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
    readEthereumNative,
    toEthereumNative,
    type EthereumTransactionView,
} from '../transaction-view'
import { SENDER } from './fixtures'

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const VIEW: EthereumTransactionView = {
    kind: 'token-transfer',
    from: SENDER,
    to: TOKEN,
    value: new Decimal(0),
    data: '0xa9059cbb',
    selector: '0xa9059cbb',
    nonce: 3,
    gas: 65_000n,
    fee: {
        maxFeePerGas: new Decimal(20),
        maxPriorityFeePerGas: new Decimal(1),
        maxFee: new Decimal(1_300_000),
    },
    token: { contract: TOKEN, to: RECIPIENT, amount: new Decimal(5) },
}

describe('the Ethereum transaction view', () => {
    it('round-trips through its native form', () => {
        const native = toEthereumNative(VIEW)

        expect(native.family).toBe('evm')
        expect(readEthereumNative(native)).toEqual(VIEW)
    })

    it("refuses another family's transaction", () => {
        expect(() =>
            readEthereumNative({ family: 'algorand', transaction: VIEW }),
        ).toThrow(/Not an Ethereum transaction view/)
    })

    it.each([
        ['no transaction', null],
        ['a gas limit that is not a bigint', { ...VIEW, gas: 65_000 }],
        ['an unknown kind', { ...VIEW, kind: 'swap' }],
        ['a value that is not a Decimal', { ...VIEW, value: '0' }],
        ['a recipient that is not an address', { ...VIEW, to: 'bob' }],
        ['a malformed token', { ...VIEW, token: { contract: TOKEN } }],
    ])('refuses a view with %s', (_, transaction) => {
        expect(() =>
            readEthereumNative({ family: 'evm', transaction }),
        ).toThrow(/malformed/)
    })
})
