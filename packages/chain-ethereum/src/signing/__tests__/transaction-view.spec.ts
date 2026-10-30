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
import type { EvmStandardCall } from '../standard-call-types'
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

const NFT_CONTRACT = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const NFT_VIEW: EthereumTransactionView = {
    ...VIEW,
    kind: 'nft-transfer',
    to: NFT_CONTRACT,
    data: '0x42842e0e',
    selector: '0x42842e0e',
    token: undefined,
    nft: {
        assetId: `${NFT_CONTRACT}/7`,
        contract: NFT_CONTRACT,
        tokenId: '7',
        standard: 'erc721',
        to: RECIPIENT,
        amount: new Decimal(1),
    },
}

const SPENDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const CALL_VIEW: EthereumTransactionView = {
    ...VIEW,
    kind: 'contract-call',
    data: '0x095ea7b3',
    selector: '0x095ea7b3',
    token: undefined,
    call: {
        kind: 'approve',
        contract: TOKEN,
        spender: SPENDER,
        value: new Decimal(5),
    },
}

const STANDARD_CALLS: EvmStandardCall[] = [
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
        contract: NFT_CONTRACT,
        from: SENDER,
        to: RECIPIENT,
        tokenId: '7',
    },
    {
        kind: 'erc1155-transfer',
        contract: NFT_CONTRACT,
        from: SENDER,
        to: RECIPIENT,
        items: [{ tokenId: '7', amount: new Decimal(2) }],
    },
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
    {
        kind: 'set-approval-for-all',
        contract: NFT_CONTRACT,
        operator: SPENDER,
        isApproved: true,
    },
]

describe('the Ethereum transaction view', () => {
    it.each(STANDARD_CALLS.map(call => [call.kind, call] as const))(
        'round-trips a contract call read as %s',
        (_, call) => {
            const view = { ...CALL_VIEW, call }

            expect(readEthereumNative(toEthereumNative(view))).toEqual(view)
        },
    )

    it('round-trips through its native form', () => {
        const native = toEthereumNative(VIEW)

        expect(native.family).toBe('evm')
        expect(readEthereumNative(native)).toEqual(VIEW)
    })

    it('round-trips an NFT transfer through its native form', () => {
        expect(readEthereumNative(toEthereumNative(NFT_VIEW))).toEqual(NFT_VIEW)
    })

    it.each([
        [
            'with the fee paid',
            { isMined: true as const, feePaid: new Decimal(21_000) },
        ],
        ['without a fee', { isMined: true as const }],
    ])('round-trips a mined view %s', (_, mined) => {
        const view: EthereumTransactionView = {
            kind: 'contract-call',
            from: SENDER,
            to: TOKEN,
            value: new Decimal(0),
            data: '0x',
            ...mined,
        }

        expect(readEthereumNative(toEthereumNative(view))).toEqual(view)
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
        [
            'an NFT with an unknown standard',
            { ...NFT_VIEW, nft: { ...NFT_VIEW.nft, standard: 'erc404' } },
        ],
        [
            'an NFT whose token id is not decimal',
            { ...NFT_VIEW, nft: { ...NFT_VIEW.nft, tokenId: '0x7' } },
        ],
        [
            'a mined view whose fee is not a Decimal',
            {
                kind: 'transfer',
                from: SENDER,
                value: new Decimal(0),
                data: '0x',
                isMined: true,
                feePaid: '21000',
            },
        ],
        [
            'a standard call on a transfer view',
            { ...VIEW, call: CALL_VIEW.call },
        ],
        [
            'a standard call of an unknown kind',
            { ...CALL_VIEW, call: { ...CALL_VIEW.call, kind: 'permit' } },
        ],
        [
            'an approval without a spender',
            { ...CALL_VIEW, call: { ...CALL_VIEW.call, spender: 'bob' } },
        ],
        [
            'an ERC-1155 transfer with no items',
            { ...CALL_VIEW, call: { ...STANDARD_CALLS[3], items: [] } },
        ],
        [
            'a collection approval without a flag',
            {
                ...CALL_VIEW,
                call: { ...STANDARD_CALLS[6], isApproved: 'yes' },
            },
        ],
    ])('refuses a view with %s', (_, transaction) => {
        expect(() =>
            readEthereumNative({ family: 'evm', transaction }),
        ).toThrow(/malformed/)
    })
})
