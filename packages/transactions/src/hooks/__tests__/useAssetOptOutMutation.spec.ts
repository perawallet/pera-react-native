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

const mockSubmit = vi.fn()
const mockAccountInformation = vi.fn()
const mockBuild = vi.fn()
const mockAddAssetTransfer = vi.fn()
const mockNewGroup = vi.fn(() => ({
    addAssetTransfer: mockAddAssetTransfer.mockReturnThis(),
    build: mockBuild,
}))
const mockFetchIndexerAssetDetails = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({
        client: { algod: { accountInformation: mockAccountInformation } },
        newGroup: mockNewGroup,
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchIndexerAssetDetails: (...args: unknown[]) =>
        mockFetchIndexerAssetDetails(...args),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    deleteAssetHoldings: vi.fn().mockResolvedValue(undefined),
    useAccountBalancesInvalidator: () => ({ invalidate: vi.fn() }),
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
        const { result } = renderHook(() => useAssetOptOutMutation())

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
        expect(mockSubmit).toHaveBeenCalledTimes(1)
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

        const { result } = renderHook(() => useAssetOptOutMutation())

        await act(async () => {
            const res = await result.current.optOut([
                { sender: 'SENDER', assetId: 12345n, creator: 'C1' },
                { sender: 'SENDER', assetId: 67890n, creator: 'C2' },
            ])
            expect(res.txIds).toEqual(['tx1', 'tx2'])
        })

        expect(mockAddAssetTransfer).toHaveBeenCalledTimes(2)
        expect(mockSubmit).toHaveBeenCalledTimes(1)
    })

    it('throws NonZeroBalanceError without calling the pipeline', async () => {
        mockAccountInformation.mockResolvedValueOnce({
            ...baseAccount,
            assets: [{ assetId: 12345n, amount: 5n }],
        })

        const { result } = renderHook(() => useAssetOptOutMutation())

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
        const { result } = renderHook(() => useAssetOptOutMutation())

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
})
