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

import { useArc59Transaction } from '../useArc59Transaction'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { config } from '@perawallet/wallet-core-config'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        arc59: {
            testnet: {
                appId: 643020148n,
                appAddress: 'TESTNET_APP_ADDRESS',
            },
            mainnet: {
                appId: 2449590623n,
                appAddress: 'MAINNET_APP_ADDRESS',
            },
        },
    },
}))

// Track AppClient constructor calls and allow per-test instance configuration
let appClientConstructorArgs: unknown[] = []
let mockAppClientSendCall: Mock
let mockAppClientParamsCall: Mock

vi.mock('@algorandfoundation/algokit-utils/types/app-client', () => {
    return {
        AppClient: class MockAppClient {
            send: { call: Mock }
            params: { call: Mock }

            constructor(...args: unknown[]) {
                appClientConstructorArgs.push(args[0])
                this.send = { call: mockAppClientSendCall }
                this.params = { call: mockAppClientParamsCall }
            }
        },
    }
})

const mockSigner = vi.fn().mockResolvedValue(['signed-tx'])

const baseSummary = {
    is_arc59_opted_in: true,
    minimum_balance_requirement: 100000,
    inner_tx_count: 2,
    total_protocol_and_mbr_fee: 4000,
    inbox_address: null,
    algo_fund_amount: 0,
    warning_message: null,
}

const baseParams = {
    sender: 'SENDER_ADDRESS',
    receiver: 'RECEIVER_ADDRESS',
    assetId: 12345n,
    amount: 1000n,
    summary: baseSummary,
}

describe('useArc59Transaction', () => {
    let mockComposer: {
        addPayment: Mock
        addAppCallMethodCall: Mock
        send: Mock
    }
    let mockAlgokit: {
        newGroup: Mock
        getSuggestedParams: Mock
        createTransaction: { assetTransfer: Mock }
    }

    const mockSuggestedParams = { minFee: 1000n }

    beforeEach(() => {
        vi.clearAllMocks()
        appClientConstructorArgs = []

        mockComposer = {
            addPayment: vi.fn().mockReturnThis(),
            addAppCallMethodCall: vi.fn().mockReturnThis(),
            send: vi.fn().mockResolvedValue({ txIds: ['tx1', 'tx2'] }),
        }

        mockAppClientSendCall = vi.fn().mockResolvedValue({})
        mockAppClientParamsCall = vi
            .fn()
            .mockResolvedValue({ method: 'arc59_sendAsset' })

        mockAlgokit = {
            newGroup: vi.fn().mockReturnValue(mockComposer),
            getSuggestedParams: vi.fn().mockResolvedValue(mockSuggestedParams),
            createTransaction: {
                assetTransfer: vi.fn().mockResolvedValue('mock-axfer-txn'),
            },
        }
        ;(useAlgorandClient as Mock).mockReturnValue(mockAlgokit)
        ;(useNetwork as Mock).mockReturnValue({ isMainnet: false })
    })

    test('returns sendViaInbox function', () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        expect(result.current.sendViaInbox).toBeTypeOf('function')
    })

    test('uses testnet config when not on mainnet', async () => {
        ;(useNetwork as Mock).mockReturnValue({ isMainnet: false })

        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(appClientConstructorArgs[0]).toEqual(
            expect.objectContaining({
                appId: config.arc59.testnet.appId,
            }),
        )
    })

    test('uses mainnet config when on mainnet', async () => {
        ;(useNetwork as Mock).mockReturnValue({ isMainnet: true })

        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(appClientConstructorArgs[0]).toEqual(
            expect.objectContaining({
                appId: config.arc59.mainnet.appId,
            }),
        )
    })

    test('opts router in when not already opted in', async () => {
        const params = {
            ...baseParams,
            summary: { ...baseSummary, is_arc59_opted_in: false },
        }

        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(params)
        })

        expect(mockAppClientSendCall).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'arc59_optRouterIn',
                args: [params.assetId],
            }),
        )
    })

    test('skips router opt-in when already opted in', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockAppClientSendCall).not.toHaveBeenCalled()
    })

    test('adds MBR payment when algo_fund_amount > 0', async () => {
        const params = {
            ...baseParams,
            summary: { ...baseSummary, algo_fund_amount: 200000 },
        }

        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(params)
        })

        expect(mockComposer.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SENDER_ADDRESS',
                receiver: 'TESTNET_APP_ADDRESS',
            }),
        )
    })

    test('skips MBR payment when algo_fund_amount is 0', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockComposer.addPayment).not.toHaveBeenCalled()
    })

    test('adds arc59_sendAsset app call to the group', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockAppClientParamsCall).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'arc59_sendAsset',
            }),
        )
        expect(mockComposer.addAppCallMethodCall).toHaveBeenCalled()
    })

    test('creates asset transfer with correct params', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(
            mockAlgokit.createTransaction.assetTransfer,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SENDER_ADDRESS',
                receiver: 'TESTNET_APP_ADDRESS',
                amount: 1000n,
                assetId: 12345n,
            }),
        )
    })

    test('returns txIds from the composed group send', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        let txResult: { txIds: string[] } | undefined

        await act(async () => {
            txResult = await result.current.sendViaInbox(baseParams)
        })

        expect(txResult).toEqual({ txIds: ['tx1', 'tx2'] })
    })

    test('fetches suggested params before building transactions', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockAlgokit.getSuggestedParams).toHaveBeenCalledTimes(1)
    })

    test('uses suggestedParams.minFee for opt-in extra fee', async () => {
        const params = {
            ...baseParams,
            summary: { ...baseSummary, is_arc59_opted_in: false },
        }

        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(params)
        })

        expect(mockAppClientSendCall).toHaveBeenCalledWith(
            expect.objectContaining({
                extraFee: mockSuggestedParams.minFee.microAlgo(),
            }),
        )
    })

    test('uses suggestedParams.minFee * inner_tx_count for sendAsset extra fee', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        const expectedFee = (
            mockSuggestedParams.minFee * BigInt(baseSummary.inner_tx_count)
        ).microAlgo()

        expect(mockAppClientParamsCall).toHaveBeenCalledWith(
            expect.objectContaining({
                extraFee: expectedFee,
            }),
        )
    })

    test('sends composer group after building', async () => {
        const { result } = renderHook(() => useArc59Transaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockComposer.send).toHaveBeenCalledTimes(1)
    })
})
