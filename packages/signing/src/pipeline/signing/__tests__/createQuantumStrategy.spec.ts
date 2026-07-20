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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { isQuantumSignedTransaction } from '@perawallet/wallet-core-blockchain'
import { createQuantumStrategy } from '../createQuantumStrategy'
import type { AnalyzedSignableGroup, SignedTransactionData } from '../../types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    isQuantumAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        isQuantumAccount: mocks.isQuantumAccount,
    }
})

const quantumAccount = {
    type: 'quantum',
    address: 'ADDR',
    keyPairId: 'key-q',
} as unknown as WalletAccount

const algo25Account = {
    type: 'algo25',
    address: 'ADDR',
    keyPairId: 'key-1',
} as unknown as WalletAccount

const fakeTxn = { sender: 'ADDR' } as never

const emptyAnalysis = {
    totalFees: 0n,
    transactionSummaries: [],
    warnings: [],
    signableAddresses: [],
    riskLevel: 'low' as const,
}

const makeTransactionGroup = (): AnalyzedSignableGroup => ({
    data: {
        type: 'transactions',
        transactions: [fakeTxn, fakeTxn],
        indicesToSign: [0, 1],
    },
    source: { type: 'local' },
    signerAddress: 'ADDR',
    originalIndices: [3, 4],
    analysis: emptyAnalysis,
})

const makeArbitraryGroup = (): AnalyzedSignableGroup => ({
    data: {
        type: 'arbitrary-data',
        data: [
            { data: 'payload-1', signer: 'ADDR', chainId: 283 },
            { data: 'payload-2', signer: 'ADDR', chainId: 283 },
        ],
    },
    source: { type: 'walletconnect' },
    signerAddress: 'ADDR',
    analysis: emptyAnalysis,
})

const makeArc60Group = (): AnalyzedSignableGroup => ({
    data: {
        type: 'arc60',
        stdSigData: {
            data: 'data',
            signer: 'ADDR',
            domain: 'example.com',
            authenticatorData: new Uint8Array(32),
        },
        metadata: { scope: 1, encoding: 'base64' },
    },
    source: { type: 'arc60' },
    signerAddress: 'ADDR',
    analysis: emptyAnalysis,
})

describe('createQuantumStrategy', () => {
    let signQuantumTransactions: ReturnType<typeof vi.fn>
    let signArbitraryData: ReturnType<typeof vi.fn>
    let signArc60: ReturnType<typeof vi.fn>

    beforeEach(() => {
        signQuantumTransactions = vi.fn().mockResolvedValue([
            { txn: fakeTxn, pqSignedBytes: new Uint8Array([7, 7, 7]) },
            { txn: fakeTxn, pqSignedBytes: new Uint8Array([8, 8, 8]) },
        ])
        signArbitraryData = vi.fn().mockResolvedValue([new Uint8Array([1])])
        signArc60 = vi.fn().mockResolvedValue(new Uint8Array([2]))
        mocks.isQuantumAccount
            .mockReset()
            .mockImplementation(
                (account: WalletAccount) => account.type === 'quantum',
            )
    })

    const makeStrategy = () =>
        createQuantumStrategy({
            signQuantumTransactions,
            signArbitraryData,
            signArc60,
        })

    describe('canSign', () => {
        test('returns true for a quantum account', () => {
            expect(makeStrategy().canSign(quantumAccount)).toBe(true)
        })

        test('returns false for a non-quantum account', () => {
            expect(makeStrategy().canSign(algo25Account)).toBe(false)
        })
    })

    describe('sign - transactions', () => {
        test('signs a transactions group into QuantumSignedTransaction carriers', async () => {
            const group = makeTransactionGroup()

            const result = await makeStrategy().sign(group, quantumAccount)

            const signed = (result.signedData as SignedTransactionData).signed
            expect(isQuantumSignedTransaction(signed[0])).toBe(true)
            expect(
                isQuantumSignedTransaction(signed[0])
                    ? signed[0].pqSignedBytes.length
                    : 0,
            ).toBeGreaterThan(0)
            expect(result.signers[0].accountType).toBe('quantum')
            expect(result.originalIndices).toEqual([3, 4])
        })

        test('calls the injected signQuantumTransactions with the group transactions', async () => {
            const group = makeTransactionGroup()

            await makeStrategy().sign(group, quantumAccount)

            expect(signQuantumTransactions).toHaveBeenCalledWith(
                group.data.type === 'transactions'
                    ? group.data.transactions
                    : undefined,
                group.data.type === 'transactions'
                    ? group.data.indicesToSign
                    : undefined,
                quantumAccount,
            )
        })

        test('fires progress and completion callbacks', async () => {
            const callbacks = {
                onSigningStart: vi.fn(),
                onSigningComplete: vi.fn(),
                onProgress: vi.fn(),
            }

            await makeStrategy().sign(
                makeTransactionGroup(),
                quantumAccount,
                callbacks,
            )

            expect(callbacks.onSigningStart).toHaveBeenCalled()
            expect(callbacks.onProgress).toHaveBeenCalledWith(0, 2)
            expect(callbacks.onProgress).toHaveBeenCalledWith(2, 2)
            expect(callbacks.onSigningComplete).toHaveBeenCalled()
        })

        test('forwards error and wraps in SigningError', async () => {
            signQuantumTransactions.mockRejectedValue(new Error('kms down'))
            const onError = vi.fn()

            await expect(
                makeStrategy().sign(makeTransactionGroup(), quantumAccount, {
                    onError,
                }),
            ).rejects.toThrow('kms down')
            expect(onError).toHaveBeenCalled()
        })
    })

    describe('sign - arbitrary data', () => {
        test('delegates to signArbitraryData with message payloads', async () => {
            const result = await makeStrategy().sign(
                makeArbitraryGroup(),
                quantumAccount,
            )

            expect(signArbitraryData).toHaveBeenCalledWith(quantumAccount, [
                'payload-1',
                'payload-2',
            ])
            expect(result.signedData.type).toBe('arbitrary-data')
        })

        test('refuses to sign when an item claims a different signer than the resolving account', async () => {
            const group: AnalyzedSignableGroup = {
                data: {
                    type: 'arbitrary-data',
                    data: [
                        { data: 'payload-1', signer: 'ADDR', chainId: 283 },
                        { data: 'payload-2', signer: 'OTHER', chainId: 283 },
                    ],
                },
                source: { type: 'walletconnect' },
                signerAddress: 'ADDR',
                analysis: emptyAnalysis,
            }

            await expect(
                makeStrategy().sign(group, quantumAccount),
            ).rejects.toThrow(/signer/i)
            expect(signArbitraryData).not.toHaveBeenCalled()
        })
    })

    describe('sign - arc60', () => {
        test('delegates to signArc60 with stdSigData and metadata', async () => {
            const group = makeArc60Group()
            const result = await makeStrategy().sign(group, quantumAccount)

            expect(signArc60).toHaveBeenCalledWith(
                quantumAccount,
                group.data.type === 'arc60' ? group.data.stdSigData : undefined,
                group.data.type === 'arc60' ? group.data.metadata : undefined,
            )
            expect(result.signedData.type).toBe('arc60')
        })

        test('rejects a domain-mismatched request before signArc60 is called', async () => {
            // Domain validation lives inside the injected signArc60 (see
            // utils/arc60.ts's verifyAuthenticatorDomain) — simulate that
            // rejection here to prove the strategy propagates it without
            // masking or retrying.
            signArc60.mockRejectedValue(new Error('domain mismatch'))

            await expect(
                makeStrategy().sign(makeArc60Group(), quantumAccount),
            ).rejects.toThrow(/domain mismatch/i)
        })
    })

    describe('sign - errors', () => {
        test('throws CannotSignError when account is not a quantum account', async () => {
            await expect(
                makeStrategy().sign(makeTransactionGroup(), algo25Account),
            ).rejects.toThrow('Unsupported account type')
        })
    })
})
