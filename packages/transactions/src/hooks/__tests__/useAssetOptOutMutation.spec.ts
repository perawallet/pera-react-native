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
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    useAssetOptOutMutation,
    NonZeroBalanceError,
    CreatorCannotOptOutError,
} from '../useAssetOptOutMutation'
import { sendFlowChainAdapters } from '../../chain-adapter'

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient() }, children)

const mockSubmit = vi.fn()
const mockAccountInformation = vi.fn()
const mockBuild = vi.fn()
const mockFetchOnChainAsset = vi.fn()
const mockDeleteAssetHoldings = vi.fn().mockResolvedValue(undefined)
const mockInvalidate = vi.fn()
const mockAssignFeeToGroup = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: mockAssignFeeToGroup,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchOnChainAsset: (...args: unknown[]) => mockFetchOnChainAsset(...args),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    fetchAccountInformation: (...args: unknown[]) =>
        mockAccountInformation(...args),
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
        mockBuild.mockResolvedValue([{ sender: 'SENDER' }])
        sendFlowChainAdapters.reset()
        sendFlowChainAdapters.register({
            chainId: 'algorand',
            buildTransferTxs: vi.fn(),
            assetHolding: {
                buildOptInTxs: vi.fn(),
                buildOptOutTxs: mockBuild,
            },
        })
        mockSubmit.mockResolvedValue({ txIds: ['tx1'] })
        // Default: the calculator passes the group through untouched, which is
        // exactly what it does for a non-quantum sender.
        mockAssignFeeToGroup.mockImplementation(
            async ({ transactions }: { transactions: unknown[] }) => ({
                transactions,
                adjustments: [],
            }),
        )
        mockFetchOnChainAsset.mockResolvedValue({
            creator: { address: 'CREATOR' },
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

        expect(mockBuild).toHaveBeenCalledWith({
            scope: { chainId: 'algorand', networkId: 'testnet' },
            optOuts: [
                { sender: 'SENDER', assetId: 12345n, creator: 'CREATOR' },
            ],
        })
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
        // staleTime-Infinity account read.
        expect(mockInvalidate).toHaveBeenCalledTimes(1)
        expect(mockInvalidate).toHaveBeenCalledWith(expect.anything(), [
            'SENDER',
        ])
    })

    it('looks the creator up on chain when the caller does not pass one', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.optOut({
                sender: 'SENDER',
                assetId: 12345n,
            })
        })

        expect(mockFetchOnChainAsset).toHaveBeenCalledWith('12345', {
            chainId: 'algorand',
            networkId: 'testnet',
        })
        expect(mockBuild).toHaveBeenCalledWith({
            scope: { chainId: 'algorand', networkId: 'testnet' },
            optOuts: [
                { sender: 'SENDER', assetId: 12345n, creator: 'CREATOR' },
            ],
        })
    })

    it('opts out of multiple assets in a single grouped pipeline request', async () => {
        mockBuild.mockResolvedValueOnce([
            { sender: 'SENDER' },
            { sender: 'SENDER' },
        ])
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

        expect(mockBuild).toHaveBeenCalledTimes(1)
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

    // algod rejects an underfunded Falcon group outright
    // (`txgroup with 1mA fees is less than 3mA`), so the built group must go
    // through the fee calculator before it is signed.
    it('submits the fee-raised group returned by the minimum-fee calculator', async () => {
        const built = { sender: 'SENDER', fee: 1000n }
        const raised = { sender: 'SENDER', fee: 3000n }
        mockBuild.mockResolvedValueOnce([built])
        mockAssignFeeToGroup.mockResolvedValueOnce({
            transactions: [raised],
            adjustments: [
                {
                    index: 0,
                    originalFee: 1000n,
                    adjustedFee: 3000n,
                    reason: 'quantum-minimum',
                },
            ],
        })

        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.optOut({
                sender: 'SENDER',
                assetId: 12345n,
                creator: 'CREATOR',
            })
        })

        expect(mockAssignFeeToGroup).toHaveBeenCalledWith({
            transactions: [built],
        })
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ unsignedTxs: [raised] }),
        )
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

        expect(mockBuild).not.toHaveBeenCalled()
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
        mockBuild.mockResolvedValueOnce([{ sender: 'SENDER' }])
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

        expect(mockBuild).toHaveBeenCalledWith(
            expect.objectContaining({
                optOuts: [{ sender: 'SENDER', assetId: 12345n, creator: 'C1' }],
            }),
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
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('user cancelled')
    })

    it('resolves an empty selection without touching the chain or the local DB', async () => {
        const { result } = renderHook(() => useAssetOptOutMutation(), {
            wrapper,
        })

        await act(async () => {
            const res = await result.current.optOut([])
            expect(res.txIds).toEqual([])
        })

        expect(mockAccountInformation).not.toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
        expect(mockDeleteAssetHoldings).not.toHaveBeenCalled()
        expect(mockInvalidate).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(false)
    })
})
