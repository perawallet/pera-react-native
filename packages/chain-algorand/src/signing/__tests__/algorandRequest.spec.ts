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
import {
    GenesisHashMismatchError,
    InvalidSignableDataError,
    type FeeAdjustment,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { groupTransactions, readAlgorandNative } from '../../blockchain'
import { algorandPlannerAdapter, algorandReviewerAdapter } from '../adapter'
import {
    algorandRequestOf,
    algorandSignedForAddresses,
    algorandTransactionsOf,
    readAlgorandTransactionsData,
} from '../algorandRequest'
import {
    asUnsignedAlgorandTransaction,
    MAINNET_GENESIS_HASH,
    makeTestAddress,
    makeTestPaymentTx,
    makeUnsignedAlgorandTransaction,
} from './transactions'

const SENDER = makeTestAddress(1)
const AUTH = makeTestAddress(3).toString()

const payment = (amount: bigint, genesisHash = MAINNET_GENESIS_HASH) =>
    makeTestPaymentTx(SENDER, {
        receiver: makeTestAddress(2),
        amount,
        genesisHash,
    })

const GROUP = [payment(1n), payment(2n), payment(3n)]
const FEE_ADJUSTMENTS: FeeAdjustment[] = [
    {
        index: 2,
        originalFee: 1000n,
        adjustedFee: 2000n,
        reason: 'quantum-minimum',
    },
]

const neutralRequest = (overrides: object = {}): TransactionSignRequest =>
    ({
        id: 'req',
        type: 'transactions',
        transport: 'callback',
        txs: [GROUP[0], GROUP[2]].map(txn =>
            asUnsignedAlgorandTransaction(txn),
        ),
        ...overrides,
    }) as TransactionSignRequest

describe('algorandRequestOf', () => {
    it('is null for a request rehydrated with transactions that are not chain-neutral', () => {
        const request = {
            id: 'req',
            type: 'transactions',
            transport: 'algod',
            chainId: 'algorand',
            txs: GROUP,
        } as unknown as TransactionSignRequest

        expect(algorandRequestOf(request)).toBeNull()
    })

    it('reads a chain-neutral request into the Algorand group its payloads and facts describe', () => {
        const signerOverrides = new Map([[1, AUTH]])
        const request = neutralRequest({
            chainData: {
                algorand: {
                    groupContext: GROUP.map(txn =>
                        asUnsignedAlgorandTransaction(txn),
                    ),
                    signableIndices: [0, 2],
                    signerOverrides,
                    rawTransactionsBase64: ['raw-0', 'raw-2'],
                    feeAdjustments: FEE_ADJUSTMENTS,
                },
            },
        })

        expect(algorandRequestOf(request)).toEqual({
            txs: [GROUP[0], GROUP[2]],
            groupContext: GROUP,
            signableIndices: [0, 2],
            signerOverrides,
            rawTransactionsBase64: ['raw-0', 'raw-2'],
            feeAdjustments: FEE_ADJUSTMENTS,
        })
    })

    it("is null when a payload isn't a readable Algorand transaction", () => {
        const request = neutralRequest({
            txs: [makeUnsignedAlgorandTransaction()],
        })

        expect(algorandRequestOf(request)).toBeNull()
    })

    it('is null when a payload was built for another network', () => {
        const request = neutralRequest({
            txs: [
                asUnsignedAlgorandTransaction(
                    payment(1n, new Uint8Array(32).fill(0xab)),
                ),
            ],
        })

        expect(algorandRequestOf(request)).toBeNull()
    })
})

describe('algorandSignedForAddresses', () => {
    const OTHER = makeTestAddress(9).toString()
    const request = (
        txs: ReturnType<typeof asUnsignedAlgorandTransaction>[],
        signerOverrides?: Map<number, string>,
    ) =>
        ({
            ...neutralRequest({ txs }),
            chainData: { algorand: { signerOverrides } },
        }) as Parameters<typeof algorandSignedForAddresses>[0]

    it('keys each transaction by its sender', () => {
        expect(
            algorandSignedForAddresses(
                request([asUnsignedAlgorandTransaction(GROUP[0])]),
            ),
        ).toEqual([SENDER.toString()])
    })

    it.each([
        ['the sender', SENDER.toString()],
        ['the authority the payload names', AUTH],
    ])('takes an override naming %s', (_, override) => {
        expect(
            algorandSignedForAddresses(
                request(
                    [
                        asUnsignedAlgorandTransaction(GROUP[0], {
                            authorizer: AUTH,
                        }),
                    ],
                    new Map([[0, override]]),
                ),
            ),
        ).toEqual([override])
    })

    it("refuses an override naming an account the payload doesn't sign with", () => {
        expect(() =>
            algorandSignedForAddresses(
                request(
                    [asUnsignedAlgorandTransaction(GROUP[0])],
                    new Map([[0, OTHER]]),
                ),
            ),
        ).toThrow(InvalidSignableDataError)
    })
})

describe('algorandTransactionsOf', () => {
    it('reads the Algorand transaction each payload carries', () => {
        expect(
            algorandTransactionsOf(
                GROUP.map(txn => asUnsignedAlgorandTransaction(txn)),
            ),
        ).toEqual(GROUP)
    })
})

describe('readAlgorandTransactionsData', () => {
    it('reads the transactions, indices and raw bytes of a chain-neutral group', () => {
        expect(
            readAlgorandTransactionsData({
                type: 'transactions',
                transactions: GROUP.map(txn =>
                    asUnsignedAlgorandTransaction(txn),
                ),
                chainData: {
                    algorand: {
                        indicesToSign: [0, 2],
                        rawTransactionsBase64: ['a', 'b', 'c'],
                    },
                },
            }),
        ).toEqual({
            transactions: GROUP.map(txn => asUnsignedAlgorandTransaction(txn)),
            indicesToSign: [0, 2],
            rawTransactionsBase64: ['a', 'b', 'c'],
        })
    })

    it('signs every transaction of a chain-neutral group that names no indices', () => {
        expect(
            readAlgorandTransactionsData({
                type: 'transactions',
                transactions: GROUP.map(txn =>
                    asUnsignedAlgorandTransaction(txn),
                ),
                chainData: {},
            }),
        ).toEqual({
            transactions: GROUP.map(txn => asUnsignedAlgorandTransaction(txn)),
            indicesToSign: [0, 1, 2],
        })
    })

    it("refuses as invalid data a payload that isn't Algorand's", () => {
        expect(() =>
            readAlgorandTransactionsData({
                type: 'transactions',
                transactions: [makeUnsignedAlgorandTransaction()],
                chainData: {},
            }),
        ).toThrow(InvalidSignableDataError)
    })

    it('keeps the genesis mismatch of a payload built for another network', () => {
        expect(() =>
            readAlgorandTransactionsData({
                type: 'transactions',
                transactions: [
                    asUnsignedAlgorandTransaction(
                        payment(1n, new Uint8Array(32).fill(0xab)),
                    ),
                ],
                chainData: {},
            }),
        ).toThrow(GenesisHashMismatchError)
    })
})

describe('the Algorand adapters on a chain-neutral group', () => {
    it('checks the integrity of a chain-neutral group as the Algorand group its payloads carry', () => {
        const grouped = groupTransactions([
            payment(1n),
            payment(2n),
            payment(3n),
        ])
        const neutral = (txns: typeof grouped) =>
            txns.map(txn => asUnsignedAlgorandTransaction(txn))

        expect(() =>
            algorandPlannerAdapter.validateGroup(neutral(grouped), {
                isCosigner: false,
            }),
        ).not.toThrow()
        expect(() =>
            algorandPlannerAdapter.validateGroup(neutral(grouped.slice(0, 2)), {
                isCosigner: false,
            }),
        ).toThrow(InvalidSignableDataError)
    })

    it('reviews a chain-neutral transaction as the Algorand transaction it carries', () => {
        const native = algorandReviewerAdapter.toTransactionNative(
            asUnsignedAlgorandTransaction(GROUP[0]),
        )

        expect(native?.family).toBe('algorand')
        expect(
            native && readAlgorandNative(native)?.paymentTransaction?.amount,
        ).toBe(1n)
    })

    it('reads chain-neutral group data the way its signers need it', () => {
        expect(
            algorandPlannerAdapter.readTransactionsData({
                type: 'transactions',
                transactions: [asUnsignedAlgorandTransaction(GROUP[0])],
                chainData: {},
            }),
        ).toEqual({
            transactions: [asUnsignedAlgorandTransaction(GROUP[0])],
            indicesToSign: [0],
        })
    })
})
