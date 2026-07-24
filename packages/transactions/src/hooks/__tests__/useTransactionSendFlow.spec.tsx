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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useTransactionSendFlow,
    InvalidSendParamsError,
} from '../useTransactionSendFlow'

// BigInt.prototype.microAlgo() (added by algokit-utils) returns an
// AlgoAmount wrapper, not a raw bigint. Patch it to return the bigint itself
// so staticFee/amount assertions below can compare against plain bigints —
// mirrors useSubmitRekeyMutation.spec.ts.
;(BigInt.prototype as unknown as { microAlgo: () => bigint }).microAlgo =
    function () {
        return this as unknown as bigint
    }

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
const mockAddToAssetHolding = vi.fn()
const mockFetchAndPersistAssets = vi.fn()
const mockInvalidateBalances = vi.fn()
const mockUseAllAccounts = vi.fn()
const mockUseMinimumFeeConfig = vi.fn()
const mockResolveMinFeeForSender = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
    resolveMinFeeForSender: (...args: unknown[]) =>
        mockResolveMinFeeForSender(...args),
}))

// Full replacement (not importActual): the real barrels pull in
// platform-specific storage (react-native-mmkv) that can't load under
// vitest/jsdom. resolveMinFeeForSender's own rekey-chain/PQ-multiplier
// correctness is already exhaustively covered elsewhere (see
// packages/signing/src/pipeline/sources/__tests__/minFeeResolver.spec.ts) —
// these tests verify only that this hook wires the resolver's inputs
// correctly and applies the override guard on its output.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    addToAssetHolding: (...args: unknown[]) => mockAddToAssetHolding(...args),
    useAccountBalancesInvalidator: () => ({
        invalidate: mockInvalidateBalances,
    }),
    useAllAccounts: () => mockUseAllAccounts(),
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
        client: {
            algod: {
                accountInformation: () => ({ do: mockAccountInformation }),
            },
        },
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
    useNetwork: () => ({ network: 'mainnet' }),
    useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { assetId: '0', decimals: 6, name: 'Algo', unitName: 'ALGO' },
    fetchAndPersistAssets: (...args: unknown[]) =>
        mockFetchAndPersistAssets(...args),
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
        mockAddToAssetHolding.mockResolvedValue(undefined)
        mockFetchAndPersistAssets.mockResolvedValue(undefined)
        mockUseAllAccounts.mockReturnValue([])
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 100000n,
        })
        // Default: no PQ signer — resolver returns the base fee, which must
        // never force a staticFee override (regression-safe default).
        mockResolveMinFeeForSender.mockReturnValue(1000n)
    })

    it('normal ALGO send: builds payment + submits via pipeline', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            const id = await result.current.execute({
                params: {
                    sendMode: 'normal',
                    sender: { address: 'A' } as any,
                    receiver: 'B',
                    asset: { assetId: '0', decimals: 6 } as any,
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

    describe('PQ-aware min fee overrides', () => {
        it('normal ALGO send: quantum sender gets a staticFee override', async () => {
            mockResolveMinFeeForSender.mockReturnValue(3000n)
            const { result } = renderHook(() => useTransactionSendFlow())
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: { address: 'A' } as any,
                        receiver: 'B',
                        asset: { assetId: '0', decimals: 6 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            expect(mockAddPayment.mock.calls[0][0]).toMatchObject({
                staticFee: 3000n,
            })
            expect(mockResolveMinFeeForSender).toHaveBeenCalledWith({
                senderAddress: 'A',
                accounts: [],
                suggestedMinFee: 1000n,
                configMinTxnFee: 1000n,
                pqMultiplier: 3n,
            })
        })

        it('normal ALGO send: algo25 sender builds without a staticFee key (regression)', async () => {
            // Default beforeEach resolves 1000n === suggestedMinFee.
            const { result } = renderHook(() => useTransactionSendFlow())
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: { address: 'A' } as any,
                        receiver: 'B',
                        asset: { assetId: '0', decimals: 6 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            expect(mockAddPayment.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
        })

        it('close-account send: quantum sender gets staticFee and close semantics are preserved', async () => {
            mockResolveMinFeeForSender.mockReturnValue(3000n)
            const { result } = renderHook(() => useTransactionSendFlow())
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: { address: 'A' } as any,
                        receiver: 'B',
                        asset: { assetId: '0', decimals: 6 } as any,
                        amount: new Decimal(1),
                        isCloseAccount: true,
                    },
                })
            })
            expect(mockAddPayment.mock.calls[0][0]).toMatchObject({
                staticFee: 3000n,
                closeRemainderTo: 'B',
                amount: 0n,
            })
        })

        it('express send: quantum sender + external receiver — funding & transfer get staticFee, opt-in untouched', async () => {
            mockAccountInformation.mockResolvedValueOnce({
                amount: 0n,
                minBalance: 100000n,
            })
            mockResolveMinFeeForSender.mockImplementation(
                ({ senderAddress }: { senderAddress: string }) =>
                    senderAddress === 'A' ? 3000n : 1000n,
            )
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
            // Funding reserves the receiver's (base, non-quantum) fee:
            // mbrAfterOptIn (200000) + receiverFee (1000) = 201000.
            expect(mockAddPayment.mock.calls[0][0]).toMatchObject({
                amount: 201000n,
                staticFee: 3000n,
            })
            expect(mockAddAssetTransfer.mock.calls[0][0]).toMatchObject({
                staticFee: 3000n,
            })
            expect(mockAddAssetOptIn.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
            expect(mockResolveMinFeeForSender).toHaveBeenCalledWith({
                senderAddress: 'B',
                accounts: [],
                suggestedMinFee: 1000n,
                configMinTxnFee: 1000n,
                pqMultiplier: 3n,
            })
        })

        it('express send: algo25 sender + quantum receiver — opt-in gets staticFee, funding & transfer stay at base rate', async () => {
            mockAccountInformation.mockResolvedValueOnce({
                amount: 0n,
                minBalance: 100000n,
            })
            mockResolveMinFeeForSender.mockImplementation(
                ({ senderAddress }: { senderAddress: string }) =>
                    senderAddress === 'B' ? 3000n : 1000n,
            )
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
            // Funding reserves the receiver's (quantum) fee:
            // mbrAfterOptIn (200000) + receiverFee (3000) = 203000.
            expect(mockAddPayment.mock.calls[0][0]).toMatchObject({
                amount: 203000n,
            })
            expect(mockAddPayment.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
            expect(mockAddAssetTransfer.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
            expect(mockAddAssetOptIn.mock.calls[0][0]).toMatchObject({
                staticFee: 3000n,
            })
        })

        it('express send: algo25 sender — everything unchanged (regression)', async () => {
            mockAccountInformation.mockResolvedValueOnce({
                amount: 0n,
                minBalance: 100000n,
            })
            // Default beforeEach resolves 1000n for every sender/receiver.
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
            expect(mockAddPayment.mock.calls[0][0]).toMatchObject({
                amount: 201000n,
            })
            expect(mockAddPayment.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
            expect(mockAddAssetTransfer.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
            expect(mockAddAssetOptIn.mock.calls[0][0]).not.toHaveProperty(
                'staticFee',
            )
        })

        it('express send: MBR reservation follows the remote-config asset MBR', async () => {
            // Non-default asset MBR (200000). Receiver underfunded (balance 0),
            // base receiver fee 1000. Funding must reserve
            // mbrAfterOptIn (100000 + 200000) + receiverFee (1000) = 301000.
            mockAccountInformation.mockResolvedValueOnce({
                amount: 0n,
                minBalance: 100000n,
            })
            mockUseMinimumFeeConfig.mockReturnValue({
                minTxnFee: 1000n,
                pqMultiplier: 3n,
                assetMbr: 200000n,
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
            expect(mockAddPayment.mock.calls[0][0]).toMatchObject({
                amount: 301000n,
            })
        })
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
                    inboxAddress: 'INBOX',
                },
            })
        })
        expect(mockBuildClaimAsset).toHaveBeenCalledTimes(1)
        expect(mockBuildClaimAsset).toHaveBeenCalledWith(
            expect.objectContaining({ inboxAddress: 'INBOX' }),
        )
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

    it('claimArc59 with amount: optimistically credits the holding after submit', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            const id = await result.current.execute({
                params: {
                    sendMode: 'claimArc59',
                    sender: { address: 'A' } as any,
                    asset: { assetId: '99', decimals: 0 } as any,
                    shouldClaimAlgo: false,
                    amount: new Decimal(250),
                },
            })
            expect(id).toBe('tx1')
        })
        expect(mockAddToAssetHolding).toHaveBeenCalledWith({
            accountAddress: 'A',
            assetId: '99',
            network: 'mainnet',
            amount: new Decimal(250),
        })
        expect(mockFetchAndPersistAssets).toHaveBeenCalledWith(
            ['99'],
            'mainnet',
        )
        expect(mockInvalidateBalances).toHaveBeenCalled()
    })

    it('claimArc59 without amount: skips the optimistic credit', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'claimArc59',
                    sender: { address: 'A' } as any,
                    asset: { assetId: '99', decimals: 0 } as any,
                    shouldClaimAlgo: false,
                },
            })
        })
        expect(mockAddToAssetHolding).not.toHaveBeenCalled()
        expect(mockFetchAndPersistAssets).not.toHaveBeenCalled()
        expect(mockInvalidateBalances).not.toHaveBeenCalled()
    })

    it('claimArc59: a failed optimistic credit does not fail the claim', async () => {
        mockAddToAssetHolding.mockRejectedValueOnce(new Error('db locked'))
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            const id = await result.current.execute({
                params: {
                    sendMode: 'claimArc59',
                    sender: { address: 'A' } as any,
                    asset: { assetId: '99', decimals: 0 } as any,
                    shouldClaimAlgo: false,
                    amount: new Decimal(250),
                },
            })
            expect(id).toBe('tx1')
        })
        expect(mockInvalidateBalances).toHaveBeenCalled()
    })

    it('rejectArc59: delegates building to ARC-59 hook + submits via pipeline', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'rejectArc59',
                    sender: { address: 'A' } as any,
                    asset: {
                        assetId: 99n,
                        decimals: 0,
                        creator: { address: 'CREATOR' },
                    } as any,
                    shouldClaimAlgo: false,
                    amount: new Decimal(250),
                    inboxAddress: 'INBOX',
                },
            })
        })
        expect(mockBuildRejectAsset).toHaveBeenCalledTimes(1)
        expect(mockBuildRejectAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                inboxAddress: 'INBOX',
                assetCreator: 'CREATOR',
            }),
        )
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                unsignedTxs: [TXN],
                source: {
                    name: 'send-transaction',
                    description: 'Send transaction',
                },
            }),
        )
        // Rejecting returns the asset to the sender — never credit holdings.
        expect(mockAddToAssetHolding).not.toHaveBeenCalled()
    })

    it('throws InvalidSendParamsError for an empty assetId string', async () => {
        const { result } = renderHook(() => useTransactionSendFlow())
        await act(async () => {
            await expect(
                result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: { address: 'A' } as any,
                        receiver: 'B',
                        asset: { assetId: '', decimals: 6 } as any,
                        amount: new Decimal(1),
                    },
                }),
            ).rejects.toBeInstanceOf(InvalidSendParamsError)
        })
        expect(mockSubmit).not.toHaveBeenCalled()
    })
})
