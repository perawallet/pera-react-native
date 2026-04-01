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
    useAssetOptOutMutation,
    NonZeroBalanceError,
    CreatorCannotOptOutError,
} from '../useAssetOptOutMutation'

const mockAssetTransfer = vi.fn()
const mockAddAssetTransfer = vi.fn()
const mockComposerSend = vi.fn()
const mockAccountInformation = vi.fn()
const mockSignTransactions = vi.fn()
const mockFetchIndexerAssetDetails = vi.fn()
const mockDeleteAssetHoldings = vi.fn()
const mockInvalidateBalances = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useTransactionSigner: () => ({
        signTransactions: mockSignTransactions,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => {
        const composer = {
            addAssetTransfer: (...args: unknown[]) => {
                mockAddAssetTransfer(...args)
                return composer
            },
            send: mockComposerSend,
        }
        return {
            send: {
                assetTransfer: mockAssetTransfer,
            },
            client: {
                algod: {
                    accountInformation: mockAccountInformation,
                },
            },
            newGroup: () => composer,
        }
    },
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchIndexerAssetDetails: (...args: unknown[]) =>
        mockFetchIndexerAssetDetails(...args),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    deleteAssetHoldings: (...args: unknown[]) =>
        mockDeleteAssetHoldings(...args),
    useAccountBalancesInvalidator: () => ({
        invalidate: mockInvalidateBalances,
    }),
}))

describe('useAssetOptOutMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccountInformation.mockResolvedValue({
            assets: [
                { assetId: 100n, amount: 0n },
                { assetId: 200n, amount: 500n },
            ],
        })
        mockAssetTransfer.mockResolvedValue({ txIds: ['tx1'] })
        mockComposerSend.mockResolvedValue({ txIds: ['tx1', 'tx2'] })
        mockFetchIndexerAssetDetails.mockResolvedValue({
            asset: { params: { creator: 'INDEXER_CREATOR' } },
        })
        mockDeleteAssetHoldings.mockResolvedValue(undefined)
    })

    it('should opt out of a single asset with zero balance', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            const res = await result.current.optOut({
                sender: 'SENDER',
                assetId: 100n,
                creator: 'CREATOR',
            })
            expect(res.txIds).toEqual(['tx1'])
        })

        expect(mockAssetTransfer).toHaveBeenCalledWith({
            sender: 'SENDER',
            receiver: 'SENDER',
            assetId: 100n,
            amount: 0n,
            closeAssetTo: 'CREATOR',
        })
    })

    it('should fetch creator from indexer when not provided', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            const res = await result.current.optOut({
                sender: 'SENDER',
                assetId: 100n,
            })
            expect(res.txIds).toEqual(['tx1'])
        })

        expect(mockFetchIndexerAssetDetails).toHaveBeenCalledWith(
            '100',
            'mainnet',
        )
        expect(mockAssetTransfer).toHaveBeenCalledWith({
            sender: 'SENDER',
            receiver: 'SENDER',
            assetId: 100n,
            amount: 0n,
            closeAssetTo: 'INDEXER_CREATOR',
        })
    })

    it('should reject opt-out when balance is non-zero', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            await expect(
                result.current.optOut({
                    sender: 'SENDER',
                    assetId: 200n,
                    creator: 'CREATOR',
                }),
            ).rejects.toThrow(NonZeroBalanceError)
        })

        expect(mockAssetTransfer).not.toHaveBeenCalled()
    })

    it('should reject opt-out when sender is creator', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            await expect(
                result.current.optOut({
                    sender: 'CREATOR',
                    assetId: 100n,
                    creator: 'CREATOR',
                }),
            ).rejects.toThrow(CreatorCannotOptOutError)
        })

        expect(mockAssetTransfer).not.toHaveBeenCalled()
    })

    it('should build batch opt-out as atomic group', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            const res = await result.current.optOut([
                { sender: 'SENDER', assetId: 100n, creator: 'CREATOR_A' },
                { sender: 'SENDER', assetId: 100n, creator: 'CREATOR_B' },
            ])
            expect(res.txIds).toEqual(['tx1', 'tx2'])
        })

        expect(mockAddAssetTransfer).toHaveBeenCalledTimes(2)
        expect(mockComposerSend).toHaveBeenCalledTimes(1)
    })

    it('should return empty txIds for empty params array', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            const res = await result.current.optOut([])
            expect(res.txIds).toEqual([])
        })

        expect(mockAccountInformation).not.toHaveBeenCalled()
        expect(mockAssetTransfer).not.toHaveBeenCalled()
    })

    it('should fetch creator from indexer for batch when creators missing', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            await result.current.optOut([
                { sender: 'SENDER', assetId: 100n },
                { sender: 'SENDER', assetId: 100n, creator: 'KNOWN_CREATOR' },
            ])
        })

        expect(mockFetchIndexerAssetDetails).toHaveBeenCalledTimes(1)
        expect(mockFetchIndexerAssetDetails).toHaveBeenCalledWith(
            '100',
            'mainnet',
        )
    })

    it('should call deleteAssetHoldings and invalidateBalances on success', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            await result.current.optOut({
                sender: 'SENDER',
                assetId: 100n,
                creator: 'CREATOR',
            })
        })

        expect(mockDeleteAssetHoldings).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            assetIds: ['100'],
            network: 'mainnet',
        })
        expect(mockInvalidateBalances).toHaveBeenCalled()
    })

    it('should not call deleteAssetHoldings when transaction fails', async () => {
        mockAssetTransfer.mockRejectedValue(new Error('tx failed'))
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            await expect(
                result.current.optOut({
                    sender: 'SENDER',
                    assetId: 100n,
                    creator: 'CREATOR',
                }),
            ).rejects.toThrow('tx failed')
        })

        expect(mockDeleteAssetHoldings).not.toHaveBeenCalled()
        expect(mockInvalidateBalances).not.toHaveBeenCalled()
    })

    it('should set error state on failure', async () => {
        mockAccountInformation.mockRejectedValue(new Error('Network error'))
        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            await expect(
                result.current.optOut({
                    sender: 'SENDER',
                    assetId: 100n,
                    creator: 'CREATOR',
                }),
            ).rejects.toThrow('Network error')
        })

        expect(result.current.isError).toBe(true)
        expect(result.current.error?.message).toBe('Network error')
    })
})
