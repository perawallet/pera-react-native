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

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import {
    useTransactionSendFlow,
    InvalidSendParamsError,
} from '../useTransactionSendFlow'
import { AssetFrozenError } from '../../errors'
import {
    sendFlowChainAdapters,
    toAssetInboxQuote,
    type SendFlowChainAdapter,
} from '../../chain-adapter'
import { transferChainAdapters } from '../../transfer-adapter'

const mockSubmit = vi.fn()
const mockBuildSendViaInbox = vi.fn()
const mockBuildClaimAsset = vi.fn()
const mockBuildRejectAsset = vi.fn()
const mockAccountState = vi.fn()
const mockGetSuggestedParams = vi.fn()
const mockBuildTransfer = vi.fn()
const mockBuildExpress = vi.fn()
const mockAddToAssetHolding = vi.fn()
const mockGetHoldingRestriction = vi.fn()
const mockFetchAndPersistAssets = vi.fn()
const mockInvalidateBalances = vi.fn()
const mockUseAllAccounts = vi.fn()
const mockUseFeeConfig = vi.fn()
const mockHoldingReserve = vi.fn()
const mockResolveMinFeeForSender = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSignAndSubmitGroup: () => ({ submit: mockSubmit }),
    useFeeConfig: () => mockUseFeeConfig(),
    useFetchSuggestedMinFee: () => async () =>
        BigInt((await mockGetSuggestedParams()).minFee),
    resolveMinFeeForSender: (...args: unknown[]) =>
        mockResolveMinFeeForSender(...args),
}))

// Full replacement (not importActual): the real barrels pull in
// platform-specific storage (react-native-mmkv) that can't load under
// vitest/jsdom. resolveMinFeeForSender's own rekey-chain/PQ-multiplier
// correctness is already exhaustively covered elsewhere (see
// packages/chain-algorand/src/signing/__tests__/minFeeResolver.spec.ts) —
// these tests verify only that this hook wires the resolver's inputs
// correctly and applies the override guard on its output.
// The real accounts module pulls in react-native-mmkv, which cannot load here.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    addressOn: (
        account: { chains: Record<string, { address: string } | undefined> },
        scope: { chainId: string },
    ) => account.chains[scope.chainId]?.address,
    fetchOnChainAccountState: (...args: unknown[]) => mockAccountState(...args),
    addToAssetHolding: (...args: unknown[]) => mockAddToAssetHolding(...args),
    getHoldingRestriction: (...args: unknown[]) =>
        mockGetHoldingRestriction(...args),
    useAccountBalancesInvalidator: () => ({
        invalidate: mockInvalidateBalances,
    }),
    useAllAccounts: () => mockUseAllAccounts(),
}))

const fakeSendFlowAdapter: SendFlowChainAdapter = {
    chainId: 'algorand',
    buildTransferTxs: mockBuildTransfer,
    transactionFee: vi.fn(),
    express: { buildTxs: mockBuildExpress },
    assetInbox: {
        buildSendTxs: mockBuildSendViaInbox,
        buildClaimTxs: mockBuildClaimAsset,
        buildRejectTxs: mockBuildRejectAsset,
    },
}

vi.mock('@perawallet/wallet-core-chain-shared', () => ({}))

const NATIVE_ASSET = vi.hoisted(() => ({
    assetId: '0',
    decimals: 6,
    name: 'Algo',
    unitName: 'ALGO',
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => NATIVE_ASSET,
    fetchAndPersistAssets: (...args: unknown[]) =>
        mockFetchAndPersistAssets(...args),
}))

const TXN = { sender: 'SENDER' } as unknown

const SENDER_ACCOUNT: WalletAccount = {
    id: 'A',
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: 'A', keyPairId: 'key-A' } },
}

/** Base-unit (microAlgo) inputs, shaped as the on-chain read returns them. */
const accountState = (balance: bigint, minBalance: bigint) => ({
    nativeBalanceBaseUnits: new Decimal(balance.toString()),
    reserveBalance: new Decimal(minBalance.toString()),
    holdings: [],
})

// Answers per asset, like the real `getHoldingRestriction`, so a test asserting a
// frozen asset fails if the guard asked about a different one.
const freezeHoldings = (...frozenIds: string[]) =>
    mockGetHoldingRestriction.mockImplementation(
        ({ assetId }: { assetId: string }) =>
            Promise.resolve(
                frozenIds.includes(assetId) ? 'transferBlocked' : null,
            ),
    )

describe('useTransactionSendFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        sendFlowChainAdapters.reset()
        sendFlowChainAdapters.register(fakeSendFlowAdapter)
        transferChainAdapters.reset()
        transferChainAdapters.register({
            chainId: 'algorand',
            build: vi.fn(),
            getFeeEstimate: vi.fn(),
            spendableBalance: vi.fn(),
            holdingReserve: () => mockHoldingReserve(),
        })
        mockHoldingReserve.mockReturnValue(new Decimal(100000))
        // Default: nothing frozen. The guard reads holdings on every send.
        freezeHoldings()
        mockGetSuggestedParams.mockResolvedValue({ minFee: 1000n })
        mockBuildTransfer.mockResolvedValue([TXN])
        mockBuildExpress.mockResolvedValue([TXN])
        mockSubmit.mockResolvedValue({ txIds: ['tx1'] })
        mockAccountState.mockResolvedValue(accountState(0n, 100000n))
        mockBuildSendViaInbox.mockResolvedValue([TXN])
        mockBuildClaimAsset.mockResolvedValue([TXN])
        mockBuildRejectAsset.mockResolvedValue([TXN])
        mockAddToAssetHolding.mockResolvedValue(undefined)
        mockFetchAndPersistAssets.mockResolvedValue(undefined)
        mockUseAllAccounts.mockReturnValue([])
        mockUseFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        // Default: no PQ signer — resolver returns the base fee, which must
        // never be passed on as a fee override (regression-safe default).
        mockResolveMinFeeForSender.mockReturnValue(1000n)
    })

    it('normal ALGO send: builds through the chain adapter + submits via pipeline', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            const id = await result.current.execute({
                params: {
                    sendMode: 'normal',
                    sender: SENDER_ACCOUNT,
                    receiver: 'B',
                    asset: { assetId: '0', decimals: 6 } as any,
                    amount: new Decimal(1),
                },
            })
            expect(id).toBe('tx1')
        })
        expect(mockBuildTransfer).toHaveBeenCalledWith({
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            sender: 'A',
            receiver: 'B',
            assetId: '0',
            amount: 1_000_000n,
            note: undefined,
            isCloseAccount: undefined,
            fee: undefined,
        })
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

    it('normal ASA send: passes the asset id on + submits via pipeline', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'normal',
                    sender: SENDER_ACCOUNT,
                    receiver: 'B',
                    asset: { assetId: '99', decimals: 0 } as any,
                    amount: new Decimal(1),
                },
            })
        })
        expect(mockBuildTransfer).toHaveBeenCalledWith(
            expect.objectContaining({ assetId: '99' }),
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

    it('express send: sizes the receiver funding from its account state', async () => {
        mockAccountState.mockResolvedValueOnce(accountState(0n, 100000n))
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'express',
                    sender: SENDER_ACCOUNT,
                    receiver: 'B',
                    asset: { assetId: '99', decimals: 0 } as any,
                    amount: new Decimal(1),
                },
            })
        })
        expect(mockAccountState).toHaveBeenCalledWith('B', {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const)
        // mbrAfterOptIn (200000) + receiverFee (1000) - balance (0).
        expect(mockBuildExpress).toHaveBeenCalledWith({
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            sender: 'A',
            receiver: 'B',
            assetId: 99n,
            amount: 1n,
            funding: 201000n,
            senderFee: undefined,
            receiverFee: undefined,
        })
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
        it('normal ALGO send: quantum sender gets a fee override', async () => {
            mockResolveMinFeeForSender.mockReturnValue(3000n)
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: SENDER_ACCOUNT,
                        receiver: 'B',
                        asset: { assetId: '0', decimals: 6 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            expect(mockBuildTransfer.mock.calls[0][0]).toMatchObject({
                fee: 3000n,
            })
            expect(mockResolveMinFeeForSender).toHaveBeenCalledWith(
                'algorand',
                {
                    senderAddress: 'A',
                    accounts: [],
                    suggestedMinFee: 1000n,
                    configMinTxnFee: 1000n,
                    pqMultiplier: 3n,
                },
            )
        })

        it('normal ALGO send: algo25 sender passes no fee (regression)', async () => {
            // Default beforeEach resolves 1000n === suggestedMinFee.
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: SENDER_ACCOUNT,
                        receiver: 'B',
                        asset: { assetId: '0', decimals: 6 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            expect(mockBuildTransfer.mock.calls[0][0].fee).toBeUndefined()
        })

        it('close-account send: quantum sender gets a fee override and the close flag is preserved', async () => {
            mockResolveMinFeeForSender.mockReturnValue(3000n)
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: SENDER_ACCOUNT,
                        receiver: 'B',
                        asset: { assetId: '0', decimals: 6 } as any,
                        amount: new Decimal(1),
                        isCloseAccount: true,
                    },
                })
            })
            expect(mockBuildTransfer.mock.calls[0][0]).toMatchObject({
                fee: 3000n,
                isCloseAccount: true,
            })
        })

        it('express send: quantum sender + external receiver — only the sender fee is overridden', async () => {
            mockAccountState.mockResolvedValueOnce(accountState(0n, 100000n))
            mockResolveMinFeeForSender.mockImplementation(
                (
                    _chainId: string,
                    { senderAddress }: { senderAddress: string },
                ) => (senderAddress === 'A' ? 3000n : 1000n),
            )
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'express',
                        sender: SENDER_ACCOUNT,
                        receiver: 'B',
                        asset: { assetId: '99', decimals: 0 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            // Funding reserves the receiver's (base, non-quantum) fee:
            // mbrAfterOptIn (200000) + receiverFee (1000) = 201000.
            expect(mockBuildExpress.mock.calls[0][0]).toMatchObject({
                funding: 201000n,
                senderFee: 3000n,
                receiverFee: undefined,
            })
            expect(mockResolveMinFeeForSender).toHaveBeenCalledWith(
                'algorand',
                {
                    senderAddress: 'B',
                    accounts: [],
                    suggestedMinFee: 1000n,
                    configMinTxnFee: 1000n,
                    pqMultiplier: 3n,
                },
            )
        })

        it('express send: algo25 sender + quantum receiver — only the receiver fee is overridden', async () => {
            mockAccountState.mockResolvedValueOnce(accountState(0n, 100000n))
            mockResolveMinFeeForSender.mockImplementation(
                (
                    _chainId: string,
                    { senderAddress }: { senderAddress: string },
                ) => (senderAddress === 'B' ? 3000n : 1000n),
            )
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'express',
                        sender: SENDER_ACCOUNT,
                        receiver: 'B',
                        asset: { assetId: '99', decimals: 0 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            // Funding reserves the receiver's (quantum) fee:
            // mbrAfterOptIn (200000) + receiverFee (3000) = 203000.
            expect(mockBuildExpress.mock.calls[0][0]).toMatchObject({
                funding: 203000n,
                senderFee: undefined,
                receiverFee: 3000n,
            })
        })

        it('express send: algo25 sender — everything unchanged (regression)', async () => {
            mockAccountState.mockResolvedValueOnce(accountState(0n, 100000n))
            // Default beforeEach resolves 1000n for every sender/receiver.
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'express',
                        sender: SENDER_ACCOUNT,
                        receiver: 'B',
                        asset: { assetId: '99', decimals: 0 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            expect(mockBuildExpress.mock.calls[0][0]).toMatchObject({
                funding: 201000n,
                senderFee: undefined,
                receiverFee: undefined,
            })
        })

        it('express send: MBR reservation follows the remote-config asset MBR', async () => {
            // Non-default asset MBR (200000). Receiver underfunded (balance 0),
            // base receiver fee 1000. Funding must reserve
            // mbrAfterOptIn (100000 + 200000) + receiverFee (1000) = 301000.
            mockAccountState.mockResolvedValueOnce(accountState(0n, 100000n))
            mockHoldingReserve.mockReturnValue(new Decimal(200000))
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'express',
                        sender: SENDER_ACCOUNT,
                        receiver: 'B',
                        asset: { assetId: '99', decimals: 0 } as any,
                        amount: new Decimal(1),
                    },
                })
            })
            expect(mockBuildExpress.mock.calls[0][0]).toMatchObject({
                funding: 301000n,
            })
        })
    })

    it('sendAssetInbox: delegates building to the inbox adapter + submits via pipeline', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'sendAssetInbox',
                    sender: SENDER_ACCOUNT,
                    receiver: 'B',
                    asset: { assetId: '99', decimals: 0 } as any,
                    amount: new Decimal(1),
                    assetInboxQuote: toAssetInboxQuote({ fee: 0 }),
                },
            })
        })
        expect(mockBuildSendViaInbox).toHaveBeenCalledTimes(1)
        expect(mockBuildSendViaInbox).toHaveBeenCalledWith(
            expect.objectContaining({ senderMinFee: 1000n }),
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

    it('sendAssetInbox: passes the PQ-aware sender fee to the builder', async () => {
        mockResolveMinFeeForSender.mockReturnValue(3000n)
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'sendAssetInbox',
                    sender: SENDER_ACCOUNT,
                    receiver: 'B',
                    asset: { assetId: '99', decimals: 0 } as any,
                    amount: new Decimal(1),
                    assetInboxQuote: toAssetInboxQuote({ fee: 0 }),
                },
            })
        })
        expect(mockResolveMinFeeForSender).toHaveBeenCalledWith('algorand', {
            senderAddress: 'A',
            accounts: [],
            suggestedMinFee: 1000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        expect(mockBuildSendViaInbox).toHaveBeenCalledWith(
            expect.objectContaining({ senderMinFee: 3000n }),
        )
    })

    it('claimAssetInbox: delegates building to the inbox adapter + submits via pipeline', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'claimAssetInbox',
                    sender: SENDER_ACCOUNT,
                    asset: { assetId: '99', decimals: 0 } as any,
                    shouldClaimAlgo: false,
                    inboxAddress: 'INBOX',
                },
            })
        })
        expect(mockBuildClaimAsset).toHaveBeenCalledTimes(1)
        expect(mockBuildClaimAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                inboxAddress: 'INBOX',
                senderMinFee: 1000n,
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
    })

    it('claimAssetInbox with amount: optimistically credits the holding after submit', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            const id = await result.current.execute({
                params: {
                    sendMode: 'claimAssetInbox',
                    sender: SENDER_ACCOUNT,
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
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            amount: new Decimal(250),
        })
        expect(mockFetchAndPersistAssets).toHaveBeenCalledWith(['99'], {
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        expect(mockInvalidateBalances).toHaveBeenCalled()
    })

    it('claimAssetInbox without amount: skips the optimistic credit', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'claimAssetInbox',
                    sender: SENDER_ACCOUNT,
                    asset: { assetId: '99', decimals: 0 } as any,
                    shouldClaimAlgo: false,
                },
            })
        })
        expect(mockAddToAssetHolding).not.toHaveBeenCalled()
        expect(mockFetchAndPersistAssets).not.toHaveBeenCalled()
        expect(mockInvalidateBalances).not.toHaveBeenCalled()
    })

    it('claimAssetInbox: a failed optimistic credit does not fail the claim', async () => {
        mockAddToAssetHolding.mockRejectedValueOnce(new Error('db locked'))
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            const id = await result.current.execute({
                params: {
                    sendMode: 'claimAssetInbox',
                    sender: SENDER_ACCOUNT,
                    asset: { assetId: '99', decimals: 0 } as any,
                    shouldClaimAlgo: false,
                    amount: new Decimal(250),
                },
            })
            expect(id).toBe('tx1')
        })
        expect(mockInvalidateBalances).toHaveBeenCalled()
    })

    it('rejectAssetInbox: delegates building to the inbox adapter + submits via pipeline', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await result.current.execute({
                params: {
                    sendMode: 'rejectAssetInbox',
                    sender: SENDER_ACCOUNT,
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
                senderMinFee: 1000n,
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

    describe('send-flow chain adapter', () => {
        const inboxSendParams = {
            sendMode: 'sendAssetInbox' as const,
            sender: SENDER_ACCOUNT,
            receiver: 'B',
            asset: { assetId: '99', decimals: 0 } as any,
            amount: new Decimal(1),
            assetInboxQuote: toAssetInboxQuote({ fee: 0 }),
        }
        const claimParams = {
            sendMode: 'claimAssetInbox' as const,
            sender: SENDER_ACCOUNT,
            asset: { assetId: '99', decimals: 0 } as any,
            shouldClaimAlgo: false,
        }

        it("hands the inbox send to the network's adapter with the quote untouched", async () => {
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({ params: inboxSendParams })
            })
            expect(mockBuildSendViaInbox).toHaveBeenCalledWith({
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                sender: 'A',
                receiver: 'B',
                assetId: 99n,
                amount: 1n,
                quote: inboxSendParams.assetInboxQuote,
                senderMinFee: 1000n,
            })
        })

        it('builds a normal send through the transfer adapter when the chain has no send-flow adapter', async () => {
            sendFlowChainAdapters.reset()
            const build = vi.fn().mockResolvedValue([TXN])
            transferChainAdapters.reset()
            transferChainAdapters.register({
                chainId: 'ethereum',
                build,
                getFeeEstimate: vi.fn(),
                spendableBalance: vi.fn(),
            })
            const scope = { chainId: 'ethereum', networkId: 'mainnet' } as const
            const { result } = renderHook(() => useTransactionSendFlow(scope))

            await act(async () => {
                const id = await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: {
                            ...SENDER_ACCOUNT,
                            chains: {
                                ethereum: { address: '0xA', keyPairId: 'k' },
                            },
                        },
                        receiver: '0xB',
                        asset: { assetId: 'native', decimals: 18 } as any,
                        amount: new Decimal('0.5'),
                        note: 'memo',
                        feePreset: 'fast',
                        maxFee: new Decimal('1000000'),
                    },
                })
                expect(id).toBe('tx1')
            })

            expect(build).toHaveBeenCalledWith(
                {
                    kind: 'transfer',
                    from: '0xA',
                    to: '0xB',
                    assetRef: { chainId: 'ethereum', assetId: 'native' },
                    amount: new Decimal('500000000000000000'),
                    note: 'memo',
                },
                { scope, feePreset: 'fast', maxFee: new Decimal('1000000') },
            )
            expect(mockSubmit).toHaveBeenCalledWith(
                expect.objectContaining({ scope, unsignedTxs: [TXN] }),
            )
            expect(mockBuildTransfer).not.toHaveBeenCalled()
        })

        it('sends 1,000 of an 18-decimal asset, whose base units print in exponent form', async () => {
            sendFlowChainAdapters.reset()
            const build = vi.fn().mockResolvedValue([TXN])
            transferChainAdapters.reset()
            transferChainAdapters.register({
                chainId: 'ethereum',
                build,
                getFeeEstimate: vi.fn(),
                spendableBalance: vi.fn(),
            })
            const scope = { chainId: 'ethereum', networkId: 'mainnet' } as const
            const { result } = renderHook(() => useTransactionSendFlow(scope))

            await act(async () => {
                await result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: {
                            ...SENDER_ACCOUNT,
                            chains: {
                                ethereum: { address: '0xA', keyPairId: 'k' },
                            },
                        },
                        receiver: '0xB',
                        asset: { assetId: 'native', decimals: 18 } as any,
                        amount: new Decimal('1000'),
                    },
                })
            })

            expect(build).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: new Decimal('1000000000000000000000'),
                }),
                expect.anything(),
            )
        })

        it('refuses a normal send when the chain has neither adapter', async () => {
            sendFlowChainAdapters.reset()
            transferChainAdapters.reset()
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await expect(
                    result.current.execute({
                        params: { ...inboxSendParams, sendMode: 'normal' },
                    }),
                ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
            })
            expect(mockSubmit).not.toHaveBeenCalled()
        })

        it('refuses an inbox send when no adapter is registered for the chain', async () => {
            sendFlowChainAdapters.reset()
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await expect(
                    result.current.execute({ params: inboxSendParams }),
                ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
            })
            expect(mockSubmit).not.toHaveBeenCalled()
        })

        it('refuses a claim when the chain has no asset inbox', async () => {
            sendFlowChainAdapters.reset()
            sendFlowChainAdapters.register({
                chainId: 'algorand',
                buildTransferTxs: mockBuildTransfer,
                transactionFee: vi.fn(),
            })
            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await expect(
                    result.current.execute({ params: claimParams }),
                ).rejects.toBeInstanceOf(PeraServiceUnavailableError)
            })
            expect(mockSubmit).not.toHaveBeenCalled()
        })
    })

    describe('frozen holding guard', () => {
        const baseParams = {
            sendMode: 'normal' as const,
            sender: SENDER_ACCOUNT,
            receiver: 'B',
            asset: { assetId: '99', decimals: 0 } as any,
            amount: new Decimal(1),
        }

        it('refuses to build a send for a frozen holding', async () => {
            freezeHoldings('99')

            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await expect(
                    result.current.execute({ params: baseParams }),
                ).rejects.toBeInstanceOf(AssetFrozenError)
            })
            expect(mockSubmit).not.toHaveBeenCalled()
        })

        it('builds normally when the holding is not frozen', async () => {
            freezeHoldings()

            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({ params: baseParams })
            })
            expect(mockSubmit).toHaveBeenCalled()
        })

        it('reads the sender and network itself rather than trusting the caller', async () => {
            freezeHoldings('99')

            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await expect(
                    result.current.execute({ params: baseParams }),
                ).rejects.toBeInstanceOf(AssetFrozenError)
            })
            // Only the asset being sent is queried — not the whole portfolio.
            expect(mockGetHoldingRestriction).toHaveBeenCalledWith({
                accountAddress: 'A',
                assetId: '99',
                scope: { chainId: 'algorand', networkId: expect.any(String) },
            })
        })

        it('builds when the holding has not synced yet — algod is the backstop', async () => {
            freezeHoldings()

            const { result } = renderHook(() =>
                useTransactionSendFlow({
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            )
            await act(async () => {
                await result.current.execute({ params: baseParams })
            })
            expect(mockSubmit).toHaveBeenCalled()
        })
    })

    it('throws InvalidSendParamsError for an empty assetId string', async () => {
        const { result } = renderHook(() =>
            useTransactionSendFlow({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        await act(async () => {
            await expect(
                result.current.execute({
                    params: {
                        sendMode: 'normal',
                        sender: SENDER_ACCOUNT,
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
