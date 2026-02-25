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

import { useArc59ClaimTransaction } from '../useArc59ClaimTransaction'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'

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

let mockParamsClaimAlgo: Mock
let mockParamsClaim: Mock
let mockParamsReject: Mock

vi.mock('../../clients', () => {
    return {
        ARC59Client: class MockARC59Client {
            params: {
                arc59_claimAlgo: Mock
                arc59_claim: Mock
                arc59_reject: Mock
            }

            constructor() {
                this.params = {
                    arc59_claimAlgo: mockParamsClaimAlgo,
                    arc59_claim: mockParamsClaim,
                    arc59_reject: mockParamsReject,
                }
            }
        },
    }
})

const mockSigner = vi.fn().mockResolvedValue(['signed-tx'])

const MIN_FEE = 1000n

const baseClaimParams = {
    sender: 'SENDER_ADDRESS',
    assetId: 12345n,
    shouldClaimAlgo: false,
}

describe('useArc59ClaimTransaction', () => {
    let mockComposer: {
        addAppCallMethodCall: Mock
        addAssetOptIn: Mock
        send: Mock
    }
    let mockAccountInformation: Mock
    let mockAlgokit: {
        newGroup: Mock
        getSuggestedParams: Mock
        client: { algod: { accountInformation: Mock } }
    }

    const mockSuggestedParams = { minFee: MIN_FEE }

    beforeEach(() => {
        vi.clearAllMocks()

        mockComposer = {
            addAppCallMethodCall: vi.fn().mockReturnThis(),
            addAssetOptIn: vi.fn().mockReturnThis(),
            send: vi.fn().mockResolvedValue({ txIds: ['tx1', 'tx2'] }),
        }

        mockParamsClaimAlgo = vi
            .fn()
            .mockResolvedValue({ method: 'arc59_claimAlgo' })
        mockParamsClaim = vi.fn().mockResolvedValue({ method: 'arc59_claim' })
        mockParamsReject = vi.fn().mockResolvedValue({ method: 'arc59_reject' })

        mockAccountInformation = vi.fn().mockResolvedValue({
            assets: [{ assetId: 12345n, amount: 0n, isFrozen: false }],
        })

        mockAlgokit = {
            newGroup: vi.fn().mockReturnValue(mockComposer),
            getSuggestedParams: vi.fn().mockResolvedValue(mockSuggestedParams),
            client: { algod: { accountInformation: mockAccountInformation } },
        }
        ;(useAlgorandClient as Mock).mockReturnValue(mockAlgokit)
        ;(useNetwork as Mock).mockReturnValue({ isMainnet: false })
    })

    test('returns claimAsset and rejectAsset functions', () => {
        const { result } = renderHook(() =>
            useArc59ClaimTransaction(mockSigner),
        )

        expect(result.current.claimAsset).toBeTypeOf('function')
        expect(result.current.rejectAsset).toBeTypeOf('function')
    })

    describe('claimAsset', () => {
        test('does not add arc59_claimAlgo when shouldClaimAlgo is false', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.claimAsset(baseClaimParams)
            })

            expect(mockParamsClaimAlgo).not.toHaveBeenCalled()
        })

        test('prepends arc59_claimAlgo when shouldClaimAlgo is true', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.claimAsset({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalled()
            expect(mockParamsClaim).toHaveBeenCalled()
        })

        test('sets extraFee to minFee for arc59_claimAlgo (1 inner txn)', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.claimAsset({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalledWith(
                expect.objectContaining({
                    extraFee: MIN_FEE.microAlgo(),
                }),
            )
        })

        test('does not add asset opt-in when sender is already opted in', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.claimAsset(baseClaimParams)
            })

            expect(mockComposer.addAssetOptIn).not.toHaveBeenCalled()
        })

        test('adds asset opt-in when sender is not opted in', async () => {
            mockAccountInformation.mockResolvedValue({ assets: [] })

            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.claimAsset(baseClaimParams)
            })

            expect(mockComposer.addAssetOptIn).toHaveBeenCalledWith({
                sender: 'SENDER_ADDRESS',
                assetId: 12345n,
            })
        })

        test('treats account info error as not opted in', async () => {
            mockAccountInformation.mockRejectedValue(
                new Error('account not found'),
            )

            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.claimAsset(baseClaimParams)
            })

            expect(mockComposer.addAssetOptIn).toHaveBeenCalledWith({
                sender: 'SENDER_ADDRESS',
                assetId: 12345n,
            })
        })

        test('sets extraFee to minFee * 2 for arc59_claim (2 inner txns)', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.claimAsset(baseClaimParams)
            })

            expect(mockParamsClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    extraFee: (MIN_FEE * BigInt(2)).microAlgo(),
                }),
            )
        })

        test('returns txIds from composed group', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            let txResult: { txIds: string[] } | undefined

            await act(async () => {
                txResult = await result.current.claimAsset(baseClaimParams)
            })

            expect(txResult).toEqual({ txIds: ['tx1', 'tx2'] })
        })
    })

    describe('rejectAsset', () => {
        test('does not add arc59_claimAlgo when shouldClaimAlgo is false', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.rejectAsset(baseClaimParams)
            })

            expect(mockParamsClaimAlgo).not.toHaveBeenCalled()
        })

        test('prepends arc59_claimAlgo when shouldClaimAlgo is true', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.rejectAsset({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalled()
            expect(mockParamsReject).toHaveBeenCalled()
        })

        test('sets extraFee to minFee * 2 for arc59_reject (2 inner txns)', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            await act(async () => {
                await result.current.rejectAsset(baseClaimParams)
            })

            expect(mockParamsReject).toHaveBeenCalledWith(
                expect.objectContaining({
                    extraFee: (MIN_FEE * BigInt(2)).microAlgo(),
                }),
            )
        })

        test('returns txIds from composed group', async () => {
            const { result } = renderHook(() =>
                useArc59ClaimTransaction(mockSigner),
            )

            let txResult: { txIds: string[] } | undefined

            await act(async () => {
                txResult = await result.current.rejectAsset(baseClaimParams)
            })

            expect(txResult).toEqual({ txIds: ['tx1', 'tx2'] })
        })
    })
})
