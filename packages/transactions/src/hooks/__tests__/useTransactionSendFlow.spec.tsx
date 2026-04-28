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
import { Decimal } from 'decimal.js'
import { useTransactionSendFlow } from '../useTransactionSendFlow'

const mockSubmit = vi.fn()
const mockBuildSendViaInbox = vi.fn()
const mockBuildClaimAsset = vi.fn()
const mockBuildRejectAsset = vi.fn()
const mockAccountInformation = vi.fn()
const mockGetSuggestedParams = vi.fn()
const mockNewGroup = vi.fn()
const mockBuild = vi.fn()
const mockAddPayment = vi.fn()
const mockAddAssetTransfer = vi.fn()
const mockAddAssetOptIn = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
}))

vi.mock('@perawallet/wallet-core-asa-inbox', () => ({
    useArc59SendTransaction: () => ({
        buildSendViaInboxTxs: mockBuildSendViaInbox,
    }),
    useArc59ClaimTransaction: () => ({
        buildClaimAssetTxs: mockBuildClaimAsset,
        buildRejectAssetTxs: mockBuildRejectAsset,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({
        client: { algod: { accountInformation: mockAccountInformation } },
        getSuggestedParams: mockGetSuggestedParams,
        newGroup: () => {
            const group = {
                addPayment: mockAddPayment.mockReturnThis(),
                addAssetTransfer: mockAddAssetTransfer.mockReturnThis(),
                addAssetOptIn: mockAddAssetOptIn.mockReturnThis(),
                build: mockBuild,
            }
            mockNewGroup(group)
            return group
        },
    }),
    displayUnitsToBaseUnits: (val: Decimal, _decimals: number) => val,
    ASSET_MBR: 100000n,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: 0n,
    ALGO_ASSET: { assetId: 0n, decimals: 6, name: 'Algo', unitName: 'ALGO' },
}))

const TXN = { sender: 'SENDER' } as unknown

describe('useTransactionSendFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetSuggestedParams.mockResolvedValue({ minFee: 1000n })
        mockBuild.mockResolvedValue({ transactions: [{ txn: TXN }] })
        mockSubmit.mockResolvedValue({ txIds: ['tx1'] })
        mockAccountInformation.mockResolvedValue({
            amount: 0n,
            minBalance: 100000n,
        })
        mockBuildSendViaInbox.mockResolvedValue([TXN])
        mockBuildClaimAsset.mockResolvedValue([TXN])
        mockBuildRejectAsset.mockResolvedValue([TXN])
    })

    it('normal ALGO send: builds payment + submits via pipeline', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            const id = await result.current.execute({
                params: {
                    sendMode: 'normal',
                    sender: { address: 'A' } as any,
                    receiver: 'B',
                    asset: { assetId: 0n, decimals: 6 } as any,
                    amount: new Decimal(1),
                },
            })
            expect(id).toBe('tx1')
        })
        expect(mockAddPayment).toHaveBeenCalled()
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [TXN],
                source: {
                    name: 'send-transaction',
                    description: 'Send transaction',
                },
            }),
        )
    })

    it('normal ASA send: builds asset transfer + submits via pipeline', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'normal',
                    sender: { address: 'A' } as any,
                    receiver: 'B',
                    asset: { assetId: 99n, decimals: 0 } as any,
                    amount: new Decimal(1),
                },
            })
        })
        expect(mockAddAssetTransfer).toHaveBeenCalled()
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [TXN],
                source: {
                    name: 'send-transaction',
                    description: 'Send transaction',
                },
            }),
        )
    })

    it('express send: includes funding payment when receiver is underfunded', async () => {
        mockAccountInformation.mockResolvedValueOnce({
            amount: 0n,
            minBalance: 100000n,
        })
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'express',
                    sender: { address: 'A' } as any,
                    receiver: 'B',
                    asset: { assetId: 99n, decimals: 0 } as any,
                    amount: new Decimal(1),
                },
            })
        })
        expect(mockAddPayment).toHaveBeenCalled()
        expect(mockAddAssetOptIn).toHaveBeenCalled()
        expect(mockAddAssetTransfer).toHaveBeenCalled()
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [TXN],
                source: {
                    name: 'send-transaction',
                    description: 'Send transaction',
                },
            }),
        )
    })

    it('sendArc59: delegates building to ARC-59 hook + submits via pipeline', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'sendArc59',
                    sender: { address: 'A' } as any,
                    receiver: 'B',
                    asset: { assetId: 99n, decimals: 0 } as any,
                    amount: new Decimal(1),
                    arc59Summary: {
                        algo_fund_amount: 0,
                        minimum_balance_requirement: 0,
                        is_arc59_opted_in: true,
                        inner_tx_count: 1,
                    } as any,
                },
            })
        })
        expect(mockBuildSendViaInbox).toHaveBeenCalledTimes(1)
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [TXN],
                source: {
                    name: 'send-transaction',
                    description: 'Send transaction',
                },
            }),
        )
    })

    it('claimArc59: delegates building to ARC-59 hook + submits via pipeline', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'claimArc59',
                    sender: { address: 'A' } as any,
                    asset: { assetId: 99n, decimals: 0 } as any,
                    shouldClaimAlgo: false,
                },
            })
        })
        expect(mockBuildClaimAsset).toHaveBeenCalledTimes(1)
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [TXN],
                source: {
                    name: 'send-transaction',
                    description: 'Send transaction',
                },
            }),
        )
    })

    it('rejectArc59: delegates building to ARC-59 hook + submits via pipeline', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'rejectArc59',
                    sender: { address: 'A' } as any,
                    asset: { assetId: 99n, decimals: 0 } as any,
                    shouldClaimAlgo: false,
                },
            })
        })
        expect(mockBuildRejectAsset).toHaveBeenCalledTimes(1)
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [TXN],
                source: {
                    name: 'send-transaction',
                    description: 'Send transaction',
                },
            }),
        )
    })
})
