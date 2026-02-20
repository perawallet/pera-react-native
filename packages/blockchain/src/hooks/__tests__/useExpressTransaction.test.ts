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
import { OPT_IN_MBR_COST } from '../../constants'

vi.mock('../useAlgorandClient')

const mockSigner = vi.fn().mockResolvedValue(['signed-tx'])

describe('useExpressTransaction', () => {
    let mockChain: {
        addPayment: Mock
        addAssetOptIn: Mock
        addAssetTransfer: Mock
        send: Mock
    }
    let mockAlgokit: { newGroup: Mock }

    beforeEach(() => {
        vi.clearAllMocks()

        mockChain = {
            addPayment: vi.fn().mockReturnThis(),
            addAssetOptIn: vi.fn().mockReturnThis(),
            addAssetTransfer: vi.fn().mockReturnThis(),
            send: vi.fn().mockResolvedValue({ txIds: ['tx1', 'tx2', 'tx3'] }),
        }

        mockAlgokit = {
            newGroup: vi.fn().mockReturnValue(mockChain),
        }
        ;(useAlgorandClient as Mock).mockReturnValue(mockAlgokit)
    })

    test('returns sendExpress function', () => {
        const { result } = renderHook(() =>
            useExpressTransaction(mockSigner),
        )

        expect(result.current.sendExpress).toBeTypeOf('function')
    })

    test('creates an atomic group with payment, opt-in, and transfer', async () => {
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

        expect(mockAlgokit.newGroup).toHaveBeenCalledTimes(1)
        expect(mockChain.addPayment).toHaveBeenCalledTimes(1)
        expect(mockChain.addAssetOptIn).toHaveBeenCalledTimes(1)
        expect(mockChain.addAssetTransfer).toHaveBeenCalledTimes(1)
        expect(mockChain.send).toHaveBeenCalledTimes(1)
    })

    test('sends MBR payment using OPT_IN_MBR_COST constant', async () => {
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

        expect(mockChain.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SENDER',
                receiver: 'RECEIVER',
                amount: OPT_IN_MBR_COST.microAlgo(),
            }),
        )
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

    test('passes signer to useAlgorandClient', () => {
        renderHook(() => useExpressTransaction(mockSigner))

        expect(useAlgorandClient).toHaveBeenCalledWith(mockSigner)
    })
})
