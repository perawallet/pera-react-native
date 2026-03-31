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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    useAssetOptInMutation,
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
} from '../useAssetOptInMutation'

const mockAssetOptIn = vi.fn()
const mockAccountInformation = vi.fn()
const mockGetSuggestedParams = vi.fn()
const mockSignTransactions = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useTransactionSigner: () => ({
        signTransactions: mockSignTransactions,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    insertAssetHolding: vi.fn().mockResolvedValue(undefined),
    useAccountBalancesInvalidator: () => ({
        invalidate: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({
        send: {
            assetOptIn: mockAssetOptIn,
        },
        client: {
            algod: {
                accountInformation: mockAccountInformation,
            },
        },
        getSuggestedParams: mockGetSuggestedParams,
    }),
    ASSET_MBR: 100000n,
}))

describe('useAssetOptInMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccountInformation.mockResolvedValue({
            amount: 1000000n,
            minBalance: 100000n,
            assets: [],
        })
        mockGetSuggestedParams.mockResolvedValue({ minFee: 1000n })
        mockAssetOptIn.mockResolvedValue({ txIds: ['tx1'] })
    })

    it('should opt in to an asset successfully', async () => {
        const { result } = renderHook(() => useAssetOptInMutation())

        await act(async () => {
            const res = await result.current.optIn({
                sender: 'SENDER',
                assetId: 12345n,
            })
            expect(res.txIds).toEqual(['tx1'])
        })

        expect(mockAssetOptIn).toHaveBeenCalledWith({
            sender: 'SENDER',
            assetId: 12345n,
        })
    })

    it('should reject when already opted in', async () => {
        mockAccountInformation.mockResolvedValue({
            amount: 1000000n,
            minBalance: 100000n,
            assets: [{ assetId: 12345n, amount: 0n }],
        })

        const { result } = renderHook(() => useAssetOptInMutation())

        await act(async () => {
            await expect(
                result.current.optIn({
                    sender: 'SENDER',
                    assetId: 12345n,
                }),
            ).rejects.toThrow(AlreadyOptedInError)
        })

        expect(mockAssetOptIn).not.toHaveBeenCalled()
    })

    it('should reject when insufficient balance for MBR', async () => {
        mockAccountInformation.mockResolvedValue({
            amount: 100000n, // Just enough for current MBR
            minBalance: 100000n,
            assets: [],
        })

        const { result } = renderHook(() => useAssetOptInMutation())

        await act(async () => {
            await expect(
                result.current.optIn({
                    sender: 'SENDER',
                    assetId: 12345n,
                }),
            ).rejects.toThrow(InsufficientBalanceForOptInError)
        })

        expect(mockAssetOptIn).not.toHaveBeenCalled()
    })

    it('should call insertAssetHolding and invalidateBalances on success', async () => {
        const mockInsertAssetHolding = await import(
            '@perawallet/wallet-core-accounts'
        ).then(m => m.insertAssetHolding)

        const { result } = renderHook(() => useAssetOptInMutation())

        await act(async () => {
            await result.current.optIn({
                sender: 'SENDER',
                assetId: 12345n,
            })
        })

        expect(mockInsertAssetHolding).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            assetId: '12345',
            network: 'testnet',
        })
    })

    it('should not call insertAssetHolding when transaction fails', async () => {
        mockAssetOptIn.mockRejectedValue(new Error('signing rejected'))
        const mockInsertAssetHolding = await import(
            '@perawallet/wallet-core-accounts'
        ).then(m => m.insertAssetHolding)

        const { result } = renderHook(() => useAssetOptInMutation())

        await act(async () => {
            await expect(
                result.current.optIn({
                    sender: 'SENDER',
                    assetId: 12345n,
                }),
            ).rejects.toThrow('signing rejected')
        })

        expect(mockInsertAssetHolding).not.toHaveBeenCalled()
    })

    it('should not call insertAssetHolding when validation fails', async () => {
        mockAccountInformation.mockResolvedValue({
            amount: 1000000n,
            minBalance: 100000n,
            assets: [{ assetId: 12345n, amount: 0n }],
        })
        const mockInsertAssetHolding = await import(
            '@perawallet/wallet-core-accounts'
        ).then(m => m.insertAssetHolding)

        const { result } = renderHook(() => useAssetOptInMutation())

        await act(async () => {
            await expect(
                result.current.optIn({
                    sender: 'SENDER',
                    assetId: 12345n,
                }),
            ).rejects.toThrow(AlreadyOptedInError)
        })

        expect(mockInsertAssetHolding).not.toHaveBeenCalled()
        expect(mockAssetOptIn).not.toHaveBeenCalled()
    })

    it('should set error state on failure', async () => {
        mockAccountInformation.mockRejectedValue(new Error('Network error'))
        const { result } = renderHook(() => useAssetOptInMutation())

        await act(async () => {
            await expect(
                result.current.optIn({
                    sender: 'SENDER',
                    assetId: 12345n,
                }),
            ).rejects.toThrow('Network error')
        })

        expect(result.current.isError).toBe(true)
        expect(result.current.error?.message).toBe('Network error')
    })

    it('should track loading state', async () => {
        const { result } = renderHook(() => useAssetOptInMutation())

        expect(result.current.isLoading).toBe(false)

        let resolveOptIn: (value: { txIds: string[] }) => void
        mockAssetOptIn.mockReturnValue(
            new Promise(resolve => {
                resolveOptIn = resolve
            }),
        )

        const optInPromise = act(async () => {
            const promise = result.current.optIn({
                sender: 'SENDER',
                assetId: 12345n,
            })
            return promise
        })

        await act(async () => {
            resolveOptIn!({ txIds: ['tx1'] })
        })

        await optInPromise
        expect(result.current.isLoading).toBe(false)
    })
})
