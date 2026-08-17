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

import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    useAssetOptOutMutation,
    NonZeroBalanceError,
    CreatorCannotOptOutError,
} from '../useAssetOptOutMutation'

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient() }, children)

const mockSubmit = vi.fn()
const mockAccountInformation = vi.fn()
const mockBuild = vi.fn()
const mockAddAssetTransfer = vi.fn()
const mockNewGroup = vi.fn(() => ({
    addAssetTransfer: mockAddAssetTransfer.mockReturnThis(),
    build: mockBuild,
}))
const mockFetchIndexerAssetDetails = vi.fn()
const mockDeleteAssetHoldings = vi.fn().mockResolvedValue(undefined)
const mockInvalidate = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: () => ({ do: mockAccountInformation }),
            },
        },
        newGroup: mockNewGroup,
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchIndexerAssetDetails: (...args: unknown[]) =>
        mockFetchIndexerAssetDetails(...args),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    deleteAssetHoldings: (...args: unknown[]) =>
        mockDeleteAssetHoldings(...args),
    invalidateAccountQueriesForAddresses: (...args: unknown[]) =>
        mockInvalidate(...args),
}))

const baseAccount = {
    amount: 1000000n,
    minBalance: 100000n,
    assets: [{ assetId: 12345n, amount: 0n }],
}

describe('useAssetOptOutMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccountInformation.mockResolvedValue(baseAccount)
        mockBuild.mockResolvedValue({
            transactions: [{ txn: { sender: 'SENDER' } }],
        })
        mockSubmit.mockResolvedValue({ txIds: ['tx1'] })
        mockFetchIndexerAssetDetails.mockResolvedValue({
            asset: { params: { creator: 'CREATOR' } },
        })
    })

    it('opts out of a single asset via the pipeline helper', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            const res = await result.current.optOut({
                sender: 'SENDER',
                assetId: 12345n,
                creator: 'CREATOR',
            })
            expect(res.txIds).toEqual(['tx1'])
        })

        expect(mockAddAssetTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SENDER',
                receiver: 'SENDER',
                assetId: 12345n,
                amount: 0n,
                closeAssetTo: 'CREATOR',
            }),
        )
        expect(mockSubmit).toHaveBeenCalledWith({
            unsignedTxs: [{ sender: 'SENDER' }],
            source: {
                name: 'asset-opt-out',
                description: 'Opt out of an asset',
            },
        })
        expect(mockDeleteAssetHoldings).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            assetIds: ['12345'],
            network: 'testnet',
        })
        // Scoped, not balances-only: the holdings delete must refresh every
        // staleTime-Infinity account read (PERA-4845).
        expect(mockInvalidate).toHaveBeenCalledTimes(1)
        expect(mockInvalidate).toHaveBeenCalledWith(expect.anything(), [
            'SENDER',
        ])
    })

    it('opts out of multiple assets in a single grouped pipeline request', async () => {
        mockBuild.mockResolvedValueOnce({
            transactions: [
                { txn: { sender: 'SENDER' } },
                { txn: { sender: 'SENDER' } },
            ],
        })
        mockSubmit.mockResolvedValueOnce({ txIds: ['tx1', 'tx2'] })
        mockAccountInformation.mockResolvedValueOnce({
            ...baseAccount,
            assets: [
                { assetId: 12345n, amount: 0n },
                { assetId: 67890n, amount: 0n },
            ],
        })

        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            const res = await result.current.optOut([
                { sender: 'SENDER', assetId: 12345n, creator: 'C1' },
                { sender: 'SENDER', assetId: 67890n, creator: 'C2' },
            ])
            expect(res.txIds).toEqual(['tx1', 'tx2'])
        })

        expect(mockAddAssetTransfer).toHaveBeenCalledTimes(2)
        expect(mockSubmit).toHaveBeenCalledWith({
            unsignedTxs: [{ sender: 'SENDER' }, { sender: 'SENDER' }],
            source: {
                name: 'asset-opt-out',
                description: 'Opt out of an asset',
            },
        })
        expect(mockDeleteAssetHoldings).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            assetIds: ['12345', '67890'],
            network: 'testnet',
        })
        expect(mockInvalidate).toHaveBeenCalledTimes(1)
    })

    it('throws NonZeroBalanceError without calling the pipeline', async () => {
        mockAccountInformation.mockResolvedValueOnce({
            ...baseAccount,
            assets: [{ assetId: 12345n, amount: 5n }],
        })

        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.optOut({
                    sender: 'SENDER',
                    assetId: 12345n,
                    creator: 'CREATOR',
                }),
            ).rejects.toBeInstanceOf(NonZeroBalanceError)
        })

        expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('throws CreatorCannotOptOutError when sender == creator', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.optOut({
                    sender: 'CREATOR',
                    assetId: 12345n,
                    creator: 'CREATOR',
                }),
            ).rejects.toBeInstanceOf(CreatorCannotOptOutError)
        })

        expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('skips submit but still reconciles local state when the asset is already gone on-chain', async () => {
        mockAccountInformation.mockResolvedValueOnce({
            ...baseAccount,
            assets: [],
        })

        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            const res = await result.current.optOut({
                sender: 'SENDER',
                assetId: 12345n,
                creator: 'CREATOR',
            })
            expect(res.txIds).toEqual([])
        })

        expect(mockAddAssetTransfer).not.toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
        expect(mockDeleteAssetHoldings).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            assetIds: ['12345'],
            network: 'testnet',
        })
        expect(mockInvalidate).toHaveBeenCalledTimes(1)
    })

    it('only submits assets still held when some are already gone on-chain', async () => {
        mockAccountInformation.mockResolvedValueOnce({
            ...baseAccount,
            assets: [{ assetId: 12345n, amount: 0n }],
        })
        mockBuild.mockResolvedValueOnce({
            transactions: [{ txn: { sender: 'SENDER' } }],
        })
        mockSubmit.mockResolvedValueOnce({ txIds: ['tx1'] })

        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            const res = await result.current.optOut([
                { sender: 'SENDER', assetId: 12345n, creator: 'C1' },
                { sender: 'SENDER', assetId: 67890n, creator: 'C2' },
            ])
            expect(res.txIds).toEqual(['tx1'])
        })

        expect(mockAddAssetTransfer).toHaveBeenCalledTimes(1)
        expect(mockAddAssetTransfer).toHaveBeenCalledWith(
            expect.objectContaining({ assetId: 12345n }),
        )
        expect(mockDeleteAssetHoldings).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            assetIds: ['12345', '67890'],
            network: 'testnet',
        })
    })

    it('does not call deleteAssetHoldings when submit fails', async () => {
        mockSubmit.mockRejectedValueOnce(new Error('user cancelled'))
        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.optOut({
                    sender: 'SENDER',
                    assetId: 12345n,
                    creator: 'CREATOR',
                }),
            ).rejects.toThrow('user cancelled')
        })

        expect(mockDeleteAssetHoldings).not.toHaveBeenCalled()
        expect(mockInvalidate).not.toHaveBeenCalled()
    })
})
