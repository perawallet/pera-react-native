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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { NoConnectionError } from '@perawallet/wallet-core-shared'
import {
    useAssetOptInMutation,
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
} from '../useAssetOptInMutation'

const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient() }, children)

const mockSubmit = vi.fn()
const mockAccountInformation = vi.fn()
const mockBuild = vi.fn()
const mockNewGroup = vi.fn(() => ({
    addAssetOptIn: vi.fn().mockReturnThis(),
    build: mockBuild,
}))
const mockInsertAssetHolding = vi.fn().mockResolvedValue(undefined)
const mockFetchAndPersistAssets = vi.fn().mockResolvedValue(undefined)
const mockInvalidate = vi.fn()
const mockUseMinimumFeeConfig = vi.fn()
const mockAssignFeeToGroup = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: mockAssignFeeToGroup,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    insertAssetHolding: (...args: unknown[]) => mockInsertAssetHolding(...args),
    invalidateAccountQueriesForAddresses: (...args: unknown[]) =>
        mockInvalidate(...args),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchAndPersistAssets: (...args: unknown[]) =>
        mockFetchAndPersistAssets(...args),
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
    useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
}))

describe('useAssetOptInMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccountInformation.mockResolvedValue({
            amount: 1000000n,
            minBalance: 100000n,
            assets: [],
        })
        mockBuild.mockResolvedValue({
            transactions: [{ txn: { sender: 'SENDER', fee: 1000n } }],
        })
        // Default: pass-through, which is what the calculator does for a
        // non-quantum sender.
        mockAssignFeeToGroup.mockImplementation(
            async ({ transactions }: { transactions: unknown[] }) => ({
                transactions,
                adjustments: [],
            }),
        )
        mockSubmit.mockResolvedValue({ txIds: ['tx1'] })
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 100000n,
            baseAccountMbr: 100000n,
        })
    })

    it('builds an opt-in via composer and submits via the pipeline helper', async () => {
        const { result } = renderHook(() => useAssetOptInMutation(), {
            wrapper,
        })

        await act(async () => {
            const res = await result.current.optIn({
                sender: 'SENDER',
                assetId: 12345n,
            })
            expect(res.txIds).toEqual(['tx1'])
        })

        expect(mockNewGroup).toHaveBeenCalledTimes(1)
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [{ sender: 'SENDER', fee: 1000n }],
            }),
        )
        expect(mockInsertAssetHolding).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            assetId: '12345',
            network: 'testnet',
        })
        expect(mockFetchAndPersistAssets).toHaveBeenCalledWith(
            ['12345'],
            'testnet',
        )
        // The scoped invalidation is what refreshes every staleTime-Infinity
        // account read (balances, holdings page, NFT gallery sort caches).
        expect(mockInvalidate).toHaveBeenCalledTimes(1)
        expect(mockInvalidate).toHaveBeenCalledWith(expect.anything(), [
            'SENDER',
        ])
    })

    it('throws AlreadyOptedInError without calling the pipeline', async () => {
        mockAccountInformation.mockResolvedValueOnce({
            amount: 1000000n,
            minBalance: 100000n,
            assets: [{ assetId: 12345n }],
        })

        const { result } = renderHook(() => useAssetOptInMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.optIn({ sender: 'SENDER', assetId: 12345n }),
            ).rejects.toBeInstanceOf(AlreadyOptedInError)
        })

        expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('throws InsufficientBalanceForOptInError without calling the pipeline', async () => {
        mockAccountInformation.mockResolvedValueOnce({
            amount: 1n,
            minBalance: 100000n,
            assets: [],
        })

        const { result } = renderHook(() => useAssetOptInMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.optIn({ sender: 'SENDER', assetId: 12345n }),
            ).rejects.toBeInstanceOf(InsufficientBalanceForOptInError)
        })

        expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('balance check follows the remote-config asset MBR', async () => {
        // Non-default asset MBR (200000). Balance 250000 clears the old
        // threshold (100000 + 100000 + 1000 = 201000) but not the new one
        // (100000 + 200000 + 1000 = 301000), so the opt-in must be rejected.
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 200000n,
            baseAccountMbr: 100000n,
        })
        mockAccountInformation.mockResolvedValueOnce({
            amount: 250000n,
            minBalance: 100000n,
            assets: [],
        })

        const { result } = renderHook(() => useAssetOptInMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.optIn({ sender: 'SENDER', assetId: 12345n }),
            ).rejects.toBeInstanceOf(InsufficientBalanceForOptInError)
        })

        expect(mockSubmit).not.toHaveBeenCalled()
    })

    // a Falcon-signed opt-in must carry the PQ minimum, or algod
    // rejects it with `txgroup with 1mA fees is less than 3mA`.
    it('submits the fee-raised group returned by the minimum-fee calculator', async () => {
        const built = { sender: 'SENDER', fee: 1000n }
        const raised = { sender: 'SENDER', fee: 3000n }
        mockBuild.mockResolvedValueOnce({ transactions: [{ txn: built }] })
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

        const { result } = renderHook(() => useAssetOptInMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.optIn({ sender: 'SENDER', assetId: 12345n })
        })

        expect(mockAssignFeeToGroup).toHaveBeenCalledWith({
            transactions: [built],
        })
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ unsignedTxs: [raised] }),
        )
    })

    it('balance check uses the raised PQ fee, not the base minimum', async () => {
        // 100000 minBalance + 100000 assetMbr leaves 2000 spare. That clears a
        // 1000 base fee but not the 3000 a quantum signer actually pays, so the
        // opt-in must be rejected before anything is signed.
        mockAssignFeeToGroup.mockResolvedValueOnce({
            transactions: [{ sender: 'SENDER', fee: 3000n }],
            adjustments: [
                {
                    index: 0,
                    originalFee: 1000n,
                    adjustedFee: 3000n,
                    reason: 'quantum-minimum',
                },
            ],
        })
        mockAccountInformation.mockResolvedValueOnce({
            amount: 202000n,
            minBalance: 100000n,
            assets: [],
        })

        const { result } = renderHook(() => useAssetOptInMutation(), {
            wrapper,
        })

        await act(async () => {
            await expect(
                result.current.optIn({ sender: 'SENDER', assetId: 12345n }),
            ).rejects.toBeInstanceOf(InsufficientBalanceForOptInError)
        })

        expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('does not run post-submit work when submit fails', async () => {
        mockSubmit.mockRejectedValueOnce(new Error('user cancelled'))
        const { result } = renderHook(() => useAssetOptInMutation(), {
            wrapper,
        })
        await act(async () => {
            await expect(
                result.current.optIn({ sender: 'SENDER', assetId: 12345n }),
            ).rejects.toThrow('user cancelled')
        })
        expect(mockInsertAssetHolding).not.toHaveBeenCalled()
        expect(mockFetchAndPersistAssets).not.toHaveBeenCalled()
        expect(mockInvalidate).not.toHaveBeenCalled()
    })

    describe('offline', () => {
        afterEach(() => onlineManager.setOnline(true))

        it('throws NoConnectionError before any algod call when offline', async () => {
            onlineManager.setOnline(false)
            const { result } = renderHook(() => useAssetOptInMutation(), {
                wrapper,
            })

            await act(async () => {
                await expect(
                    result.current.optIn({
                        sender: 'SENDER',
                        assetId: 123n,
                    }),
                ).rejects.toBeInstanceOf(NoConnectionError)
            })

            expect(mockAccountInformation).not.toHaveBeenCalled()
            expect(mockBuild).not.toHaveBeenCalled()
        })
    })
})
