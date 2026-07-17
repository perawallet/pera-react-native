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

import { describe, it, expect, vi } from 'vitest'

let mockIdCounter = 0
vi.mock('@perawallet/wallet-core-shared', () => ({
    decodeFromBase64: (s: string) => new Uint8Array(Buffer.from(s, 'base64')),
    generateOrderedUniqueId: () => `mock-id-${++mockIdCounter}`,
}))

vi.mock(import('@perawallet/wallet-core-multisig'), async importOriginal => {
    const actual = await importOriginal()
    return { ...actual }
})

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import { buildMultisigCosignRequest } from '../buildMultisigCosignRequest'

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
    it('produces a multisig-cosign TransactionSignRequest with the threaded signRequestId', () => {
        const decodeTransaction = vi.fn(
            (_: Uint8Array) => ({ kind: 'tx' }) as unknown as PeraTransaction,
        )

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
        const decoded: PeraTransaction[] = [
            { idx: 0 } as unknown as PeraTransaction,
            { idx: 1 } as unknown as PeraTransaction,
        ]
        const decodeTransaction = vi.fn(
            (bytes: Uint8Array) => decoded[bytes[0] === 0x74 ? 0 : 1]!,
        )

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
        const decodeTransaction = vi.fn(
            () => ({}) as unknown as PeraTransaction,
        )

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
        const decodeTransaction = vi.fn(
            () => ({}) as unknown as PeraTransaction,
        )

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
        const decodeTransaction = vi.fn(
            () => ({}) as unknown as PeraTransaction,
        )
        const signRequest = buildSignRequest({ transactionLists: [] })

        expect(() =>
            buildMultisigCosignRequest({
                signRequest,
                signerAddress: 'A',
                decodeTransaction,
            }),
        ).toThrow(/no transaction lists/)
    })
})
