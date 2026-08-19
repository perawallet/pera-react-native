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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { decodeAddress } from 'algosdk'

import { useArc59ClaimTransaction } from '../useArc59ClaimTransaction'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: vi.fn(),
    useNetwork: vi.fn(),
}))
vi.mock('@algorandfoundation/algokit-utils', () => ({
    // Identity passthrough: the populated ATC is the one composer.build()
    // returns, so buildGroup() resolves to the stub transactions.
    populateAppCallResources: vi.fn(async (atc: unknown) => atc),
}))
vi.mock('@perawallet/wallet-core-config', () => {
    const config = {
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
    }
    return {
        config,
        getArc59Config: (network: string) =>
            network === 'mainnet' ? config.arc59.mainnet : config.arc59.testnet,
    }
})

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

// Real, valid 58-char Algorand addresses so `decodeAddress` works.
const SENDER_ADDRESS =
    'EZRVNZFJGOUZC67FUMEC7ZMVP232TPICFTQCVZ6EQEIRRT3TIHSKZULRNI'
const INBOX_ADDRESS =
    'OJVMSUIFJXMRWFSFG2CPPWMFTWXRXN3J42PZATE24FVKU4Q43DPCZXEA24'
const CREATOR_ADDRESS =
    'PERAIS5VIL6XK5GFUMDO6WASEPIOV54TINIWVDLJ65Y2Z4NA65GX42YUSA'
// Matches the mocked testnet ARC59 appId (default network is testnet).
const ARC59_TESTNET_APP_ID = 643020148n

const STUB_TXN = { sender: SENDER_ADDRESS }

const MIN_FEE = 1000n

const baseClaimParams = {
    sender: SENDER_ADDRESS,
    assetId: 12345n,
    shouldClaimAlgo: false,
    inboxAddress: null,
    assetCreator: CREATOR_ADDRESS,
    senderMinFee: 1000n,
}

describe('useArc59ClaimTransaction', () => {
    let mockComposer: {
        addAppCallMethodCall: Mock
        addAssetOptIn: Mock
        build: Mock
    }
    let mockAccountDo: Mock
    let mockAccountInformation: Mock
    let mockAlgokit: {
        newGroup: Mock
        getSuggestedParams: Mock
        client: { algod: { accountInformation: Mock } }
    }

    const mockSuggestedParams = { minFee: MIN_FEE }

    beforeEach(() => {
        vi.clearAllMocks()

        const mockAtc = {
            buildGroup: vi.fn().mockReturnValue([{ txn: STUB_TXN }]),
        }
        mockComposer = {
            addAppCallMethodCall: vi.fn().mockReturnThis(),
            addAssetOptIn: vi.fn().mockReturnThis(),
            build: vi.fn().mockResolvedValue({ atc: mockAtc }),
        }

        mockParamsClaimAlgo = vi
            .fn()
            .mockResolvedValue({ method: 'arc59_claimAlgo' })
        mockParamsClaim = vi.fn().mockResolvedValue({ method: 'arc59_claim' })
        mockParamsReject = vi.fn().mockResolvedValue({ method: 'arc59_reject' })

        mockAccountDo = vi.fn().mockResolvedValue({
            assets: [{ assetId: 12345n, amount: 0n, isFrozen: false }],
        })
        mockAccountInformation = vi.fn().mockReturnValue({ do: mockAccountDo })

        mockAlgokit = {
            newGroup: vi.fn().mockReturnValue(mockComposer),
            getSuggestedParams: vi.fn().mockResolvedValue(mockSuggestedParams),
            client: { algod: { accountInformation: mockAccountInformation } },
        }
        ;(useAlgorandClient as Mock).mockReturnValue(mockAlgokit)
        ;(useNetwork as Mock).mockReturnValue({ network: 'testnet' })
    })

    test('returns buildClaimAssetTxs and buildRejectAssetTxs functions', () => {
        const { result } = renderHook(() => useArc59ClaimTransaction())

        expect(result.current.buildClaimAssetTxs).toBeTypeOf('function')
        expect(result.current.buildRejectAssetTxs).toBeTypeOf('function')
    })

    describe('buildClaimAssetTxs', () => {
        test('does not add arc59_claimAlgo when shouldClaimAlgo is false', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(mockParamsClaimAlgo).not.toHaveBeenCalled()
        })

        test('prepends arc59_claimAlgo when shouldClaimAlgo is true', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalled()
            expect(mockParamsClaim).toHaveBeenCalled()
        })

        test('sets staticFee to 0 for arc59_claimAlgo (fee pooled to main call)', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: 0n.microAlgo(),
                }),
            )
        })

        test('does not add asset opt-in when sender is already opted in', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(mockComposer.addAssetOptIn).not.toHaveBeenCalled()
        })

        test('adds asset opt-in with staticFee 0 when sender is not opted in', async () => {
            mockAccountDo.mockResolvedValue({ assets: [] })

            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(mockComposer.addAssetOptIn).toHaveBeenCalledWith({
                sender: SENDER_ADDRESS,
                assetId: 12345n,
                staticFee: 0n.microAlgo(),
            })
        })

        test('treats account info error as not opted in', async () => {
            mockAccountDo.mockRejectedValue(new Error('account not found'))

            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(mockComposer.addAssetOptIn).toHaveBeenCalledWith({
                sender: SENDER_ADDRESS,
                assetId: 12345n,
                staticFee: 0n.microAlgo(),
            })
        })

        test('sets staticFee to 3 * minFee for arc59_claim (base case, opted in)', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            // Base fee: 3 * minFee (already opted in, no claimAlgo)
            expect(mockParamsClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: (MIN_FEE * BigInt(3)).microAlgo(),
                }),
            )
        })

        test('adds 2 * minFee to claim fee when shouldClaimAlgo is true', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            // 3 * minFee (base) + 2 * minFee (claimAlgo) = 5 * minFee
            expect(mockParamsClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: (MIN_FEE * BigInt(5)).microAlgo(),
                }),
            )
        })

        test('adds 1 * minFee to claim fee when not opted in', async () => {
            mockAccountDo.mockResolvedValue({ assets: [] })

            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            // 3 * minFee (base) + 1 * minFee (opt-in) = 4 * minFee
            expect(mockParamsClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: (MIN_FEE * BigInt(4)).microAlgo(),
                }),
            )
        })

        test('returns PeraTransaction[] from the built group', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            let txResult: unknown

            await act(async () => {
                txResult =
                    await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(Array.isArray(txResult)).toBe(true)
            expect(txResult).toEqual([STUB_TXN])
        })

        test('calls composer.build() (not send) after composing transactions', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(mockComposer.build).toHaveBeenCalledTimes(1)
        })

        test('treats accountInfo with no assets field as not opted in', async () => {
            mockAccountDo.mockResolvedValue({})

            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(mockComposer.addAssetOptIn).toHaveBeenCalled()
        })

        test('uses mainnet config when network is mainnet', async () => {
            ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })

            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(mockParamsClaim).toHaveBeenCalled()
        })

        test('passes explicit refs to arc59_claim and never simulates when inboxAddress is set', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs({
                    ...baseClaimParams,
                    inboxAddress: INBOX_ADDRESS,
                })
            })

            expect(mockParamsClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountReferences: [INBOX_ADDRESS],
                    assetReferences: [12345n],
                    boxReferences: [
                        {
                            appId: ARC59_TESTNET_APP_ID,
                            name: decodeAddress(SENDER_ADDRESS).publicKey,
                        },
                    ],
                }),
            )
            expect(populateAppCallResources).not.toHaveBeenCalled()
        })

        test('passes explicit refs to arc59_claimAlgo when shouldClaimAlgo and inboxAddress are set', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                    inboxAddress: INBOX_ADDRESS,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountReferences: [INBOX_ADDRESS],
                    boxReferences: [
                        {
                            appId: ARC59_TESTNET_APP_ID,
                            name: decodeAddress(SENDER_ADDRESS).publicKey,
                        },
                    ],
                }),
            )
            expect(populateAppCallResources).not.toHaveBeenCalled()
        })

        test('falls back to simulate population when inboxAddress is null', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs(baseClaimParams)
            })

            expect(populateAppCallResources).toHaveBeenCalledTimes(1)
        })
    })

    // A quantum (Falcon) claimer's outer txns pay the PQ-aware rate; the
    // router's inner txns are app-authorized and always pool at the base fee.
    // The pooled shape (staticFee 0 legs) is unchanged — only totals rise.
    describe('PQ claimer fees', () => {
        const PQ_FEE = 3000n

        test('claim: pooled total = senderFee per outer + base per inner', async () => {
            // Not opted in + claimAlgo → outers: claim call, opt-in, claimAlgo;
            // inners: 2 (claim) + 1 (claimAlgo).
            mockAccountDo.mockResolvedValue({ assets: [] })

            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                    senderMinFee: PQ_FEE,
                })
            })

            // 3 outers * 3000 + 3 inners * 1000 = 12000
            expect(mockParamsClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: BigInt(12000).microAlgo(),
                }),
            )
            // pooled legs stay at 0
            expect(mockParamsClaimAlgo).toHaveBeenCalledWith(
                expect.objectContaining({ staticFee: 0n.microAlgo() }),
            )
            expect(mockComposer.addAssetOptIn).toHaveBeenCalledWith(
                expect.objectContaining({ staticFee: 0n.microAlgo() }),
            )
        })

        test('claim: opted-in base case = senderFee + 2 inners at base', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildClaimAssetTxs({
                    ...baseClaimParams,
                    senderMinFee: PQ_FEE,
                })
            })

            // 1 outer * 3000 + 2 inners * 1000 = 5000
            expect(mockParamsClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: BigInt(5000).microAlgo(),
                }),
            )
        })

        test('reject: pooled total = senderFee per outer + base per inner', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs({
                    ...baseClaimParams,
                    senderMinFee: PQ_FEE,
                })
            })

            // 1 outer * 3000 + 2 inners * 1000 = 5000
            expect(mockParamsReject).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: BigInt(5000).microAlgo(),
                }),
            )
        })

        test('reject with claimAlgo: adds a PQ outer + base inner', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                    senderMinFee: PQ_FEE,
                })
            })

            // (3000 + 2*1000) + (3000 + 1*1000) = 9000
            expect(mockParamsReject).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: BigInt(9000).microAlgo(),
                }),
            )
        })
    })

    describe('buildRejectAssetTxs', () => {
        test('does not add arc59_claimAlgo when shouldClaimAlgo is false', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs(baseClaimParams)
            })

            expect(mockParamsClaimAlgo).not.toHaveBeenCalled()
        })

        test('prepends arc59_claimAlgo when shouldClaimAlgo is true', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalled()
            expect(mockParamsReject).toHaveBeenCalled()
        })

        test('sets staticFee to 3 * minFee for arc59_reject (base case)', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs(baseClaimParams)
            })

            // Base fee: 3 * minFee (no claimAlgo)
            expect(mockParamsReject).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: (MIN_FEE * BigInt(3)).microAlgo(),
                }),
            )
        })

        test('sets staticFee to 0 for arc59_claimAlgo in reject flow', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            expect(mockParamsClaimAlgo).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: 0n.microAlgo(),
                }),
            )
        })

        test('adds 2 * minFee to reject fee when shouldClaimAlgo is true', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs({
                    ...baseClaimParams,
                    shouldClaimAlgo: true,
                })
            })

            // 3 * minFee (base) + 2 * minFee (claimAlgo) = 5 * minFee
            expect(mockParamsReject).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: (MIN_FEE * BigInt(5)).microAlgo(),
                }),
            )
        })

        test('returns PeraTransaction[] from the built group', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            let txResult: unknown

            await act(async () => {
                txResult =
                    await result.current.buildRejectAssetTxs(baseClaimParams)
            })

            expect(Array.isArray(txResult)).toBe(true)
            expect(txResult).toEqual([STUB_TXN])
        })

        test('calls composer.build() (not send) after composing transactions', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs(baseClaimParams)
            })

            expect(mockComposer.build).toHaveBeenCalledTimes(1)
        })

        test('uses mainnet config when network is mainnet', async () => {
            ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })

            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs(baseClaimParams)
            })

            expect(mockParamsReject).toHaveBeenCalled()
        })

        test('passes explicit refs (inbox + creator) to arc59_reject and never simulates when inboxAddress is set', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs({
                    ...baseClaimParams,
                    inboxAddress: INBOX_ADDRESS,
                })
            })

            expect(mockParamsReject).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountReferences: [INBOX_ADDRESS, CREATOR_ADDRESS],
                    assetReferences: [12345n],
                    boxReferences: [
                        {
                            appId: ARC59_TESTNET_APP_ID,
                            name: decodeAddress(SENDER_ADDRESS).publicKey,
                        },
                    ],
                }),
            )
            expect(populateAppCallResources).not.toHaveBeenCalled()
        })

        test('falls back to simulate population when inboxAddress is null', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs(baseClaimParams)
            })

            expect(populateAppCallResources).toHaveBeenCalledTimes(1)
        })

        test('falls back to simulate population when inboxAddress is set but assetCreator is empty', async () => {
            const { result } = renderHook(() => useArc59ClaimTransaction())

            await act(async () => {
                await result.current.buildRejectAssetTxs({
                    ...baseClaimParams,
                    inboxAddress: INBOX_ADDRESS,
                    assetCreator: '',
                })
            })

            expect(populateAppCallResources).toHaveBeenCalledTimes(1)
            expect(mockParamsReject).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    accountReferences: expect.arrayContaining(['']),
                }),
            )
        })
    })
})
