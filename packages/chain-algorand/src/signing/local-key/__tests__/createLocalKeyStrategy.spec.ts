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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLocalKeyStrategy } from '../createLocalKeyStrategy'
import { makeUnsignedAlgorandTransaction } from '../../__tests__/transactions'
import type { AnalyzedSignableGroup } from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AppError, ErrorCategory, logger } from '@perawallet/wallet-core-shared'
import { KeyNotFoundError } from '@perawallet/wallet-core-kms'
import {
    SigningError,
    SIGNING_ERROR_KEYS,
} from '@perawallet/wallet-core-signing'
import {
    standaloneAccount as algo25,
    hardwareAccount,
    hdAccount,
    quantumAccount as quantum,
} from '../../../__tests__/algorandAccounts'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'

const ALGORAND_MAINNET = {
    chainId: ALGORAND_CHAIN_ID,
    networkId: 'mainnet',
} as const

const standaloneAccount = algo25('ADDR', { keyPairId: 'key-1' })

const quantumAccount = quantum('ADDR', { keyPairId: 'key-q' })

const hdWalletAccount = hdAccount('ADDR', { keyPairId: 'key-hd' })

const unsupportedAccount = hardwareAccount('ADDR')

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
        transactions: [
            { sender: 'ADDR' } as never,
            { sender: 'ADDR' } as never,
        ],
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
        type: 'auth-data',
        authData: {
            data: 'data',
            signer: 'ADDR',
            domain: 'example.com',
            authenticatorData: new Uint8Array(32),
        },
        metadata: { scope: 1, encoding: 'base64' },
    },
    source: { type: 'card' },
    signerAddress: 'ADDR',
    analysis: emptyAnalysis,
})

describe('createLocalKeyStrategy', () => {
    let signTransactions: ReturnType<typeof vi.fn>
    let signArbitraryData: ReturnType<typeof vi.fn>
    let signAuthData: ReturnType<typeof vi.fn>
    let errorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        signTransactions = vi
            .fn()
            .mockResolvedValue([
                { blob: new Uint8Array() },
                { blob: new Uint8Array() },
            ])
        signArbitraryData = vi.fn().mockResolvedValue([new Uint8Array([1])])
        signAuthData = vi.fn().mockResolvedValue(new Uint8Array([2]))
        errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
        errorSpy.mockRestore()
    })

    const makeStrategy = () =>
        createLocalKeyStrategy({
            signTransactions,
            signArbitraryData,
            signAuthData,
            scope: ALGORAND_MAINNET,
        })

    describe('canSign', () => {
        test('returns true when account has signing keys', () => {
            expect(makeStrategy().canSign(standaloneAccount)).toBe(true)
        })

        test('returns false when account lacks signing keys', () => {
            expect(makeStrategy().canSign(unsupportedAccount)).toBe(false)
        })

        test('canSign is true for a quantum account (routes through the shared local-key path)', () => {
            expect(makeStrategy().canSign(quantumAccount)).toBe(true)
        })

        test('returns true for algo25 accounts', () => {
            expect(makeStrategy().canSign(standaloneAccount)).toBe(true)
        })

        test('returns true for HD wallet accounts', () => {
            expect(makeStrategy().canSign(hdWalletAccount)).toBe(true)
        })
    })

    describe('sign - transactions', () => {
        test('refuses chain-neutral transactions for good, without signing anything', async () => {
            const group = {
                ...makeTransactionGroup(),
                data: {
                    type: 'transactions',
                    transactions: [makeUnsignedAlgorandTransaction()],
                    chainData: {},
                },
            } as unknown as AnalyzedSignableGroup

            await expect(
                makeStrategy().sign(group, standaloneAccount),
            ).rejects.toMatchObject({
                metadata: expect.objectContaining({ retryable: false }),
            })
            expect(signTransactions).not.toHaveBeenCalled()
        })

        test('signs and calls start/progress/complete callbacks', async () => {
            const callbacks = {
                onSigningStart: vi.fn(),
                onSigningComplete: vi.fn(),
                onProgress: vi.fn(),
            }
            const group = makeTransactionGroup()

            const result = await makeStrategy().sign(
                group,
                standaloneAccount,
                callbacks,
            )

            expect(callbacks.onSigningStart).toHaveBeenCalled()
            expect(callbacks.onProgress).toHaveBeenCalledWith(0, 2)
            expect(callbacks.onProgress).toHaveBeenCalledWith(2, 2)
            expect(callbacks.onSigningComplete).toHaveBeenCalled()
            expect(result.signedData.type).toBe('transactions')
            // signatures are derived from each signed txn's `sig` field; the
            // mock returns objects without `sig` so signatures are null.
            // The cosign-signature population path is verified in its own
            // test below.
            expect(result.signers).toEqual([
                {
                    address: 'ADDR',
                    signatures: [null, null],
                },
            ])
            expect(result.originalIndices).toEqual([3, 4])
            // The strategy must plumb the resolved auth account through to
            // the local signer — without this, signing falls back to
            // tx.sender lookup and breaks multisig cosign.
            expect(signTransactions).toHaveBeenCalledWith(
                group.data.type === 'transactions'
                    ? group.data.transactions
                    : undefined,
                group.data.type === 'transactions'
                    ? group.data.indicesToSign
                    : undefined,
                standaloneAccount,
                ALGORAND_MAINNET,
            )
        })

        test('signs a quantum account through the shared local-key path', async () => {
            // Quantum accounts are no longer swept into a separate strategy —
            // createQuantumStrategy/quantumSignerActor are deleted. The
            // signature scheme (plain sig vs. pqsig) is resolved inside the
            // injected signTransactions function, so this strategy only
            // validates that the key is local.
            const group = makeTransactionGroup()

            const result = await makeStrategy().sign(group, quantumAccount)

            expect(result.signedData.type).toBe('transactions')
            expect(signTransactions).toHaveBeenCalledWith(
                group.data.type === 'transactions'
                    ? group.data.transactions
                    : undefined,
                group.data.type === 'transactions'
                    ? group.data.indicesToSign
                    : undefined,
                quantumAccount,
                ALGORAND_MAINNET,
            )
        })

        test('populates signers[].signatures with base64-encoded sig bytes (multisig cosign feeds the backend from this)', async () => {
            // Real KMS hooks return PeraSignedTransaction with `sig` set —
            // the multisig cosign transport reads `signers[].signatures`
            // (NOT `signedData`) when posting to /joint-accounts/.../responses.
            // Without this, the request body is `signatures: [[]]` and the
            // backend rejects with "Lengths of transaction list and
            // signature list should be equal."
            signTransactions.mockResolvedValue([
                { txn: {}, sig: new Uint8Array([1, 2, 3]) },
                { txn: {}, sig: new Uint8Array([4, 5, 6]) },
            ])

            const result = await makeStrategy().sign(
                makeTransactionGroup(),
                standaloneAccount,
            )

            expect(result.signers).toHaveLength(1)
            expect(result.signers[0].address).toBe('ADDR')
            expect(result.signers[0].signatures).toEqual([
                Buffer.from([1, 2, 3]).toString('base64'),
                Buffer.from([4, 5, 6]).toString('base64'),
            ])
        })

        test('forwards error and wraps in SigningError', async () => {
            signTransactions.mockRejectedValue(new Error('bad key'))
            const onError = vi.fn()

            await expect(
                makeStrategy().sign(makeTransactionGroup(), standaloneAccount, {
                    onError,
                }),
            ).rejects.toThrow('bad key')
            expect(onError).toHaveBeenCalled()
        })

        test('wraps non-Error rejections as SigningError', async () => {
            signTransactions.mockRejectedValue('boom')

            await expect(
                makeStrategy().sign(makeTransactionGroup(), standaloneAccount),
            ).rejects.toThrow('boom')
        })
    })

    describe('sign - arbitrary data', () => {
        test('delegates to signArbitraryData with message payloads', async () => {
            const result = await makeStrategy().sign(
                makeArbitraryGroup(),
                standaloneAccount,
            )

            expect(signArbitraryData).toHaveBeenCalledWith(standaloneAccount, [
                'payload-1',
                'payload-2',
            ])
            expect(result.signedData.type).toBe('arbitrary-data')
        })

        test('wraps errors in SigningError and calls onError', async () => {
            signArbitraryData.mockRejectedValue(new Error('sig fail'))
            const onError = vi.fn()

            await expect(
                makeStrategy().sign(makeArbitraryGroup(), standaloneAccount, {
                    onError,
                }),
            ).rejects.toThrow('sig fail')
            expect(onError).toHaveBeenCalled()
        })

        test('wraps non-Error rejections', async () => {
            signArbitraryData.mockRejectedValue(42)

            await expect(
                makeStrategy().sign(makeArbitraryGroup(), standaloneAccount),
            ).rejects.toThrow('42')
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
                makeStrategy().sign(group, standaloneAccount),
            ).rejects.toThrow(/signer/i)
            expect(signArbitraryData).not.toHaveBeenCalled()
        })
    })

    describe('sign - arc60', () => {
        test('delegates to signAuthData with authData and metadata', async () => {
            const group = makeArc60Group()
            const result = await makeStrategy().sign(group, standaloneAccount)

            expect(signAuthData).toHaveBeenCalledWith(
                standaloneAccount,
                group.data.type === 'auth-data'
                    ? group.data.authData
                    : undefined,
                group.data.type === 'auth-data'
                    ? group.data.metadata
                    : undefined,
            )
            expect(result.signedData.type).toBe('auth-data')
        })

        test('wraps errors in SigningError and calls onError', async () => {
            signAuthData.mockRejectedValue(new Error('arc60 fail'))
            const onError = vi.fn()

            await expect(
                makeStrategy().sign(makeArc60Group(), standaloneAccount, {
                    onError,
                }),
            ).rejects.toThrow('arc60 fail')
            expect(onError).toHaveBeenCalled()
        })

        test('wraps non-Error rejections', async () => {
            signAuthData.mockRejectedValue('bad')

            await expect(
                makeStrategy().sign(makeArc60Group(), standaloneAccount),
            ).rejects.toThrow('bad')
        })
    })

    describe('sign - errors', () => {
        test('throws CannotSignError when account has no signing keys', async () => {
            await expect(
                makeStrategy().sign(makeTransactionGroup(), unsupportedAccount),
            ).rejects.toThrow('Account does not have local signing keys')
        })

        test('throws CannotSignError for a non-local account that carries a key', async () => {
            const weirdAccount: WalletAccount = {
                ...hardwareAccount('ADDR'),
                chains: {
                    [ALGORAND_CHAIN_ID]: {
                        address: 'ADDR',
                        keyPairId: 'stray-key',
                    },
                },
            }

            await expect(
                makeStrategy().sign(makeTransactionGroup(), weirdAccount),
            ).rejects.toThrow('Unsupported account type')
        })

        describe('failure reporting', () => {
            test('forwards a KMS cause key so the toast names the key fault', async () => {
                const cause = new KeyNotFoundError('key-1')
                signTransactions.mockRejectedValue(cause)

                const error = await makeStrategy()
                    .sign(makeTransactionGroup(), standaloneAccount)
                    .catch((e: unknown) => e)

                expect(error).toBeInstanceOf(SigningError)
                expect((error as SigningError).metadata.messageKey).toBe(
                    'errors.kms.key_not_found',
                )
                expect((error as SigningError).metadata.titleKey).toBe(
                    SIGNING_ERROR_KEYS.title,
                )
                expect((error as SigningError).originalError).toBe(cause)
            })

            test('falls back to the local-key body for an untyped cause', async () => {
                signTransactions.mockRejectedValue(
                    new Error('key key-1 does not hold key bytes'),
                )

                const error = await makeStrategy()
                    .sign(makeTransactionGroup(), standaloneAccount)
                    .catch((e: unknown) => e)

                expect((error as SigningError).metadata.messageKey).toBe(
                    SIGNING_ERROR_KEYS.localKeyFailed,
                )
            })

            test('keeps an AppError cause without a key on the local-key body', async () => {
                signTransactions.mockRejectedValue(new AppError('internal', {}))

                const error = await makeStrategy()
                    .sign(makeTransactionGroup(), standaloneAccount)
                    .catch((e: unknown) => e)

                expect((error as SigningError).metadata.messageKey).toBe(
                    SIGNING_ERROR_KEYS.localKeyFailed,
                )
            })

            test('reports the failure once with the cause and no key material', async () => {
                const cause = new KeyNotFoundError('key-1')
                signTransactions.mockRejectedValue(cause)

                await makeStrategy()
                    .sign(makeTransactionGroup(), standaloneAccount)
                    .catch(() => undefined)

                expect(errorSpy).toHaveBeenCalledTimes(1)
                expect(errorSpy).toHaveBeenCalledWith(
                    'Local-key signing failed',
                    {
                        error: cause,
                        accountType: 'standalone',
                        dataType: 'transactions',
                    },
                )
            })

            test('does not report a successful sign', async () => {
                signTransactions.mockResolvedValue([])

                await makeStrategy().sign(
                    makeTransactionGroup(),
                    standaloneAccount,
                )

                expect(errorSpy).not.toHaveBeenCalled()
            })

            test('leaves a request-validation cause key-less and unreported', async () => {
                signTransactions.mockRejectedValue(
                    new AppError('bad request', {
                        category: ErrorCategory.VALIDATION,
                    }),
                )

                const error = await makeStrategy()
                    .sign(makeTransactionGroup(), standaloneAccount)
                    .catch((e: unknown) => e)

                expect(error).toBeInstanceOf(SigningError)
                expect(
                    (error as SigningError).metadata.messageKey,
                ).toBeUndefined()
                expect(errorSpy).not.toHaveBeenCalled()
            })

            test('keeps a request-validation cause that declares its own key', async () => {
                signTransactions.mockRejectedValue(
                    new AppError('bad request', {
                        category: ErrorCategory.VALIDATION,
                        messageKey: 'errors.webview.invalid_method',
                    }),
                )

                const error = await makeStrategy()
                    .sign(makeTransactionGroup(), standaloneAccount)
                    .catch((e: unknown) => e)

                expect((error as SigningError).metadata.messageKey).toBe(
                    'errors.webview.invalid_method',
                )
                expect(errorSpy).not.toHaveBeenCalled()
            })

            test('forwards params only alongside the cause key', async () => {
                signTransactions.mockRejectedValue(
                    new AppError('internal', { params: { signer: 'ADDR' } }),
                )

                const error = await makeStrategy()
                    .sign(makeTransactionGroup(), standaloneAccount)
                    .catch((e: unknown) => e)

                expect((error as SigningError).metadata.messageKey).toBe(
                    SIGNING_ERROR_KEYS.localKeyFailed,
                )
                expect((error as SigningError).metadata.params).toBeUndefined()
            })
        })
    })
})
