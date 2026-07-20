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

import { describe, it, expect } from 'vitest'
import {
    Address,
    Transaction,
    TransactionType,
    encodeUnsignedTransaction,
    msgpackRawDecodeAsMap,
    msgpackRawEncode,
} from 'algosdk'
import { encodeTransaction } from '../../utils/transact'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

import { resolveArc0001SignTxnRequest } from '../resolve'
import { Arc0001Error } from '../errors'
import { Arc0001ErrorCode, type Arc0001WalletTransaction } from '../types'

const addrA = new Address(new Uint8Array(32).fill(1))
const addrB = new Address(new Uint8Array(32).fill(2))
const addrC = new Address(new Uint8Array(32).fill(3))

const baseParams = {
    fee: 1000n,
    minFee: 1000n,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisID: 'mainnet-v1.0',
    genesisHash: new Uint8Array(32).fill(0xab),
}

const makePayment = (sender: Address, amount: bigint = 1n): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender,
        suggestedParams: baseParams,
        paymentParams: { receiver: addrB, amount },
    })

const wrap = (
    tx: Transaction,
    extras: Partial<Arc0001WalletTransaction> = {},
): Arc0001WalletTransaction => ({
    txn: encodeToBase64(encodeTransaction(tx)),
    ...extras,
})

// algosdk v3 rejects a zero-address `rekeyTo` at construction, so `new
// Transaction` can't build one. Reproduce the real dApp wire payload by
// injecting a zero `rekey` field into a valid payment's msgpack.
const zeroRekeyTxnBase64 = (): string => {
    const map = msgpackRawDecodeAsMap(
        encodeUnsignedTransaction(makePayment(addrA)),
    ) as Map<string, unknown>
    map.set('rekey', new Uint8Array(32))
    return encodeToBase64(msgpackRawEncode(map))
}

describe('resolveArc0001SignTxnRequest', () => {
    describe('happy path — signers absent', () => {
        it('marks each entry whose sender is signable', () => {
            const result = resolveArc0001SignTxnRequest(
                { transactions: [wrap(makePayment(addrA))] },
                { signableAddresses: new Set([addrA.toString()]) },
            )

            expect(result.allDecoded).toHaveLength(1)
            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].index).toBe(0)
            expect(result.toSign[0].signer).toEqual({
                kind: 'single',
                address: addrA.toString(),
            })
            expect(result.signerOverrides.size).toBe(0)
        })

        it('skips entries whose sender is not in signableAddresses', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA)),
                        wrap(makePayment(addrC)),
                    ],
                },
                { signableAddresses: new Set([addrA.toString()]) },
            )

            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].index).toBe(0)
        })

        it('uses authAddr as the signer when sender is rekeyed', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA), {
                            authAddr: addrB.toString(),
                        }),
                    ],
                },
                { signableAddresses: new Set([addrB.toString()]) },
            )

            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].signer).toEqual({
                kind: 'single',
                address: addrB.toString(),
            })
            expect(result.signerOverrides.get(0)).toBe(addrB.toString())
        })
    })

    describe('signers: []  (do not sign)', () => {
        it('produces a non-signable entry — slot stays null downstream', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA), { signers: [] }),
                        wrap(makePayment(addrA)),
                    ],
                },
                { signableAddresses: new Set([addrA.toString()]) },
            )

            expect(result.allDecoded).toHaveLength(2)
            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].index).toBe(1)
        })

        it('rejects with 4200 when stxn is provided (passthrough unsupported)', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrA), {
                                signers: [],
                                stxn: 'AAAA',
                            }),
                        ],
                    },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.Unsupported,
                }),
            )
        })
    })

    describe('signers: [addr]  (single signer)', () => {
        it('signs when signers[0] equals the sender', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA), {
                            signers: [addrA.toString()],
                        }),
                    ],
                },
                { signableAddresses: new Set([addrA.toString()]) },
            )

            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].signer).toEqual({
                kind: 'single',
                address: addrA.toString(),
            })
        })

        it('signs when signers[0] equals authAddr (rekey case)', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA), {
                            authAddr: addrB.toString(),
                            signers: [addrB.toString()],
                        }),
                    ],
                },
                { signableAddresses: new Set([addrB.toString()]) },
            )

            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].signer).toEqual({
                kind: 'single',
                address: addrB.toString(),
            })
            expect(result.signerOverrides.get(0)).toBe(addrB.toString())
        })

        it('treats signers[0] as an implicit authAddr when authAddr is absent (Folks-Finance shape)', () => {
            // Spec-strict reading would reject this; we accept it to keep
            // rekeyed-contract dApps working — see resolve.ts.
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA), {
                            signers: [addrC.toString()],
                        }),
                    ],
                },
                { signableAddresses: new Set([addrC.toString()]) },
            )

            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].signer).toEqual({
                kind: 'single',
                address: addrC.toString(),
            })
            expect(result.signerOverrides.get(0)).toBe(addrC.toString())
        })

        it('rejects with 4300 when authAddr is given and signers[0] disagrees', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrA), {
                                authAddr: addrB.toString(),
                                signers: [addrC.toString()],
                            }),
                        ],
                    },
                    { signableAddresses: new Set([addrC.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.InvalidInput,
                    data: expect.objectContaining({ field: 'signers' }),
                }),
            )
        })

        it('skips when signers[0] is valid but the wallet cannot sign for it', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA), {
                            signers: [addrA.toString()],
                        }),
                        wrap(makePayment(addrB)),
                    ],
                },
                { signableAddresses: new Set([addrB.toString()]) },
            )

            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].index).toBe(1)
        })
    })

    describe('signers: [a, b]  (multisig)', () => {
        it('rejects with 4200 — multisig is not supported', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrA), {
                                signers: [addrA.toString(), addrB.toString()],
                                msig: {
                                    version: 1,
                                    threshold: 2,
                                    addrs: [addrA.toString(), addrB.toString()],
                                },
                            }),
                        ],
                    },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.Unsupported,
                }),
            )
        })
    })

    describe('msig presence', () => {
        it('rejects with 4200 even when msig appears with single signer', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrA), {
                                msig: {
                                    version: 1,
                                    threshold: 1,
                                    addrs: [addrA.toString()],
                                },
                            }),
                        ],
                    },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.Unsupported,
                }),
            )
        })
    })

    describe('address validity', () => {
        it('rejects with 4300 when authAddr is not a valid Algorand address', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrA), {
                                authAddr: 'NOT_AN_ADDRESS',
                            }),
                        ],
                    },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.InvalidInput,
                    data: expect.objectContaining({ field: 'authAddr' }),
                }),
            )
        })

        it('rejects with 4300 when signers contains an invalid address', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrA), {
                                signers: ['INVALID_ADDR'],
                            }),
                        ],
                    },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.InvalidInput,
                    data: expect.objectContaining({ field: 'signers' }),
                }),
            )
        })

        it('rejects with 4300 when the encoded txn is not valid base64 / msgpack', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    { transactions: [{ txn: 'this is not msgpack' }] },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.InvalidInput,
                    data: expect.objectContaining({ field: 'txn' }),
                }),
            )
        })

        // PERA-4503: algosdk v3 rejects a zero-address rekeyTo (algokit v10
        // tolerated it). Strict rejection is intended — this asserts it stays
        // a well-formed ARC-0001 InvalidInput carrying the decode reason (not
        // an unhandled crash); transports log the relayed rejection.
        it('rejects a zero-address rekeyTo with a 4300 carrying the reason', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    { transactions: [{ txn: zeroRekeyTxnBase64() }] },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.InvalidInput,
                    message: expect.stringContaining('zero address'),
                    data: expect.objectContaining({ index: 0, field: 'txn' }),
                }),
            )
        })
    })

    describe('authorizedAddresses gate (e.g. WalletConnect session)', () => {
        it('rejects with 4100 when a local sender is not in the authorized set', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    { transactions: [wrap(makePayment(addrA))] },
                    {
                        signableAddresses: new Set([
                            addrA.toString(),
                            addrB.toString(),
                        ]),
                        authorizedAddresses: new Set([addrB.toString()]),
                    },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.Unauthorized,
                }),
            )
        })

        it('rejects with 4100 when an explicit signer targets a non-authorized local account', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrA), {
                                authAddr: addrB.toString(),
                                signers: [addrB.toString()],
                            }),
                        ],
                    },
                    {
                        signableAddresses: new Set([
                            addrA.toString(),
                            addrB.toString(),
                        ]),
                        authorizedAddresses: new Set([addrA.toString()]),
                    },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.Unauthorized,
                }),
            )
        })

        it('allows entries whose sender is a third-party (not local at all) — wallet just skips them', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA)), // local + authorized
                        wrap(makePayment(addrC)), // not local, not authorized — just skip
                    ],
                },
                {
                    signableAddresses: new Set([addrA.toString()]),
                    authorizedAddresses: new Set([addrA.toString()]),
                },
            )

            expect(result.toSign).toHaveLength(1)
            expect(result.toSign[0].index).toBe(0)
        })

        it('does not gate signers: [] entries — those never reach the signing path', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [wrap(makePayment(addrA), { signers: [] })],
                },
                {
                    signableAddresses: new Set([addrA.toString()]),
                    authorizedAddresses: new Set([addrB.toString()]),
                },
            )

            expect(result.toSign).toHaveLength(0)
        })
    })

    describe('all-unsignable requests', () => {
        it('rejects with 4100 when no requested transaction is wallet-signable', () => {
            // Post-session-approval drift (e.g. the approved account rekeyed
            // to an external key) must produce an error, not a success-shaped
            // all-null response the dApp can't act on.
            expect(() =>
                resolveArc0001SignTxnRequest(
                    {
                        transactions: [
                            wrap(makePayment(addrC)),
                            wrap(makePayment(addrC), { signers: [] }),
                        ],
                    },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.Unauthorized,
                }),
            )
        })

        it('keeps the all-null success contract when every entry is an explicit do-not-sign', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA), { signers: [] }),
                        wrap(makePayment(addrC), { signers: [] }),
                    ],
                },
                { signableAddresses: new Set([addrA.toString()]) },
            )

            expect(result.toSign).toHaveLength(0)
        })
    })

    describe('request-size cap', () => {
        it('rejects with 4201 when transactions exceed maxTransactions', () => {
            const txns = Array.from({ length: 17 }, () =>
                wrap(makePayment(addrA)),
            )
            expect(() =>
                resolveArc0001SignTxnRequest(
                    { transactions: txns },
                    {
                        signableAddresses: new Set([addrA.toString()]),
                        maxTransactions: 16,
                    },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.TooManyTransactions,
                }),
            )
        })
    })

    describe('empty input', () => {
        it('rejects with 4300 when transactions is empty', () => {
            expect(() =>
                resolveArc0001SignTxnRequest(
                    { transactions: [] },
                    { signableAddresses: new Set([addrA.toString()]) },
                ),
            ).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.InvalidInput,
                }),
            )
        })
    })

    describe('mixed group', () => {
        it('handles a Folks-Finance-style group of user + contract txns', () => {
            const result = resolveArc0001SignTxnRequest(
                {
                    transactions: [
                        wrap(makePayment(addrA)), // sign
                        wrap(makePayment(addrC)), // skip (not local)
                        wrap(makePayment(addrA), { signers: [] }), // do-not-sign
                        wrap(makePayment(addrA)), // sign
                    ],
                },
                { signableAddresses: new Set([addrA.toString()]) },
            )

            expect(result.allDecoded).toHaveLength(4)
            expect(result.toSign).toHaveLength(2)
            expect(result.toSign.map(t => t.index)).toEqual([0, 3])
        })
    })

    describe('error type', () => {
        it('throws Arc0001Error instances', () => {
            try {
                resolveArc0001SignTxnRequest(
                    { transactions: [] },
                    { signableAddresses: new Set() },
                )
            } catch (e) {
                expect(e).toBeInstanceOf(Arc0001Error)
                return
            }
            throw new Error('expected resolve to throw')
        })
    })
})
