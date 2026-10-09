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

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockIdCounter = 0
vi.mock(import('@perawallet/wallet-core-shared'), async importOriginal => ({
    ...(await importOriginal()),
    decodeFromBase64: (s: string) => new Uint8Array(Buffer.from(s, 'base64')),
    generateOrderedUniqueId: () => `mock-id-${++mockIdCounter}`,
}))

const mocks = vi.hoisted(() => ({
    multisigAdapterFor: vi.fn(),
    validateSignRequest: vi.fn(),
}))

// The chain adapter owns the derive and sender checks (real-transaction
// coverage lives in chain-algorand); this spec covers what the builder feeds
// it and how it maps each verdict.
vi.mock(import('@perawallet/wallet-core-multisig'), async importOriginal => {
    const actual = await importOriginal()
    return { ...actual, multisigAdapterFor: mocks.multisigAdapterFor }
})

import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    authorityOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import { buildMultisigCosignRequest } from '../buildMultisigCosignRequest'

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
        vi.mocked(authorityOf).mockReset()
        mocks.validateSignRequest.mockReset()
        mocks.validateSignRequest.mockReturnValue({ kind: 'valid' })
        mocks.multisigAdapterFor.mockReturnValue({
            validateSignRequest: mocks.validateSignRequest,
        })
    })

    it('produces a multisig-cosign TransactionSignRequest with the threaded signRequestId', () => {
        const decodeTransaction = vi.fn((_: Uint8Array) => txFrom())

        const result = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            network: 'testnet',
            decodeTransaction,
            localAccounts: [],
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
            network: 'testnet',
            decodeTransaction,
            localAccounts: [],
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
            network: 'testnet',
            decodeTransaction,
            localAccounts: [],
        })

        expect(result.signerOverrides).toBeDefined()
        expect(result.signerOverrides!.get(0)).toBe('B')
        expect(result.signerOverrides!.get(1)).toBe('B')
    })

    it('assigns a deterministic id per (signRequestId, signer) so distinct signers stay distinct', () => {
        // A non-empty, distinct id per signer is what keeps the actor map and
        // the inline-error guards from letting two cosigns trample each other.
        const decodeTransaction = vi.fn(() => txFrom())

        const a = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            network: 'testnet',
            decodeTransaction,
            localAccounts: [],
        })
        const b = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'B',
            network: 'testnet',
            decodeTransaction,
            localAccounts: [],
        })

        expect(a.id).toBe('sr-42:A')
        expect(b.id).toBe('sr-42:B')
        expect(a.id).not.toBe(b.id)
    })

    it('is stable across rebuilds of the same (signRequestId, signer) so the queue dedups a re-dispatch', () => {
        // Same work-item → same id → the signing store's id-dedup drops a
        // repeat dispatch instead of stacking a duplicate review sheet.
        const decodeTransaction = vi.fn(() => txFrom())

        const first = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            network: 'testnet',
            decodeTransaction,
            localAccounts: [],
        })
        const second = buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            network: 'testnet',
            decodeTransaction,
            localAccounts: [],
        })

        expect(first.id).toBe(second.id)
    })

    it('throws when the sign request has no transaction lists', () => {
        const decodeTransaction = vi.fn(() => txFrom())
        const signRequest = buildSignRequest({ transactionLists: [] })

        expect(() =>
            buildMultisigCosignRequest({
                signRequest,
                signerAddress: 'A',
                network: 'testnet',
                decodeTransaction,
                localAccounts: [],
            }),
        ).toThrow(/no transaction lists/)
    })

    const authorizedSendersFor = (
        localAccounts: WalletAccount[],
        network: 'mainnet' | 'testnet' = 'testnet',
    ) => {
        buildMultisigCosignRequest({
            signRequest: buildSignRequest(),
            signerAddress: 'A',
            network,
            decodeTransaction: vi.fn(() => txFrom()),
            localAccounts,
        })
        return mocks.validateSignRequest.mock.calls[0][1] as Set<string>
    }

    it('validates through the adapter of the given network', () => {
        const signRequest = buildSignRequest()

        buildMultisigCosignRequest({
            signRequest,
            signerAddress: 'A',
            network: 'testnet',
            decodeTransaction: vi.fn(() => txFrom()),
            localAccounts: [],
        })

        expect(mocks.multisigAdapterFor).toHaveBeenCalledWith('testnet')
        expect(mocks.validateSignRequest).toHaveBeenCalledWith(
            signRequest,
            new Set(['MULTISIG']),
        )
    })

    it('authorizes a local sender rekeyed to the joint account — the subsig still binds to sgnr', () => {
        // Requiring sender === joint account would reject the supported flow
        // where a watch account is rekeyed to a shared multisig (see the
        // sign-multisig-rekeyed integration test).
        vi.mocked(authorityOf).mockImplementation(account =>
            account.address === 'REKEYED_SENDER' ? 'MULTISIG' : null,
        )
        const senders = authorizedSendersFor([
            { address: 'REKEYED_SENDER' },
        ] as WalletAccount[])

        expect(senders).toEqual(new Set(['MULTISIG', 'REKEYED_SENDER']))
    })

    // `sgnr` is not covered by the signature, so a subsig from participant key S
    // stands alone for any sender whose auth-addr is S — not only sender === S.
    it("does not authorize an account the co-signer's own key authorizes", () => {
        vi.mocked(authorityOf).mockImplementation(account =>
            account.address === 'REKEYED_TO_SIGNER' ? 'A' : null,
        )
        const senders = authorizedSendersFor([
            { address: 'REKEYED_TO_SIGNER' },
        ] as WalletAccount[])

        expect(senders).toEqual(new Set(['MULTISIG']))
    })

    it("reads the sender's rekey on the request's own network", () => {
        vi.mocked(authorityOf).mockImplementation((account, scope) =>
            account.address === 'REKEYED_ELSEWHERE' &&
            scope?.networkId === 'testnet'
                ? 'MULTISIG'
                : null,
        )
        const accounts = [
            { address: 'REKEYED_ELSEWHERE' },
        ] as unknown as WalletAccount[]

        expect(authorizedSendersFor(accounts, 'testnet')).toEqual(
            new Set(['MULTISIG', 'REKEYED_ELSEWHERE']),
        )
        mocks.validateSignRequest.mockClear()
        expect(authorizedSendersFor(accounts, 'mainnet')).toEqual(
            new Set(['MULTISIG']),
        )
    })

    it('does not authorize a local sender the joint account does not authorize', () => {
        const senders = authorizedSendersFor([
            { address: 'OTHER_LOCAL' },
        ] as unknown as WalletAccount[])

        expect(senders).toEqual(new Set(['MULTISIG']))
    })

    it('throws when the adapter reports an unauthorized sender (standalone-single-sig drain)', () => {
        mocks.validateSignRequest.mockReturnValue({
            kind: 'unauthorized-sender',
            txIndex: 1,
        })

        expect(() =>
            buildMultisigCosignRequest({
                signRequest: buildSignRequest(),
                signerAddress: 'A',
                network: 'testnet',
                decodeTransaction: vi.fn(() => txFrom()),
                localAccounts: [],
            }),
        ).toThrow(/transaction 1 is not authorized by the joint account/)
    })

    it('throws when the joint account does not derive from its participant set (fabricated request)', () => {
        mocks.validateSignRequest.mockReturnValue({ kind: 'address-mismatch' })

        expect(() =>
            buildMultisigCosignRequest({
                signRequest: buildSignRequest(),
                signerAddress: 'A',
                network: 'testnet',
                decodeTransaction: vi.fn(() => txFrom()),
                localAccounts: [],
            }),
        ).toThrow(/does not derive from its participant set/)
    })
})
