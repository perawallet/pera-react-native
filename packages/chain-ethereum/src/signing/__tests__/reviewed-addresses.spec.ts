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
import { ethereumReviewedAddresses } from '../reviewed-addresses'
import type { EvmStandardCall } from '../standard-call-types'
import {
    toEthereumNative,
    type EthereumTransactionView,
} from '../transaction-view'
import { SENDER } from './fixtures'

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const SPENDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

const BASE_VIEW: EthereumTransactionView = {
    kind: 'transfer',
    from: SENDER,
    to: RECIPIENT,
    value: new Decimal(1),
    data: '0x',
    nonce: 0,
    gas: 21_000n,
    fee: {
        maxFeePerGas: new Decimal(20),
        maxPriorityFeePerGas: new Decimal(1),
        maxFee: new Decimal(420_000),
    },
}

const reviewedOf = (view: Partial<EthereumTransactionView>) =>
    ethereumReviewedAddresses(
        toEthereumNative({ ...BASE_VIEW, ...view } as EthereumTransactionView),
    )

const callView = (call: EvmStandardCall): Partial<EthereumTransactionView> => ({
    kind: 'contract-call',
    to: TOKEN,
    value: new Decimal(0),
    data: '0x095ea7b3',
    call,
})

describe('ethereumReviewedAddresses', () => {
    it('names a native transfer’s recipient', () => {
        expect(reviewedOf({})).toEqual([
            { address: RECIPIENT, role: 'recipient' },
        ])
    })

    it.each([
        {
            kind: 'approve',
            contract: TOKEN,
            spender: SPENDER,
            value: new Decimal(5),
        },
        {
            kind: 'increase-allowance',
            contract: TOKEN,
            spender: SPENDER,
            value: new Decimal(5),
        },
    ] satisfies EvmStandardCall[])('names the spender of $kind', call => {
        expect(reviewedOf(callView(call))).toEqual([
            { address: SPENDER, role: 'spender' },
            { address: TOKEN, role: 'target' },
        ])
    })

    it('names the operator of a collection-wide approval', () => {
        expect(
            reviewedOf(
                callView({
                    kind: 'set-approval-for-all',
                    contract: TOKEN,
                    operator: SPENDER,
                    isApproved: true,
                }),
            ),
        ).toEqual([
            { address: SPENDER, role: 'operator' },
            { address: TOKEN, role: 'target' },
        ])
    })

    it.each([
        {
            kind: 'transfer',
            contract: TOKEN,
            from: SENDER,
            to: RECIPIENT,
            value: new Decimal(5),
        },
        {
            kind: 'transfer-from',
            contract: TOKEN,
            from: SPENDER,
            to: RECIPIENT,
            value: new Decimal(5),
        },
        {
            kind: 'erc721-safe-transfer',
            contract: TOKEN,
            from: SENDER,
            to: RECIPIENT,
            tokenId: '7',
        },
        {
            kind: 'erc1155-transfer',
            contract: TOKEN,
            from: SENDER,
            to: RECIPIENT,
            items: [{ tokenId: '7', amount: new Decimal(1) }],
        },
    ] satisfies EvmStandardCall[])(
        'names the token recipient of $kind',
        call => {
            expect(reviewedOf(callView(call))).toEqual([
                { address: RECIPIENT, role: 'token-recipient' },
                { address: TOKEN, role: 'target' },
            ])
        },
    )

    it('names the recipient of a token transfer the wallet built', () => {
        expect(
            reviewedOf({
                kind: 'token-transfer',
                to: TOKEN,
                data: '0xa9059cbb',
                token: {
                    contract: TOKEN,
                    to: RECIPIENT,
                    amount: new Decimal(5),
                },
            }),
        ).toEqual([
            { address: RECIPIENT, role: 'token-recipient' },
            { address: TOKEN, role: 'target' },
        ])
    })

    it('names the contract of a call it can’t read', () => {
        expect(
            reviewedOf({
                kind: 'contract-call',
                to: TOKEN,
                data: '0xdeadbeef',
            }),
        ).toEqual([{ address: TOKEN, role: 'target' }])
    })

    it('names nothing for a contract creation or another chain’s transaction', () => {
        expect(
            reviewedOf({ kind: 'contract-call', to: undefined, data: '0x60' }),
        ).toEqual([])
        expect(
            ethereumReviewedAddresses({ family: 'algorand', transaction: {} }),
        ).toEqual([])
    })
})
