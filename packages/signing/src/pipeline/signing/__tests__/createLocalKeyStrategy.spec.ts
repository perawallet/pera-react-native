/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { createLocalKeyStrategy } from '../createLocalKeyStrategy'
import type { AnalyzedSignableGroup } from '../../types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    hasSigningKeys: vi.fn(),
    isAlgo25Account: vi.fn(),
    isHDWalletAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        hasSigningKeys: mocks.hasSigningKeys,
        isAlgo25Account: mocks.isAlgo25Account,
        isHDWalletAccount: mocks.isHDWalletAccount,
    }
})

const algo25Account = {
    type: 'algo25',
    address: 'ADDR',
    keyPairId: 'key-1',
} as unknown as WalletAccount

const unsupportedAccount = {
    type: 'hardware',
    address: 'ADDR',
} as unknown as WalletAccount

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

describe('createLocalKeyStrategy', () => {
    let signTransactions: ReturnType<typeof vi.fn>
    let signArbitraryData: ReturnType<typeof vi.fn>
    let signArc60: ReturnType<typeof vi.fn>

    beforeEach(() => {
        signTransactions = vi
            .fn()
            .mockResolvedValue([
                { blob: new Uint8Array() },
                { blob: new Uint8Array() },
            ])
        signArbitraryData = vi.fn().mockResolvedValue([new Uint8Array([1])])
        signArc60 = vi.fn().mockResolvedValue(new Uint8Array([2]))
        mocks.hasSigningKeys
            .mockReset()
            .mockImplementation(
                (account: WalletAccount) =>
                    account.type === 'algo25' || account.type === 'hd-wallet',
            )
        mocks.isAlgo25Account
            .mockReset()
            .mockImplementation(
                (account: WalletAccount) => account.type === 'algo25',
            )
        mocks.isHDWalletAccount
            .mockReset()
            .mockImplementation(
                (account: WalletAccount) => account.type === 'hd-wallet',
            )
    })

    const makeStrategy = () =>
        createLocalKeyStrategy({
            signTransactions,
            signArbitraryData,
            signArc60,
        })

    describe('canSign', () => {
        test('returns true when account has signing keys', () => {
            expect(makeStrategy().canSign(algo25Account)).toBe(true)
        })

        test('returns false when account lacks signing keys', () => {
            expect(makeStrategy().canSign(unsupportedAccount)).toBe(false)
        })
    })

    describe('sign - transactions', () => {
        test('signs and calls start/progress/complete callbacks', async () => {
            const callbacks = {
                onSigningStart: vi.fn(),
                onSigningComplete: vi.fn(),
                onProgress: vi.fn(),
            }

            const result = await makeStrategy().sign(
                makeTransactionGroup(),
                algo25Account,
                callbacks,
            )

            expect(callbacks.onSigningStart).toHaveBeenCalled()
            expect(callbacks.onProgress).toHaveBeenCalledWith(0, 2)
            expect(callbacks.onProgress).toHaveBeenCalledWith(2, 2)
            expect(callbacks.onSigningComplete).toHaveBeenCalled()
            expect(result.signedData.type).toBe('transactions')
            expect(result.signers).toEqual([{ address: 'ADDR' }])
            expect(result.originalIndices).toEqual([3, 4])
        })

        test('forwards error and wraps in SigningError', async () => {
            signTransactions.mockRejectedValue(new Error('bad key'))
            const onError = vi.fn()

            await expect(
                makeStrategy().sign(makeTransactionGroup(), algo25Account, {
                    onError,
                }),
            ).rejects.toThrow('bad key')
            expect(onError).toHaveBeenCalled()
        })

        test('wraps non-Error rejections as SigningError', async () => {
            signTransactions.mockRejectedValue('boom')

            await expect(
                makeStrategy().sign(makeTransactionGroup(), algo25Account),
            ).rejects.toThrow('boom')
        })
    })

    describe('sign - arbitrary data', () => {
        test('delegates to signArbitraryData with message payloads', async () => {
            const result = await makeStrategy().sign(
                makeArbitraryGroup(),
                algo25Account,
            )

            expect(signArbitraryData).toHaveBeenCalledWith(algo25Account, [
                'payload-1',
                'payload-2',
            ])
            expect(result.signedData.type).toBe('arbitrary-data')
        })

        test('wraps errors in SigningError and calls onError', async () => {
            signArbitraryData.mockRejectedValue(new Error('sig fail'))
            const onError = vi.fn()

            await expect(
                makeStrategy().sign(makeArbitraryGroup(), algo25Account, {
                    onError,
                }),
            ).rejects.toThrow('sig fail')
            expect(onError).toHaveBeenCalled()
        })

        test('wraps non-Error rejections', async () => {
            signArbitraryData.mockRejectedValue(42)

            await expect(
                makeStrategy().sign(makeArbitraryGroup(), algo25Account),
            ).rejects.toThrow('42')
        })
    })

    describe('sign - arc60', () => {
        test('delegates to signArc60 with stdSigData and metadata', async () => {
            const group = makeArc60Group()
            const result = await makeStrategy().sign(group, algo25Account)

            expect(signArc60).toHaveBeenCalledWith(
                algo25Account,
                group.data.type === 'arc60' ? group.data.stdSigData : undefined,
                group.data.type === 'arc60' ? group.data.metadata : undefined,
            )
            expect(result.signedData.type).toBe('arc60')
        })

        test('wraps errors in SigningError and calls onError', async () => {
            signArc60.mockRejectedValue(new Error('arc60 fail'))
            const onError = vi.fn()

            await expect(
                makeStrategy().sign(makeArc60Group(), algo25Account, {
                    onError,
                }),
            ).rejects.toThrow('arc60 fail')
            expect(onError).toHaveBeenCalled()
        })

        test('wraps non-Error rejections', async () => {
            signArc60.mockRejectedValue('bad')

            await expect(
                makeStrategy().sign(makeArc60Group(), algo25Account),
            ).rejects.toThrow('bad')
        })
    })

    describe('sign - errors', () => {
        test('throws CannotSignError when account has no signing keys', async () => {
            await expect(
                makeStrategy().sign(makeTransactionGroup(), unsupportedAccount),
            ).rejects.toThrow('Account does not have local signing keys')
        })

        test('throws CannotSignError for unsupported account type', async () => {
            const weirdAccount = {
                type: 'weird-type',
                address: 'ADDR',
            } as unknown as WalletAccount
            mocks.hasSigningKeys.mockReturnValue(true)
            mocks.isAlgo25Account.mockReturnValue(false)
            mocks.isHDWalletAccount.mockReturnValue(false)

            await expect(
                makeStrategy().sign(makeTransactionGroup(), weirdAccount),
            ).rejects.toThrow('Unsupported account type')
        })
    })
})
