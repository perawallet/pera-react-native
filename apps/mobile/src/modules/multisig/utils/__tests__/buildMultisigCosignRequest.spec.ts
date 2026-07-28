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

// @vitest-environment node

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

let mockIdCounter = 0
vi.mock('@perawallet/wallet-core-shared', () => ({
    decodeFromBase64: (s: string) => new Uint8Array(Buffer.from(s, 'base64')),
    generateOrderedUniqueId: () => `mock-id-${++mockIdCounter}`,
}))

// Derivation is stubbed so the builder's checks can be exercised without real
// base32 participant addresses. The real generateMultisigAddress has its own
// spec in packages/blockchain. Defaults to the fixture's joint address.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    generateMultisigAddress: vi.fn(() => 'MULTISIG'),
}))

vi.mock(import('@perawallet/wallet-core-multisig'), async importOriginal => {
    const actual = await importOriginal()
    return { ...actual }
})

import {
    generateMultisigAddress,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import { buildMultisigCosignRequest } from '../buildMultisigCosignRequest'

// A decoded transaction only needs a `sender` whose toString() the builder
// compares against the joint account address.
const txFrom = (sender = 'MULTISIG'): PeraTransaction =>
    ({ sender: { toString: () => sender } }) as unknown as PeraTransaction

const buildSignRequest = (
    overrides: Partial<MultisigSignRequest> = {},
): MultisigSignRequest => ({
    id: 'sr-42',
    status: 'pending',
    type: 'async',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expectedExpireDatetime: new Date('2026-01-01T01:00:00Z'),
    failReasonDisplay: null,
    proposerAddress: null,
    multisigAccount: {
        customId: 'm-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        address: 'MULTISIG',
        version: 1,
        threshold: 2,
        participantAddresses: ['A', 'B', 'C'],
    },
    transactionLists: [
        {
            id: 'tl-1',
            rawTransactions: ['dHgx', 'dHgy'],
            firstValidBlock: 1,
            lastValidBlock: 1000,
            expectedExpireDatetime: new Date('2026-01-01T01:00:00Z'),
            responses: [],
        },
    ],
    ...overrides,
})

describe('buildMultisigCosignRequest', () => {
    beforeEach(() => {
        ;(generateMultisigAddress as Mock).mockReturnValue('MULTISIG')
    })

    it('produces a multisig-cosign TransactionSignRequest with the threaded signRequestId', () => {
        const decodeTransaction = vi.fn((_: Uint8Array) => txFrom())

        const result = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            decodeTransaction,
        })

        expect(result.type).toBe('transactions')
        expect(result.transport).toBe('callback')
        expect(result.sourceType).toBe('multisig-cosign')
        expect(result.signRequestId).toBe('sr-42')
    })

    it('decodes each base64 raw transaction in the first transaction list', () => {
        const decodeTransaction = vi.fn((_: Uint8Array) => txFrom())

        const result = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            decodeTransaction,
        })

        expect(decodeTransaction).toHaveBeenCalledTimes(2)
        expect(result.txs).toHaveLength(2)
        expect(result.rawTransactionsBase64).toEqual(['dHgx', 'dHgy'])
    })

    it('routes every tx to the same signer via signerOverrides', () => {
        const decodeTransaction = vi.fn(() => txFrom())

        const result = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'B',
            decodeTransaction,
        })

        expect(result.signerOverrides).toBeDefined()
        expect(result.signerOverrides!.get(0)).toBe('B')
        expect(result.signerOverrides!.get(1)).toBe('B')
    })

    it('assigns a non-empty unique id to each cosign request', () => {
        // Regression: an empty id collides in the actor map and `??` fall-
        // backs further upstream, so two cosigns trample each other and a
        // stale signing-event-bus failure falsely matches any future cosign.
        const decodeTransaction = vi.fn(() => txFrom())

        const a = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            decodeTransaction,
        })
        const b = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'B',
            decodeTransaction,
        })

        expect(a.id).not.toBe('')
        expect(b.id).not.toBe('')
        expect(a.id).not.toBe(b.id)
    })

    it('throws when the sign request has no transaction lists', () => {
        const decodeTransaction = vi.fn(() => txFrom())
        const signRequest = buildSignRequest({ transactionLists: [] })

        expect(() =>
            buildMultisigCosignRequest({
                signRequest,
                signerAddress: 'A',
                decodeTransaction,
            }),
        ).toThrow(/no transaction lists/)
    })

    // PERA-4711: a cosignature must never be a standalone-valid single sig.
    it('throws when a transaction is sent by the co-signer themselves (standalone-single-sig drain)', () => {
        // The joint account derives correctly, but one tx is sent by the
        // co-signer's OWN address. useLocalKeyTransactionSigner omits `sgnr`
        // when signer === sender, so that signature verifies standalone and
        // drains the co-signer. 'dHgx'/'dHgy' decode to "tx1"/"tx2"; they
        // differ only in the 3rd byte ('1' vs '2'), so key the offender off it.
        const decodeTransaction = vi.fn((bytes: Uint8Array) =>
            bytes[2] === 0x31 ? txFrom('MULTISIG') : txFrom('A'),
        )

        expect(() =>
            buildMultisigCosignRequest({
                signRequest: buildSignRequest(),
                signerAddress: 'A',
                decodeTransaction,
            }),
        ).toThrow(/sent by the co-signer/)
    })

    it('allows a sender rekeyed to the joint account — the subsig still binds to sgnr', () => {
        // Regression: requiring sender === joint account rejected the supported
        // flow where a watch account is rekeyed to a shared multisig (see the
        // sign-multisig-rekeyed integration test). Signer !== sender there, so
        // `sgnr` is set and the signature is not standalone-valid.
        const decodeTransaction = vi.fn(() => txFrom('REKEYED_SENDER'))

        const result = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            decodeTransaction,
        })

        expect(result.txs).toHaveLength(2)
        expect(result.signerOverrides!.get(0)).toBe('A')
    })

    it('throws when the joint account does not derive from its participant set (fabricated request)', () => {
        // A fabricated request whose claimed joint address is not the real
        // multisig hash of its participants — e.g. a participant's personal
        // address dressed up as the "joint account".
        ;(generateMultisigAddress as Mock).mockReturnValue('DERIVED_ELSEWHERE')
        const decodeTransaction = vi.fn(() => txFrom())

        expect(() =>
            buildMultisigCosignRequest({
                signRequest: buildSignRequest(),
                signerAddress: 'A',
                decodeTransaction,
            }),
        ).toThrow(/does not derive from its participant set/)
    })
})
