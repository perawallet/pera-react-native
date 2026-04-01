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
import type {
    SendTransactionParams,
    SendClaimParams,
} from '../useTransactionSendFlow'

const mockPayment = vi.fn()
const mockAssetTransfer = vi.fn()
const mockSendExpress = vi.fn()
const mockSendViaInbox = vi.fn()
const mockClaimAsset = vi.fn()
const mockRejectAsset = vi.fn()
const mockSignTransactions = vi.fn()
const mockAccountInformation = vi.fn()
const mockAddPayment = vi.fn()
const mockAddAssetOptIn = vi.fn()
const mockAddAssetTransfer = vi.fn()
const mockComposerSend = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useTransactionSigner: () => ({
        signTransactions: mockSignTransactions,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => {
        const composer = {
            addPayment: (...args: unknown[]) => {
                mockAddPayment(...args)
                return composer
            },
            addAssetOptIn: (...args: unknown[]) => {
                mockAddAssetOptIn(...args)
                return composer
            },
            addAssetTransfer: (...args: unknown[]) => {
                mockAddAssetTransfer(...args)
                return composer
            },
            send: mockComposerSend,
        }
        return {
            send: {
                payment: mockPayment,
                assetTransfer: mockAssetTransfer,
            },
            client: {
                algod: {
                    accountInformation: mockAccountInformation,
                },
            },
            getSuggestedParams: vi.fn().mockResolvedValue({ minFee: 1000n }),
            newGroup: () => composer,
        }
    },
    useExpressTransaction: () => ({
        sendExpress: mockSendExpress,
    }),
    displayUnitsToBaseUnits: (amount: string, decimals: number) => {
        const factor = 10 ** decimals
        return String(Math.round(parseFloat(amount) * factor))
    },
    ASSET_MBR: 100000n,
}))

vi.mock('@perawallet/wallet-core-asa-inbox', () => ({
    useArc59SendTransaction: () => ({
        sendViaInbox: mockSendViaInbox,
    }),
    useArc59ClaimTransaction: () => ({
        claimAsset: mockClaimAsset,
        rejectAsset: mockRejectAsset,
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: '0',
    ALGO_ASSET: { assetId: '0', decimals: 6, name: 'Algo', unitName: 'ALGO' },
    toDecimalUnits: (value: Decimal) => value,
}))

const ALGO_ASSET = {
    assetId: '0',
    decimals: 6,
    name: 'Algo',
    unitName: 'ALGO',
}
const TEST_ASSET = {
    assetId: '123',
    decimals: 6,
    name: 'Test Asset',
    unitName: 'TEST',
}

// Mock BigInt to return an object with microAlgo method for AlgoKit compatibility
const originalBigInt = global.BigInt
const mockBigIntFn = vi.fn((value: string | number | bigint) => {
    const bigIntValue = originalBigInt(value)
    return {
        microAlgo: () => bigIntValue,
        valueOf: () => bigIntValue,
        toString: () => bigIntValue.toString(),
    }
})
vi.stubGlobal('BigInt', mockBigIntFn)

describe('useTransactionSendFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('normal ALGO payment', () => {
        it('should call algokit.send.payment and return first txId', async () => {
            mockPayment.mockResolvedValue({ txIds: ['ALGO_TX_ID'] })

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'normal',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: ALGO_ASSET as never,
                amount: new Decimal(5),
                note: 'test note',
            }

            let txId: string | undefined
            await act(async () => {
                txId = await result.current.execute({ params })
            })

            expect(mockPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: 'SENDER_ADDR',
                    receiver: 'RECEIVER_ADDR',
                    note: 'test note',
                }),
            )
            expect(txId).toBe('ALGO_TX_ID')
        })

        it('should handle closeRemainderTo when isCloseAccount is true', async () => {
            mockPayment.mockResolvedValue({ txIds: ['CLOSE_TX_ID'] })

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'normal',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: ALGO_ASSET as never,
                amount: new Decimal(0),
                isCloseAccount: true,
            }

            let txId: string | undefined
            await act(async () => {
                txId = await result.current.execute({ params })
            })

            expect(mockPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: 'SENDER_ADDR',
                    receiver: 'RECEIVER_ADDR',
                    closeRemainderTo: 'RECEIVER_ADDR',
                }),
            )
            expect(txId).toBe('CLOSE_TX_ID')
        })
    })

    describe('normal ASA transfer', () => {
        it('should call algokit.send.assetTransfer and return first txId', async () => {
            mockAssetTransfer.mockResolvedValue({ txIds: ['ASA_TX_ID'] })

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'normal',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: TEST_ASSET as never,
                amount: new Decimal(10),
                note: 'asa note',
            }

            let txId: string | undefined
            await act(async () => {
                txId = await result.current.execute({ params })
            })

            expect(mockAssetTransfer).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: 'SENDER_ADDR',
                    receiver: 'RECEIVER_ADDR',
                    note: 'asa note',
                }),
            )
            expect(txId).toBe('ASA_TX_ID')
        })
    })

    describe('express send', () => {
        it('should call sendExpress and return last txId', async () => {
            mockAccountInformation.mockResolvedValue({
                amount: 500000n,
                minBalance: 100000n,
            })
            mockComposerSend.mockResolvedValue({
                txIds: ['EXPRESS_TX_1', 'EXPRESS_TX_2'],
            })

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'express',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: TEST_ASSET as never,
                amount: new Decimal(5),
            }

            let txId: string | undefined
            await act(async () => {
                txId = await result.current.execute({ params })
            })

            expect(mockAccountInformation).toHaveBeenCalledWith('RECEIVER_ADDR')
            expect(txId).toBe('EXPRESS_TX_2')
        })
    })

    describe('arc59 send', () => {
        it('should call sendViaInbox and return last txId', async () => {
            mockSendViaInbox.mockResolvedValue({
                txIds: ['ARC59_TX_1', 'ARC59_TX_2'],
            })

            const arc59Summary = {
                is_arc59_opted_in: true,
                minimum_balance_requirement: 100000,
                inner_tx_count: 2,
                total_protocol_and_mbr_fee: 200000,
                inbox_address: 'INBOX_ADDR',
                algo_fund_amount: 0,
                warning_message: null,
            }

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'sendArc59',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: TEST_ASSET as never,
                amount: new Decimal(5),
                arc59Summary,
            }

            let txId: string | undefined
            await act(async () => {
                txId = await result.current.execute({ params })
            })

            expect(mockSendViaInbox).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: 'SENDER_ADDR',
                    receiver: 'RECEIVER_ADDR',
                    summary: arc59Summary,
                }),
            )
            expect(txId).toBe('ARC59_TX_2')
        })

        it('should throw when arc59Summary is missing', async () => {
            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'sendArc59',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: TEST_ASSET as never,
                amount: new Decimal(5),
            }

            let error: Error | undefined
            await act(async () => {
                try {
                    await result.current.execute({ params })
                } catch (e) {
                    error = e as Error
                }
            })

            expect(error).toBeDefined()
            expect(error).toBeInstanceOf(Error)
        })
    })

    describe('claim transaction', () => {
        it('should call claimAsset and return last txId', async () => {
            mockClaimAsset.mockResolvedValue({
                txIds: ['CLAIM_TX_1', 'CLAIM_TX_2'],
            })

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendClaimParams = {
                sendMode: 'claimArc59',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                asset: TEST_ASSET as never,
                shouldClaimAlgo: true,
            }

            let txId: string | undefined
            await act(async () => {
                txId = await result.current.execute({ params })
            })

            expect(mockClaimAsset).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: 'SENDER_ADDR',
                    shouldClaimAlgo: true,
                }),
            )
            expect(txId).toBe('CLAIM_TX_2')
        })

        it('should call rejectAsset and return last txId', async () => {
            mockRejectAsset.mockResolvedValue({
                txIds: ['REJECT_TX_1', 'REJECT_TX_2'],
            })

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendClaimParams = {
                sendMode: 'rejectArc59',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                asset: TEST_ASSET as never,
                shouldClaimAlgo: false,
            }

            let txId: string | undefined
            await act(async () => {
                txId = await result.current.execute({ params })
            })

            expect(mockRejectAsset).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: 'SENDER_ADDR',
                    shouldClaimAlgo: false,
                }),
            )
            expect(txId).toBe('REJECT_TX_2')
        })
    })

    describe('null transaction', () => {
        it('should throw when params is null', async () => {
            const { result } = renderHook(() => useTransactionSendFlow())

            let error: Error | undefined
            await act(async () => {
                try {
                    await result.current.execute({ params: null })
                } catch (e) {
                    error = e as Error
                }
            })

            expect(error).toBeDefined()
            expect(mockPayment).not.toHaveBeenCalled()
            expect(mockAssetTransfer).not.toHaveBeenCalled()
            expect(mockSendExpress).not.toHaveBeenCalled()
            expect(mockSendViaInbox).not.toHaveBeenCalled()
            expect(mockClaimAsset).not.toHaveBeenCalled()
            expect(mockRejectAsset).not.toHaveBeenCalled()
        })
    })

    describe('error handling', () => {
        it('should propagate errors when execute rejects', async () => {
            const networkError = new Error('Network error')
            mockPayment.mockRejectedValue(networkError)

            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'normal',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: ALGO_ASSET as never,
                amount: new Decimal(5),
            }

            let error: Error | undefined
            await act(async () => {
                try {
                    await result.current.execute({ params })
                } catch (e) {
                    error = e as Error
                }
            })

            expect(error).toBe(networkError)
        })

        it('should throw InvalidSendParamsError when asset is missing', async () => {
            const { result } = renderHook(() => useTransactionSendFlow())

            const params: SendTransactionParams = {
                sendMode: 'normal',
                sender: { address: 'SENDER_ADDR', name: 'Test' } as never,
                receiver: 'RECEIVER_ADDR',
                asset: undefined,
                amount: new Decimal(5),
            }

            let error: Error | undefined
            await act(async () => {
                try {
                    await result.current.execute({ params })
                } catch (e) {
                    error = e as Error
                }
            })

            expect(error).toBeDefined()
            expect(error?.name).toBe('InvalidSendParamsError')
        })
    })
})
