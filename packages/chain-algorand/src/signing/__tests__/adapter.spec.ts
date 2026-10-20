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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import { Address } from 'algosdk'
import { Decimal } from 'decimal.js'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    Arc0001Error,
    Arc0001ErrorCode,
    encodeAlgorandAddress,
    encodeTransactionRaw,
    groupTransactions,
    readAlgorandNative,
    toAlgorandNative,
    useFetchSuggestedMinFee,
    type AlgorandTransactionView,
} from '../../blockchain'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { decodeSignedTransaction } from '../../blockchain/utils/transact'
import {
    InvalidSignableDataError,
    type SigningResult,
    type SourceMetadata,
} from '@perawallet/wallet-core-signing'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    assertScopeUnchanged: vi.fn(),
}))

import {
    algorandMessageSignerAdapter,
    algorandPlannerAdapter,
    algorandReviewerAdapter,
} from '../adapter'
import {
    useAlgorandFeeConfig,
    useAlgorandSuggestedMinFeeQuery,
} from '../feeHooks'
import { draftProposeContexts } from '../multisig/draftProposeContexts'
import {
    MAINNET_GENESIS_HASH,
    asUnsignedAlgorandTransaction,
    makeTestAddress,
    makeTestPaymentTx,
    makeUnsignedAlgorandTransaction,
} from './transactions'
import type { PeraDisplayableTransaction } from '../../blockchain/models/algosdk-shapes'

const senderA = makeTestAddress(1)
const senderB = makeTestAddress(2)
describe('algorandPlannerAdapter', () => {
    test('wires the fee hooks to the Algorand implementations', () => {
        expect(algorandPlannerAdapter.useFeeConfig).toBe(useAlgorandFeeConfig)
        expect(algorandPlannerAdapter.useSuggestedMinFeeQuery).toBe(
            useAlgorandSuggestedMinFeeQuery,
        )
        expect(algorandPlannerAdapter.useFetchSuggestedMinFee).toBe(
            useFetchSuggestedMinFee,
        )
    })

    test('reviewGroupFees reports the total fee and no warning for a cheap group', () => {
        const txs = [
            { fee: 1000n, txType: 'pay', sender: 'ADDR1' },
            { fee: 2000n, txType: 'pay', sender: 'ADDR1' },
        ].map(view => toAlgorandNative(view as AlgorandTransactionView))

        const review = algorandPlannerAdapter.reviewGroupFees(
            txs,
            new Set(['ADDR1']),
        )

        expect(review.totalFee.eq(new Decimal(0.003))).toBe(true)
        expect(review.highFeeWarning).toBeNull()
    })

    test('validateGroup skips the group-hash recompute only for a cosigner', () => {
        const pair = groupTransactions([
            makeTestPaymentTx(senderA, {
                receiver: senderB,
                amount: 1n,
                genesisHash: MAINNET_GENESIS_HASH,
            }),
            makeTestPaymentTx(senderA, {
                receiver: senderB,
                amount: 2n,
                genesisHash: MAINNET_GENESIS_HASH,
            }),
        ])
        const subset = [asUnsignedAlgorandTransaction(pair[0])]

        expect(() =>
            algorandPlannerAdapter.validateGroup(subset, { isCosigner: true }),
        ).not.toThrow()
        expect(() =>
            algorandPlannerAdapter.validateGroup(subset, { isCosigner: false }),
        ).toThrow(InvalidSignableDataError)
    })
})

const SENDER = 'B3FCOSKVDPADAVJ6LXZKAMXDC4DFNLPOINGM2ZDSAKEBVG4LJVRTPJ22QY'
const AUTH = 'SMYOGL34R6IPDMI6TGHYDDWIGH6Z3EDGTNDKLWYVHPGDTW5D5XAYGKY25U'

const payment = makeTestPaymentTx(Address.fromString(SENDER), {
    receiver: senderB,
    genesisHash: MAINNET_GENESIS_HASH,
})
const unsigned = asUnsignedAlgorandTransaction(payment)
const sig = new Uint8Array(64).fill(7)

describe('algorandPlannerAdapter.assembleSignedTransaction', () => {
    test('returns an unsigned envelope when there is no signature', () => {
        const signed =
            algorandPlannerAdapter.assembleSignedTransaction(unsigned)
        const envelope = decodeSignedTransaction(signed.bytes)

        expect(signed.scope).toEqual(unsigned.scope)
        expect(signed.id).toBe(payment.txID())
        expect(envelope.txn.txID()).toBe(payment.txID())
        expect(envelope.sig).toBeUndefined()
        expect(envelope.sgnr).toBeUndefined()
    })

    test('leaves sgnr unset when the signer is the sender', () => {
        const signed = algorandPlannerAdapter.assembleSignedTransaction(
            unsigned,
            {
                sig,
                signerAddress: SENDER,
            },
        )
        const envelope = decodeSignedTransaction(signed.bytes)

        expect(envelope.sig).toEqual(sig)
        expect(envelope.sgnr).toBeUndefined()
    })

    test('names the signer in sgnr when it is not the sender (rekey)', () => {
        const signed = algorandPlannerAdapter.assembleSignedTransaction(
            unsigned,
            {
                sig,
                signerAddress: AUTH,
            },
        )
        const envelope = decodeSignedTransaction(signed.bytes)

        expect(envelope.sig).toEqual(sig)
        expect(envelope.sgnr?.toString()).toBe(AUTH)
    })
})

describe('algorandPlannerAdapter.unsignedTransactionBytesOf', () => {
    test('is the unsigned encoding of the transaction an envelope carries, signed or not', () => {
        const expected =
            algorandPlannerAdapter.encodeUnsignedTransaction(unsigned)

        expect(
            algorandPlannerAdapter.unsignedTransactionBytesOf(
                algorandPlannerAdapter.assembleSignedTransaction(unsigned),
            ),
        ).toEqual(expected)
        expect(
            algorandPlannerAdapter.unsignedTransactionBytesOf(
                algorandPlannerAdapter.assembleSignedTransaction(unsigned, {
                    sig,
                    signerAddress: AUTH,
                }),
            ),
        ).toEqual(expected)
    })
})

describe('algorandPlannerAdapter dApp sign requests', () => {
    const context = { signableAddresses: new Set([SENDER]) }

    test('resolves the ARC-0001 request a payload carries, and enqueues what it resolved', async () => {
        const resolved = algorandPlannerAdapter.resolveDappRequest(
            {
                payload: {
                    transactions: [
                        { txn: encodeToBase64(encodeTransactionRaw(payment)) },
                    ],
                },
            },
            context,
        )
        const respondWithResult = vi.fn()

        const request = await algorandPlannerAdapter.enqueueDappRequest(
            { payload: { ...(resolved.payload as object), toSign: [] } },
            { respondWithResult } as never,
            {} as never,
        )

        expect(resolved.payload).toMatchObject({
            toSign: [{ index: 0, sender: SENDER }],
        })
        expect(request).toBeNull()
        expect(respondWithResult).toHaveBeenCalledWith([null])
    })

    test.each([null, 'txns', 1])(
        'refuses a payload of %s as invalid input',
        payload => {
            const resolve = () =>
                algorandPlannerAdapter.resolveDappRequest({ payload }, context)

            expect(resolve).toThrow(Arc0001Error)
            expect(resolve).toThrow(
                expect.objectContaining({
                    code: Arc0001ErrorCode.InvalidInput,
                }),
            )
        },
    )
})

describe('algorandPlannerAdapter.takeDraftProposeContext', () => {
    beforeEach(() => {
        draftProposeContexts.__resetForTests()
    })

    test('returns what the propose transport stashed for a hardware-only proposer, exactly once', async () => {
        const source: SourceMetadata = { type: 'local' }
        const deferred: SigningResult = {
            signedData: { type: 'transactions', signed: [] },
            signers: [],
        }
        const transport = algorandPlannerAdapter.createMultisigProposeTransport(
            vi.fn(),
            { chainId: 'algorand', networkId: 'testnet' },
            () => undefined,
            () => undefined,
            () => 'draft-1',
        )

        await transport.send(deferred, source, 'MSIG')

        expect(
            algorandPlannerAdapter.takeDraftProposeContext('draft-1'),
        ).toEqual({
            source,
            msigMetadata: undefined,
            deviceId: undefined,
        })
        expect(
            algorandPlannerAdapter.takeDraftProposeContext('draft-1'),
        ).toBeUndefined()
    })
})

describe('algorandPlannerAdapter.encodeUnsignedTransaction', () => {
    test('is the wire encoding without the signing-domain prefix', () => {
        const bytes = algorandPlannerAdapter.encodeUnsignedTransaction(unsigned)

        expect(bytes).toEqual(encodeTransactionRaw(payment))
        expect(new TextDecoder().decode(bytes.slice(0, 2))).not.toBe('TX')
    })
})

describe('algorandReviewerAdapter.toTransactionNative', () => {
    const fivePayment = () =>
        asUnsignedAlgorandTransaction(
            makeTestPaymentTx(senderA, {
                receiver: senderB,
                amount: 5n,
                genesisHash: MAINNET_GENESIS_HASH,
            }),
        )

    test('maps a payment to its review model', () => {
        const native =
            algorandReviewerAdapter.toTransactionNative(fivePayment())
        const view = native && readAlgorandNative(native)

        expect(native?.family).toBe('algorand')
        expect(view?.txType).toBe('pay')
        expect(view?.sender).toBe(senderA.toString())
        expect(view?.paymentTransaction?.receiver).toBe(senderB.toString())
        expect(view?.paymentTransaction?.amount).toBe(5n)
    })

    test("is null for a chain-neutral payload it can't read", () => {
        expect(
            algorandReviewerAdapter.toTransactionNative(
                makeUnsignedAlgorandTransaction(),
            ),
        ).toBeNull()
    })
})

describe('algorandMessageSignerAdapter.authData.signerPublicKey', () => {
    const authData = () => {
        const leg = algorandMessageSignerAdapter.authData
        if (!leg) throw new Error('Algorand signs auth data')
        return leg
    }

    test('decodes an address to the 32-byte key it encodes', () => {
        const key = authData().signerPublicKey(senderA.toString())

        expect(key).toHaveLength(32)
        expect(encodeAlgorandAddress(key)).toBe(senderA.toString())
    })

    test('throws on an invalid address', () => {
        expect(() => authData().signerPublicKey('not-an-address')).toThrow()
    })
})

describe('algorandMessageSignerAdapter.canSign', () => {
    const local: WalletAccount = {
        id: 'a1',
        custody: { kind: 'local', seed: null },
        chains: { algorand: { address: senderA.toString(), keyPairId: 'k1' } },
    }

    test.each(['arbitraryData', 'authData'] as const)(
        'signs %s with a local key',
        kind => {
            expect(algorandMessageSignerAdapter.canSign(local, kind)).toBe(true)
        },
    )

    test.each(['message', 'typedData'] as const)(
        'signs no %s, a kind Algorand has no format for',
        kind => {
            expect(algorandMessageSignerAdapter.canSign(local, kind)).toBe(
                false,
            )
        },
    )

    test('provides the auth-data leg', () => {
        expect(algorandMessageSignerAdapter.authData).toBeDefined()
    })
})

describe('algorandMessageSignerAdapter.signsVerifiably', () => {
    const accountWith = (custody: WalletAccount['custody']): WalletAccount => ({
        id: 'a1',
        custody,
        chains: { algorand: { address: senderA.toString(), keyPairId: 'k1' } },
    })

    test.each(['arbitraryData', 'authData'] as const)(
        "refuses a quantum account's %s signature, which no dApp can verify",
        kind => {
            expect(
                algorandMessageSignerAdapter.signsVerifiably(
                    accountWith({ kind: 'local', seed: 'quantum' }),
                    kind,
                ),
            ).toBe(false)
        },
    )

    test.each([
        ['standalone', { kind: 'local', seed: null }],
        ['HD', { kind: 'local', seed: 'bip39' }],
        ['watch', { kind: 'watch' }],
        ['multisig', { kind: 'multisig' }],
        [
            'Ledger',
            {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'd1',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
        ],
    ] as const)('accepts a %s account', (_, custody) => {
        expect(
            algorandMessageSignerAdapter.signsVerifiably(
                accountWith(custody as WalletAccount['custody']),
                'authData',
            ),
        ).toBe(true)
    })
})
