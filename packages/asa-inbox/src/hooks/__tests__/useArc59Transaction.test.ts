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

import { useArc59SendTransaction } from '../useArc59SendTransaction'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: vi.fn(),
    useNetwork: vi.fn(),
}))
vi.mock('@algorandfoundation/algokit-utils', () => ({
    // Identity passthrough: the populated ATC is the one we hand back from
    // composer.build(), so buildGroup() resolves to the stub transactions.
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
        getArc59Config: (network: string) => {
            if (network === 'mainnet') return config.arc59.mainnet
            if (network === 'betanet') return null
            return config.arc59.testnet
        },
    }
})

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

const STUB_TXN = { sender: 'SENDER_ADDRESS' }

// Real, valid 58-char Algorand addresses so `decodeAddress` works.
const SENDER_ADDRESS =
    'EZRVNZFJGOUZC67FUMEC7ZMVP232TPICFTQCVZ6EQEIRRT3TIHSKZULRNI'
const RECEIVER_ADDRESS =
    'AAAAAAAAAPYIVG67FPRDGBOL6SKVHCLB4XUGZYITRKU54NHZUACJHFA4CU'
const INBOX_ADDRESS =
    'OJVMSUIFJXMRWFSFG2CPPWMFTWXRXN3J42PZATE24FVKU4Q43DPCZXEA24'
// Matches the mocked testnet ARC59 appId (default network is testnet).
const ARC59_TESTNET_APP_ID = 643020148n

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
    sender: SENDER_ADDRESS,
    receiver: RECEIVER_ADDRESS,
    assetId: 12345n,
    amount: 1000n,
    summary: baseSummary,
    senderMinFee: 1000n,
}

describe('useArc59SendTransaction', () => {
    let mockComposer: {
        addPayment: Mock
        addAppCallMethodCall: Mock
        build: Mock
    }
    let mockAlgokit: {
        newGroup: Mock
        getSuggestedParams: Mock
        createTransaction: { assetTransfer: Mock }
        client: { algod: object }
    }

    const mockSuggestedParams = { minFee: 1000n }

    beforeEach(() => {
        vi.clearAllMocks()
        arc59ClientConstructorArgs = []

        const mockAtc = {
            buildGroup: vi.fn().mockReturnValue([{ txn: STUB_TXN }]),
        }
        mockComposer = {
            addPayment: vi.fn().mockReturnThis(),
            addAppCallMethodCall: vi.fn().mockReturnThis(),
            build: vi.fn().mockResolvedValue({ atc: mockAtc }),
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
            client: { algod: {} },
        }
        ;(useAlgorandClient as Mock).mockReturnValue(mockAlgokit)
        ;(useNetwork as Mock).mockReturnValue({ network: 'testnet' })
    })

    test('returns buildSendViaInboxTxs function', () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        expect(result.current.buildSendViaInboxTxs).toBeTypeOf('function')
    })

    test('uses testnet config when not on mainnet', async () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'testnet' })

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
        })

        expect(arc59ClientConstructorArgs[0]).toEqual(
            expect.objectContaining({
                appId: config.arc59.testnet.appId,
            }),
        )
    })

    test('uses mainnet config when on mainnet', async () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
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

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
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
        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
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

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
        })

        expect(mockComposer.addPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: SENDER_ADDRESS,
                receiver: 'TESTNET_APP_ADDRESS',
                amount: BigInt(300000).microAlgo(),
            }),
        )
    })

    test('adds payment for MBR even when algo_fund_amount is 0', async () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
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

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
        })

        expect(mockComposer.addPayment).not.toHaveBeenCalled()
    })

    test('adds arc59_sendAsset app call to the group', async () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
        })

        expect(mockParamsSendAsset).toHaveBeenCalled()
        expect(mockComposer.addAppCallMethodCall).toHaveBeenCalled()
    })

    test('creates asset transfer with correct params', async () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
        })

        expect(
            mockAlgokit.createTransaction.assetTransfer,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: SENDER_ADDRESS,
                receiver: 'TESTNET_APP_ADDRESS',
                amount: 1000n,
                assetId: 12345n,
            }),
        )
    })

    test('returns PeraTransaction[] from the built group', async () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        let txResult: unknown

        await act(async () => {
            txResult = await result.current.buildSendViaInboxTxs(baseParams)
        })

        expect(Array.isArray(txResult)).toBe(true)
        expect(txResult).toEqual([STUB_TXN])
    })

    test('fetches suggested params before building transactions', async () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
        })

        expect(mockAlgokit.getSuggestedParams).toHaveBeenCalledTimes(1)
    })

    test('uses suggestedParams.minFee for opt-in extra fee', async () => {
        const params = {
            ...baseParams,
            summary: { ...baseSummary, is_arc59_opted_in: false },
        }

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
        })

        expect(mockParamsOptRouterIn).toHaveBeenCalledWith(
            expect.objectContaining({
                extraFee: mockSuggestedParams.minFee.microAlgo(),
            }),
        )
    })

    test('uses suggestedParams.minFee * inner_tx_count for sendAsset extra fee', async () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
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

    test('calls composer.build() (not send) after composing transactions', async () => {
        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(baseParams)
        })

        expect(mockComposer.build).toHaveBeenCalledTimes(1)
    })

    test('passes explicit refs to arc59_sendAsset and never simulates when inbox_address is set', async () => {
        const params = {
            ...baseParams,
            sender: SENDER_ADDRESS,
            receiver: RECEIVER_ADDRESS,
            summary: {
                ...baseSummary,
                is_arc59_opted_in: true,
                inbox_address: INBOX_ADDRESS,
            },
        }

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
        })

        expect(mockParamsSendAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                accountReferences: [RECEIVER_ADDRESS, INBOX_ADDRESS],
                assetReferences: [params.assetId],
                boxReferences: [
                    {
                        appId: ARC59_TESTNET_APP_ID,
                        name: decodeAddress(RECEIVER_ADDRESS).publicKey,
                    },
                ],
            }),
        )
        expect(populateAppCallResources).not.toHaveBeenCalled()
    })

    test('passes explicit refs to arc59_optRouterIn when router not opted in and inbox_address is set', async () => {
        const params = {
            ...baseParams,
            sender: SENDER_ADDRESS,
            receiver: RECEIVER_ADDRESS,
            summary: {
                ...baseSummary,
                is_arc59_opted_in: false,
                inbox_address: INBOX_ADDRESS,
            },
        }

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
        })

        expect(mockParamsOptRouterIn).toHaveBeenCalledWith(
            expect.objectContaining({
                assetReferences: [params.assetId],
            }),
        )
        expect(mockParamsSendAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                accountReferences: [RECEIVER_ADDRESS, INBOX_ADDRESS],
                assetReferences: [params.assetId],
                boxReferences: [
                    {
                        appId: ARC59_TESTNET_APP_ID,
                        name: decodeAddress(RECEIVER_ADDRESS).publicKey,
                    },
                ],
            }),
        )
        expect(populateAppCallResources).not.toHaveBeenCalled()
    })

    test('sends to a fresh receiver (inbox_address null) with receiver-only explicit refs and never simulates', async () => {
        // A first send to someone with no inbox yet: the inbox is created
        // inside arc59_sendAsset, so it must NOT be pre-referenced. The send
        // must still build WITHOUT simulate (the prod algod proxy blocks it) —
        // referencing just the receiver + box + asset. Verified on-chain
        // against a simulate-blocked node.
        const params = {
            ...baseParams,
            sender: SENDER_ADDRESS,
            receiver: RECEIVER_ADDRESS,
            summary: {
                ...baseSummary,
                is_arc59_opted_in: true,
                inbox_address: null,
            },
        }

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
        })

        expect(mockParamsSendAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                accountReferences: [RECEIVER_ADDRESS],
                assetReferences: [params.assetId],
                boxReferences: [
                    {
                        appId: ARC59_TESTNET_APP_ID,
                        name: decodeAddress(RECEIVER_ADDRESS).publicKey,
                    },
                ],
            }),
        )
        expect(populateAppCallResources).not.toHaveBeenCalled()
    })

    test('opts the router in with explicit refs even when inbox_address is null', async () => {
        const params = {
            ...baseParams,
            sender: SENDER_ADDRESS,
            receiver: RECEIVER_ADDRESS,
            summary: {
                ...baseSummary,
                is_arc59_opted_in: false,
                inbox_address: null,
            },
        }

        const { result } = renderHook(() => useArc59SendTransaction())

        await act(async () => {
            await result.current.buildSendViaInboxTxs(params)
        })

        expect(mockParamsOptRouterIn).toHaveBeenCalledWith(
            expect.objectContaining({ assetReferences: [params.assetId] }),
        )
        expect(populateAppCallResources).not.toHaveBeenCalled()
    })

    // A quantum (Falcon) sender's own outer txns pay the PQ-aware rate; the
    // router's inner txns are app-authorized and always pool at the base fee.
    describe('PQ sender fees', () => {
        const PQ_FEE = 3000n

        test('raises outer txn fees to senderMinFee, keeps inner pooling at base', async () => {
            const params = {
                ...baseParams,
                summary: {
                    ...baseSummary,
                    is_arc59_opted_in: false,
                    inner_tx_count: 5,
                },
                senderMinFee: PQ_FEE,
            }

            const { result } = renderHook(() => useArc59SendTransaction())

            await act(async () => {
                await result.current.buildSendViaInboxTxs(params)
            })

            // funding payment: sender-signed → PQ rate
            expect(mockComposer.addPayment).toHaveBeenCalledWith(
                expect.objectContaining({ staticFee: PQ_FEE.microAlgo() }),
            )
            // axfer arg: sender-signed → PQ rate
            expect(
                mockAlgokit.createTransaction.assetTransfer,
            ).toHaveBeenCalledWith(
                expect.objectContaining({ staticFee: PQ_FEE.microAlgo() }),
            )
            // optRouterIn: PQ outer + 1 pooled inner at base
            expect(mockParamsOptRouterIn).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: BigInt(4000).microAlgo(),
                }),
            )
            // sendAsset: PQ outer + 5 pooled inners at base
            expect(mockParamsSendAsset).toHaveBeenCalledWith(
                expect.objectContaining({
                    staticFee: BigInt(8000).microAlgo(),
                }),
            )
        })

        test('non-PQ sender keeps extraFee pooling and no staticFee', async () => {
            const params = {
                ...baseParams,
                summary: { ...baseSummary, is_arc59_opted_in: false },
            }

            const { result } = renderHook(() => useArc59SendTransaction())

            await act(async () => {
                await result.current.buildSendViaInboxTxs(params)
            })

            expect(mockComposer.addPayment).toHaveBeenCalledWith(
                expect.not.objectContaining({ staticFee: expect.anything() }),
            )
            expect(
                mockAlgokit.createTransaction.assetTransfer,
            ).toHaveBeenCalledWith(
                expect.not.objectContaining({ staticFee: expect.anything() }),
            )
            expect(mockParamsOptRouterIn).toHaveBeenCalledWith(
                expect.objectContaining({
                    extraFee: mockSuggestedParams.minFee.microAlgo(),
                }),
            )
            expect(mockParamsSendAsset).toHaveBeenCalledWith(
                expect.objectContaining({
                    extraFee: (
                        mockSuggestedParams.minFee *
                        BigInt(baseSummary.inner_tx_count)
                    ).microAlgo(),
                }),
            )
        })
    })

    test('building an inbox send on a network without the inbox app fails typed', async () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'betanet' })

        const { result } = renderHook(() => useArc59SendTransaction())

        // Was: TestNet's app id, sent to betanet's algod, failing opaquely at
        // submit. Now it cannot get that far.
        await expect(
            result.current.buildSendViaInboxTxs(baseParams),
        ).rejects.toBeInstanceOf(PeraServiceUnavailableError)
    })
})
