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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTransactionConfirmationScreen } from '../useTransactionConfirmationScreen'
import { Decimal } from 'decimal.js'
import {
    useSelectedAccount,
    useAccountAssetBalanceQuery,
    useOnChainAccountInformationQuery,
    useSignerFor,
} from '@perawallet/wallet-core-accounts'
import { useIsQuantumAccountsEnabled } from '@hooks/useIsQuantumAccountsEnabled'
import {
    useAssetsQuery,
    useAssetPricesQuery,
} from '@perawallet/wallet-core-assets'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
    // Hook returns true by default so the existing tests' assertion model
    // (initial render, no focus transition) matches an unmounted-then-mounted
    // confirmation screen — the `useEffect` that resets `isSigning` runs
    // once on first render with `isFocused === true` and is a no-op
    // (isSigning starts at `false`).
    useIsFocused: () => true,
}))

vi.mock('@react-navigation/stack', () => ({}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
    PWButton: vi.fn(),
    PWText: vi.fn(),
    PWView: vi.fn(),
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../../components/send-funds/AddNoteContent', () => ({
    AddNoteContent: () => null,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountAssetBalanceQuery: vi.fn(),
    useOnChainAccountInformationQuery: vi.fn(),
    useSignerFor: vi.fn(),
    isQuantumAccount: (account: { type?: string } | null | undefined) =>
        account?.type === 'quantum',
}))

vi.mock('@hooks/useIsQuantumAccountsEnabled', () => ({
    useIsQuantumAccountsEnabled: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useLocalKeyTransactionSigner: vi.fn(),
    useMinFeeForSender: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
    useAssetPricesQuery: vi.fn(),
    ALGO_ASSET: { id: '0', decimals: 6 },
    isCollectible: (asset: { peraMetadata?: { type?: string } }) =>
        asset?.peraMetadata?.type === 'collectible',
    toDecimalUnits: (value: number | Decimal) => {
        if (value instanceof Decimal) {
            return value
        }
        return new Decimal(value)
    },
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        new Decimal(typeof value === 'bigint' ? value.toString() : value).div(
            new Decimal(10).pow(asset.decimals),
        ),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    displayUnitsToBaseUnits: (value: Decimal, decimals: number) =>
        new Decimal(value).mul(new Decimal(10).pow(decimals)),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    ALGO_ASSET_ID: '0',
    isAlgoAssetId: (assetId: string | number | bigint) =>
        String(assetId) === '0',
    DEFAULT_PRECISION: 2,
    formatCurrency: vi.fn(() => '10.00'),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

describe('useTransactionConfirmationScreen', () => {
    const mockOnNext = vi.fn()
    const mockShowToast = vi.fn()

    const mockAccount = {
        address: 'TEST_ADDRESS',
        name: 'Test Account',
    }

    const mockSelectedAssetId = '123'

    const mockAsset = {
        id: '123',
        decimals: 6,
        name: 'Test Asset',
        unitName: 'TEST',
    }

    const mockSendFundsState = {
        selectedAssetId: undefined,
        canSelectAsset: true,
        amount: undefined,
        note: undefined,
        destination: undefined,
        onFinished: mockOnNext,
        setSelectedAssetId: vi.fn(),
        setCanSelectAsset: vi.fn(),
        setAmount: vi.fn(),
        setNote: vi.fn(),
        setDestination: vi.fn(),
        setOnFinished: vi.fn(),
        reset: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
            data: undefined,
            isPending: false,
        })
        ;(useToast as Mock).mockReturnValue({
            showToast: mockShowToast,
        })
        ;(useSelectedAccount as Mock).mockReturnValue(null)
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map(),
        })
        ;(useAssetPricesQuery as Mock).mockReturnValue({
            data: new Map(),
        })
        ;(useCurrency as Mock).mockReturnValue({
            preferredCurrency: 'USD',
        })
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: 1000n,
            isPending: false,
        })
        ;(useAccountAssetBalanceQuery as Mock).mockReturnValue({
            data: {
                amount: new Decimal(100),
            },
            isPending: false,
        })
        ;(useSendFunds as Mock).mockReturnValue(mockSendFundsState)
        ;(useSignerFor as Mock).mockReturnValue(null)
        ;(useIsQuantumAccountsEnabled as Mock).mockReturnValue(true)
    })

    describe('isReady state', () => {
        it('should return isReady as false when selectedAccount is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(null)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as false when selectedAsset is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: undefined,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as false when amount is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: undefined,
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as false when asset is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map(),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(false)
        })

        it('should return isReady as true when all required data is present', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isReady).toBe(true)
        })
    })

    describe('handleConfirm', () => {
        it('should show error toast when required data is missing', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(null)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: undefined,
                amount: undefined,
                destination: undefined,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.handleConfirm()
            })

            expect(mockShowToast).toHaveBeenCalledWith(
                {
                    title: 'errors.transaction.title',
                    body: 'errors.transaction.body',
                    type: 'error',
                },
                { notifier: undefined },
            )
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('should navigate to TransactionProcessing when data is valid', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.handleConfirm()
            })

            expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
            expect(mockShowToast).not.toHaveBeenCalled()
        })
    })

    describe('recipient MBR validation', () => {
        const setupAlgoSend = (amount: Decimal) => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: '0',
                amount,
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([
                    ['0', { id: '0', decimals: 6, unitName: 'ALGO' }],
                ]),
            })
        }

        it('flags recipient below MBR when sending insufficient ALGO to a new account', () => {
            setupAlgoSend(new Decimal('0.05'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: { amount: 0n, minBalance: 100_000n },
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isRecipientBelowMbr).toBe(true)
            expect(result.current.recipientMbrDisplay).toBe('0.1')
        })

        it('does not flag when ALGO send meets recipient MBR', () => {
            setupAlgoSend(new Decimal('0.1'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: { amount: 0n, minBalance: 100_000n },
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isRecipientBelowMbr).toBe(false)
        })

        // The ledger allows leaving a receiver at exactly 0 — a zero-amount
        // note payment to an empty account is valid.
        it('does not flag a zero-amount send that leaves an empty recipient at zero', () => {
            setupAlgoSend(new Decimal('0'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: { amount: 0n, minBalance: 100_000n },
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isRecipientBelowMbr).toBe(false)
        })

        it('confirms a zero-amount ALGO send to a funded recipient', () => {
            setupAlgoSend(new Decimal('0'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: { amount: 200_000n, minBalance: 100_000n },
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.handleConfirm()
            })

            expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
            expect(mockShowToast).not.toHaveBeenCalled()
        })

        it('does not flag when recipient already has balance above MBR', () => {
            setupAlgoSend(new Decimal('0.01'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: { amount: 200_000n, minBalance: 100_000n },
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isRecipientBelowMbr).toBe(false)
        })

        it('does not flag for non-ALGO asset sends', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal('0.0001'),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: undefined,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isRecipientBelowMbr).toBe(false)
        })

        it('reports isRecipientInfoPending while ALGO recipient query is in flight', () => {
            setupAlgoSend(new Decimal('0.05'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isRecipientInfoPending).toBe(true)
            expect(result.current.isRecipientBelowMbr).toBe(false)
        })

        it('does not flag isRecipientInfoPending for non-ALGO sends', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal('10'),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isRecipientInfoPending).toBe(false)
        })

        it('handleConfirm is a no-op while recipient info is pending', () => {
            setupAlgoSend(new Decimal('0.05'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.handleConfirm()
            })

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockShowToast).not.toHaveBeenCalled()
        })

        it('blocks confirm and shows toast when recipient is below MBR', () => {
            setupAlgoSend(new Decimal('0.05'))
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: { amount: 0n, minBalance: 100_000n },
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.handleConfirm()
            })

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.confirmation.recipient_below_mbr.title',
                    type: 'error',
                }),
                expect.anything(),
            )
        })
    })

    describe('note state', () => {
        it('opens the note sheet when openNote is called', () => {
            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.openNote()
            })

            expect(mockRequestBottomSheet).toHaveBeenCalled()
        })
    })

    describe('asset resolution', () => {
        it('should resolve asset from assets map', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.asset).toEqual(mockAsset)
        })

        it('should return null for asset when selectedAsset has no assetId', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: undefined,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.asset).toBeNull()
        })

        it('should return undefined for asset when not in assets map', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map(),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.asset).toBeUndefined()
        })
    })

    describe('isCollectible', () => {
        it('returns true when the resolved asset is a collectible', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([
                    [
                        '123',
                        {
                            ...mockAsset,
                            peraMetadata: { type: 'collectible' },
                        },
                    ],
                ]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isCollectible).toBe(true)
        })

        it('returns false for non-collectible assets', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([
                    [
                        '123',
                        {
                            ...mockAsset,
                            peraMetadata: { type: 'standard_asset' },
                        },
                    ],
                ]),
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isCollectible).toBe(false)
        })

        it('returns false when asset cannot be resolved', () => {
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: undefined,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isCollectible).toBe(false)
        })
    })

    describe('return values', () => {
        it('should return correct values from dependencies', () => {
            const mockAmount = new Decimal(15)
            const mockDestination = 'DEST_ADDRESS'
            const mockNote = 'Test note'
            const mockCurrentBalance = {
                amount: new Decimal(100),
            }

            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: mockAmount,
                destination: mockDestination,
                note: mockNote,
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 1000n,
                isPending: false,
            })
            ;(useAccountAssetBalanceQuery as Mock).mockReturnValue({
                data: mockCurrentBalance,
                isPending: false,
            })
            ;(useCurrency as Mock).mockReturnValue({
                preferredCurrency: 'EUR',
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.selectedAccount).toEqual(mockAccount)
            expect(result.current.selectedAssetId).toEqual(mockSelectedAssetId)
            expect(result.current.amount).toEqual(mockAmount)
            expect(result.current.destination).toEqual(mockDestination)
            expect(result.current.note).toEqual(mockNote)
            expect(result.current.params).toEqual({ minFee: 1000n })
            expect(result.current.paramsPending).toBe(false)
            expect(result.current.currentBalance).toEqual(mockCurrentBalance)
            expect(result.current.currentBalancePending).toBe(false)
        })
    })

    describe('PQ-aware fee display', () => {
        beforeEach(() => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal(10),
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['123', mockAsset]]),
            })
        })

        it('exposes the multiplied fee for a quantum sender', () => {
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 3000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(useMinFeeForSender).toHaveBeenCalledWith(mockAccount.address)
            expect(result.current.params).toEqual({ minFee: 3000n })
            expect(result.current.paramsPending).toBe(false)
        })

        it('exposes the base fee for a non-quantum sender (regression)', () => {
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 1000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.params).toEqual({ minFee: 1000n })
            expect(result.current.paramsPending).toBe(false)
        })

        it('returns undefined params while the resolved fee is pending', () => {
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: undefined,
                isPending: true,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.params).toBeUndefined()
            expect(result.current.paramsPending).toBe(true)
        })

        it('flags a quantum fee when the signer is a quantum account', () => {
            ;(useSignerFor as Mock).mockReturnValue({
                address: 'QUANTUM_ADDRESS',
                type: 'quantum',
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 3000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isQuantumFee).toBe(true)
            expect(result.current.params).toEqual({ minFee: 3000n })
        })

        it('does not flag a quantum fee for a standard signer', () => {
            ;(useSignerFor as Mock).mockReturnValue({
                address: 'STANDARD_ADDRESS',
                type: 'algo25',
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 1000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isQuantumFee).toBe(false)
            expect(result.current.params).toEqual({ minFee: 1000n })
        })

        it('flags a quantum fee when a standard sender is rekeyed to a quantum signer', () => {
            ;(useSignerFor as Mock).mockReturnValue({
                address: 'QUANTUM_AUTH_ADDRESS',
                type: 'quantum',
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 3000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(useSignerFor).toHaveBeenCalledWith(mockAccount.address)
            expect(result.current.isQuantumFee).toBe(true)
        })

        it('does not flag a quantum fee when the feature flag is disabled', () => {
            ;(useIsQuantumAccountsEnabled as Mock).mockReturnValue(false)
            ;(useSignerFor as Mock).mockReturnValue({
                address: 'QUANTUM_ADDRESS',
                type: 'quantum',
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 3000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isQuantumFee).toBe(false)
        })
    })
})
