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

import { useArc59SendTransaction } from '../useArc59SendTransaction'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-extension-network'
import { config } from '@perawallet/wallet-core-config'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: vi.fn(),
}))
vi.mock('@perawallet/wallet-extension-network', () => ({
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

// Track ARC59Client constructor calls and allow per-test instance configuration
let arc59ClientConstructorArgs: unknown[] = []
let mockParamsOptRouterIn: Mock
let mockParamsSendAsset: Mock

vi.mock('../../clients', () => {
    return {
        ARC59Client: class MockARC59Client {
            params: { arc59_optRouterIn: Mock; arc59_sendAsset: Mock }

            constructor(...args: unknown[]) {
                arc59ClientConstructorArgs.push(args[0])
                this.params = {
                    arc59_optRouterIn: mockParamsOptRouterIn,
                    arc59_sendAsset: mockParamsSendAsset,
                }
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

describe('useArc59SendTransaction', () => {
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
        arc59ClientConstructorArgs = []

        mockComposer = {
            addPayment: vi.fn().mockReturnThis(),
            addAppCallMethodCall: vi.fn().mockReturnThis(),
            send: vi.fn().mockResolvedValue({ txIds: ['tx1', 'tx2'] }),
        }

        mockParamsOptRouterIn = vi
            .fn()
            .mockResolvedValue({ method: 'arc59_optRouterIn' })
        mockParamsSendAsset = vi
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
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        expect(result.current.sendViaInbox).toBeTypeOf('function')
    })

    test('uses testnet config when not on mainnet', async () => {
        ;(useNetwork as Mock).mockReturnValue({ isMainnet: false })

        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(arc59ClientConstructorArgs[0]).toEqual(
            expect.objectContaining({
                appId: config.arc59.testnet.appId,
            }),
        )
    })

    test('uses mainnet config when on mainnet', async () => {
        ;(useNetwork as Mock).mockReturnValue({ isMainnet: true })

        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(arc59ClientConstructorArgs[0]).toEqual(
            expect.objectContaining({
                appId: config.arc59.mainnet.appId,
            }),
        )
    })

    test('opts router in atomically when not already opted in', async () => {
        const params = {
            ...baseParams,
            summary: { ...baseSummary, is_arc59_opted_in: false },
        }

        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(params)
        })

        expect(mockParamsOptRouterIn).toHaveBeenCalledWith(
            expect.objectContaining({
                args: [params.assetId],
            }),
        )
        // Opt-in should go through composer (atomic), not appClient.send
        expect(mockComposer.addAppCallMethodCall).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'arc59_optRouterIn' }),
        )
    })

    test('skips router opt-in when already opted in', async () => {
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockParamsOptRouterIn).not.toHaveBeenCalled()
    })

    test('payment amount sums algo_fund_amount and minimum_balance_requirement', async () => {
        const params = {
            ...baseParams,
            summary: {
                ...baseSummary,
                algo_fund_amount: 200000,
                minimum_balance_requirement: 100000,
            },
        }

        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(params)
        })

        expect(mockComposer.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SENDER_ADDRESS',
                receiver: 'TESTNET_APP_ADDRESS',
                amount: BigInt(300000).microAlgo(),
            }),
        )
    })

    test('adds payment for MBR even when algo_fund_amount is 0', async () => {
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        // baseSummary has minimum_balance_requirement: 100000
        expect(mockComposer.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: BigInt(100000).microAlgo(),
            }),
        )
    })

    test('skips payment when both algo_fund_amount and MBR are 0', async () => {
        const params = {
            ...baseParams,
            summary: {
                ...baseSummary,
                algo_fund_amount: 0,
                minimum_balance_requirement: 0,
            },
        }

        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(params)
        })

        expect(mockComposer.addPayment).not.toHaveBeenCalled()
    })

    test('adds arc59_sendAsset app call to the group', async () => {
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockParamsSendAsset).toHaveBeenCalled()
        expect(mockComposer.addAppCallMethodCall).toHaveBeenCalled()
    })

    test('creates asset transfer with correct params', async () => {
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

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
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        let txResult: { txIds: string[] } | undefined

        await act(async () => {
            txResult = await result.current.sendViaInbox(baseParams)
        })

        expect(txResult).toEqual({ txIds: ['tx1', 'tx2'] })
    })

    test('fetches suggested params before building transactions', async () => {
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

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

        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(params)
        })

        expect(mockParamsOptRouterIn).toHaveBeenCalledWith(
            expect.objectContaining({
                extraFee: mockSuggestedParams.minFee.microAlgo(),
            }),
        )
    })

    test('uses suggestedParams.minFee * inner_tx_count for sendAsset extra fee', async () => {
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        const expectedFee = (
            mockSuggestedParams.minFee * BigInt(baseSummary.inner_tx_count)
        ).microAlgo()

        expect(mockParamsSendAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                extraFee: expectedFee,
            }),
        )
    })

    test('sends composer group after building', async () => {
        const { result } = renderHook(() => useArc59SendTransaction(mockSigner))

        await act(async () => {
            await result.current.sendViaInbox(baseParams)
        })

        expect(mockComposer.send).toHaveBeenCalledTimes(1)
    })
})
