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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useExpressTransaction } from '../useExpressTransaction'
import { useAlgorandClient } from '../useAlgorandClient'
import { ASSET_MBR } from '../../constants'

vi.mock('../useAlgorandClient')

const mockSigner = vi.fn().mockResolvedValue(['signed-tx'])

const MIN_FEE = 1000n

describe('useExpressTransaction', () => {
    let mockChain: {
        addPayment: Mock
        addAssetOptIn: Mock
        addAssetTransfer: Mock
        send: Mock
    }
    let mockAccountInformation: Mock
    let mockGetSuggestedParams: Mock
    let mockAlgokit: {
        newGroup: Mock
        client: { algod: { accountInformation: Mock } }
        getSuggestedParams: Mock
    }

    beforeEach(() => {
        vi.clearAllMocks()

        mockChain = {
            addPayment: vi.fn().mockReturnThis(),
            addAssetOptIn: vi.fn().mockReturnThis(),
            addAssetTransfer: vi.fn().mockReturnThis(),
            send: vi.fn().mockResolvedValue({ txIds: ['tx1', 'tx2', 'tx3'] }),
        }

        mockAccountInformation = vi.fn().mockResolvedValue({
            amount: 0n,
            minBalance: 100_000n,
        })

        mockGetSuggestedParams = vi.fn().mockResolvedValue({
            minFee: MIN_FEE,
        })

        mockAlgokit = {
            newGroup: vi.fn().mockReturnValue(mockChain),
            client: { algod: { accountInformation: mockAccountInformation } },
            getSuggestedParams: mockGetSuggestedParams,
        }
        ;(useAlgorandClient as Mock).mockReturnValue(mockAlgokit)
    })

    test('returns sendExpress function', () => {
        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        expect(result.current.sendExpress).toBeTypeOf('function')
    })

    test('passes signer to useAlgorandClient', () => {
        renderHook(() => useExpressTransaction(mockSigner))

        expect(useAlgorandClient).toHaveBeenCalledWith(mockSigner)
    })

    test('looks up receiver account info', async () => {
        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(mockAccountInformation).toHaveBeenCalledWith('RECEIVER')
    })

    test('fetches suggested params for fee calculation', async () => {
        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(mockGetSuggestedParams).toHaveBeenCalledTimes(1)
    })

    test('sends full funding when receiver has zero balance', async () => {
        // Receiver: balance=0, currentMbr=100_000 (base)
        // After opt-in MBR = 100_000 + 100_000 = 200_000
        // Needed = 200_000 + 1_000 (fee) = 201_000
        // Funding = 201_000 - 0 = 201_000
        mockAccountInformation.mockResolvedValue({
            amount: 0n,
            minBalance: 100_000n,
        })

        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        const expectedFunding = 100_000n + ASSET_MBR + MIN_FEE // 201_000n

        expect(mockChain.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                amount: expectedFunding.microAlgo(),
            }),
        )
    })

    test('sends partial funding when receiver has some balance', async () => {
        // Receiver: balance=150_000, currentMbr=100_000
        // After opt-in MBR = 200_000, needed = 201_000
        // Funding = 201_000 - 150_000 = 51_000
        mockAccountInformation.mockResolvedValue({
            amount: 150_000n,
            minBalance: 100_000n,
        })

        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        const expectedFunding =
            100_000n + ASSET_MBR + MIN_FEE - 150_000n // 51_000n

        expect(mockChain.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: expectedFunding.microAlgo(),
            }),
        )
    })

    test('skips payment when receiver already has enough balance', async () => {
        // Receiver: balance=500_000, currentMbr=100_000
        // After opt-in MBR = 200_000, needed = 201_000
        // 201_000 < 500_000 → no funding needed
        mockAccountInformation.mockResolvedValue({
            amount: 500_000n,
            minBalance: 100_000n,
        })

        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(mockChain.addPayment).not.toHaveBeenCalled()
    })

    test('skips payment when balance exactly covers MBR plus fee', async () => {
        // Receiver: balance=201_000, currentMbr=100_000
        // After opt-in MBR = 200_000, needed = 201_000
        // 201_000 == 201_000 → funding = 0
        mockAccountInformation.mockResolvedValue({
            amount: 201_000n,
            minBalance: 100_000n,
        })

        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(mockChain.addPayment).not.toHaveBeenCalled()
    })

    test('opts in the receiver for the asset', async () => {
        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(mockChain.addAssetOptIn).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'RECEIVER',
                assetId: 99n,
            }),
        )
    })

    test('transfers the asset from sender to receiver', async () => {
        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(mockChain.addAssetTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                amount: 500n,
                assetId: 99n,
            }),
        )
    })

    test('always includes opt-in and transfer even without payment', async () => {
        // Well-funded receiver — no payment needed
        mockAccountInformation.mockResolvedValue({
            amount: 1_000_000n,
            minBalance: 100_000n,
        })

        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(mockChain.addPayment).not.toHaveBeenCalled()
        expect(mockChain.addAssetOptIn).toHaveBeenCalledTimes(1)
        expect(mockChain.addAssetTransfer).toHaveBeenCalledTimes(1)
        expect(mockChain.send).toHaveBeenCalledTimes(1)
    })

    test('returns txIds from the atomic group', async () => {
        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        let txResult: { txIds: string[] } | undefined

        await act(async () => {
            txResult = await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        expect(txResult).toEqual({ txIds: ['tx1', 'tx2', 'tx3'] })
    })

    test('propagates errors from send', async () => {
        mockChain.send.mockRejectedValue(new Error('Transaction failed'))

        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await expect(
            act(async () => {
                await result.current.sendExpress({
                    sender: 'SENDER',
                    receiver: 'RECEIVER',
                    assetId: 99n,
                    amount: 500n,
                })
            }),
        ).rejects.toThrow('Transaction failed')
    })

    test('accounts for existing higher MBR from other assets', async () => {
        // Receiver already has 2 assets opted in: currentMbr=300_000, balance=310_000
        // After opt-in MBR = 300_000 + 100_000 = 400_000
        // Needed = 400_000 + 1_000 = 401_000
        // Funding = 401_000 - 310_000 = 91_000
        mockAccountInformation.mockResolvedValue({
            amount: 310_000n,
            minBalance: 300_000n,
        })

        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        await act(async () => {
            await result.current.sendExpress({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 99n,
                amount: 500n,
            })
        })

        const expectedFunding = 300_000n + ASSET_MBR + MIN_FEE - 310_000n // 91_000n

        expect(mockChain.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: expectedFunding.microAlgo(),
            }),
        )
    })
})
