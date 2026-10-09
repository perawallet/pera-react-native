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
import { Address } from 'algosdk'
import { Decimal } from 'decimal.js'
import {
    encodeAlgorandAddress,
    encodeTransactionRaw,
    groupTransactions,
    useFetchSuggestedMinFee,
} from '../../blockchain'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    PeraDisplayableTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    InvalidSignableDataError,
    type SigningResult,
    type SourceMetadata,
} from '@perawallet/wallet-core-signing'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetworkStore: {
        getState: () => ({ network: 'testnet' }),
        subscribe: () => () => {},
    },
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
import { makeTestAddress, makeTestPaymentTx } from './transactions'

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
        ] as unknown as PeraDisplayableTransaction[]

        const review = algorandPlannerAdapter.reviewGroupFees(
            txs,
            new Set(['ADDR1']),
        )

        expect(review.totalFee.eq(new Decimal(0.003))).toBe(true)
        expect(review.highFeeWarning).toBeNull()
    })

    test('validateGroup skips the group-hash recompute only for a cosigner', () => {
        const pair = groupTransactions([
            makeTestPaymentTx(senderA, { receiver: senderB, amount: 1n }),
            makeTestPaymentTx(senderA, { receiver: senderB, amount: 2n }),
        ])
        const subset = [pair[0]]

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

const txn = { sender: Address.fromString(SENDER) } as unknown as PeraTransaction
const sig = new Uint8Array([1, 2, 3])

describe('algorandPlannerAdapter.assembleSignedTransaction', () => {
    test('returns an unsigned envelope when there is no signature', () => {
        const signed = algorandPlannerAdapter.assembleSignedTransaction(txn)

        expect(signed.txn).toBe(txn)
        expect(signed.sig).toBeUndefined()
        expect(signed.sgnr).toBeUndefined()
    })

    test('leaves sgnr unset when the signer is the sender', () => {
        const signed = algorandPlannerAdapter.assembleSignedTransaction(txn, {
            sig,
            signerAddress: SENDER,
        })

        expect(signed.sig).toEqual(sig)
        expect(signed.sgnr).toBeUndefined()
    })

    test('names the signer in sgnr when it is not the sender (rekey)', () => {
        const signed = algorandPlannerAdapter.assembleSignedTransaction(txn, {
            sig,
            signerAddress: AUTH,
        })

        expect(signed.sig).toEqual(sig)
        expect(signed.sgnr?.toString()).toBe(AUTH)
    })
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
        ).toEqual({ source, msigMetadata: undefined, deviceId: undefined })
        expect(
            algorandPlannerAdapter.takeDraftProposeContext('draft-1'),
        ).toBeUndefined()
    })
})

describe('algorandPlannerAdapter.encodeUnsignedTransaction', () => {
    test('is the wire encoding without the signing-domain prefix', () => {
        const tx = makeTestPaymentTx(senderA, { receiver: senderB })

        const bytes = algorandPlannerAdapter.encodeUnsignedTransaction(tx)

        expect(bytes).toEqual(encodeTransactionRaw(tx))
        expect(new TextDecoder().decode(bytes.slice(0, 2))).not.toBe('TX')
    })
})

describe('algorandReviewerAdapter.toDisplayableTransaction', () => {
    test('maps a payment to its review model', () => {
        const tx = makeTestPaymentTx(senderA, {
            receiver: senderB,
            amount: 5n,
        })

        const display = algorandReviewerAdapter.toDisplayableTransaction(tx)

        expect(display?.txType).toBe('pay')
        expect(display?.sender).toBe(senderA.toString())
        expect(display?.paymentTransaction?.receiver).toBe(senderB.toString())
        expect(display?.paymentTransaction?.amount).toBe(5n)
    })
})

describe('algorandMessageSignerAdapter.signerPublicKey', () => {
    test('decodes an address to the 32-byte key it encodes', () => {
        const key = algorandMessageSignerAdapter.signerPublicKey(
            senderA.toString(),
        )

        expect(key).toHaveLength(32)
        expect(encodeAlgorandAddress(key)).toBe(senderA.toString())
    })

    test('throws on an invalid address', () => {
        expect(() =>
            algorandMessageSignerAdapter.signerPublicKey('not-an-address'),
        ).toThrow()
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
