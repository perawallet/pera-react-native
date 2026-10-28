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

import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
    type Mock,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { chainUiFor } from '@modules/chain-ui'
import { useTransactionConfirmationScreen } from '../useTransactionConfirmationScreen'
import { NeutralSendFeeSection } from '../NeutralSendFeeSection'
import { Decimal } from 'decimal.js'
import {
    useSelectedAccount,
    useAccountAssetBalanceQuery,
    useSignerFor,
    usesNonPrimaryScheme,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    useAssetPricesQuery,
} from '@perawallet/wallet-core-assets'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import {
    sendFlowChainAdapters,
    useRecipientWarningQuery,
    useSendFeeQuery,
    useSpendableBalanceQuery,
    type ChainNotice,
} from '@perawallet/wallet-core-transactions'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    getChainDescriptor,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import { capabilityState } from '@test-utils/capability-mock'

const mockNavigate = vi.fn()
const { recipientSafety } = vi.hoisted(() => ({
    recipientSafety: {
        current: {
            assessment: undefined,
            isPending: false,
            isAcknowledged: false,
            toggleAcknowledged: () => {},
            isConfirmBlocked: false,
        } as Record<string, unknown>,
    },
}))

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

vi.mock('@modules/transactions/components/send-funds/AddNoteContent', () => ({
    AddNoteContent: () => null,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountAssetBalanceQuery: vi.fn(),
    useSignerFor: vi.fn(),
    chainAccountOf: (
        account: { chains: Record<string, unknown> },
        chainId: string,
    ) => account.chains[chainId],
    // The predicate itself is pinned in the accounts package; here a quantum
    // seed stands for a key signing with a non-primary scheme.
    usesNonPrimaryScheme: vi.fn(
        (account: { custody: { seed?: string } }) =>
            account.custody.seed === 'quantum',
    ),
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

vi.mock('@perawallet/wallet-core-signing', () => ({
    useLocalKeyTransactionSigner: vi.fn(),
    useMinFeeForSender: vi.fn(),
}))

const NATIVE_ASSET = vi.hoisted(() => ({
    id: '0',
    assetId: '0',
    decimals: 6,
    unitName: 'ALGO',
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useIsNativeAssetId: () => (id: unknown) => id != null && String(id) === '0',
    isNativeAssetId: (_chainId: string, id: string) => id === '0',
    useAssetsQuery: vi.fn(),
    useAssetPricesQuery: vi.fn(),
    useNativeAsset: () => NATIVE_ASSET,
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

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: vi.fn(),
    getChainDescriptor: vi.fn(() => ({ family: 'algorand' })),
}))

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: vi.fn(() => ({})),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const { displayUnitsToBaseUnits, displayUnitsToBaseUnitsBigInt, toBigInt } =
        await vi.importActual<
            typeof import('@packages/shared/src/utils/unit-conversion')
        >('@packages/shared/src/utils/unit-conversion')
    const { Decimal: ActualDecimal } = await import('decimal.js')
    return {
        DEFAULT_PRECISION: 2,
        ZERO_DECIMAL: new ActualDecimal(0),
        formatCurrency: vi.fn(() => '10.00'),
        formatNumber: (amount: Decimal) => amount.toFixed(),
        displayUnitsToBaseUnits,
        displayUnitsToBaseUnitsBigInt,
        toBigInt,
    }
})

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@modules/transactions/hooks', async () => {
    const { useSelectedScope } =
        await import('@perawallet/wallet-core-chain-shared')
    return {
        useSendFunds: vi.fn(),
        useSendScope: () => useSelectedScope('algorand'),
        useRecipientSafety: () => recipientSafety.current,
    }
})

// useSendFeeQuery's own branching is pinned in its spec; here it stands on the
// planner fee, as it does on Algorand.
vi.mock('@perawallet/wallet-core-transactions', async () => {
    const { useMinFeeForSender } =
        await import('@perawallet/wallet-core-signing')
    return {
        useRecipientWarningQuery: vi.fn(),
        sendFlowChainAdapters: { has: vi.fn(() => true) },
        useSpendableBalanceQuery: vi.fn(() => ({
            data: undefined,
            isPending: false,
        })),
        useSendFeeQuery: vi.fn(
            ({
                senderAddress,
                scope,
            }: {
                senderAddress?: string
                scope: { chainId: 'algorand' }
            }) => {
                const { minFee, isPending } = useMinFeeForSender(
                    senderAddress,
                    scope.chainId,
                )
                const fee =
                    minFee !== undefined
                        ? new Decimal(minFee.toString())
                        : undefined
                return {
                    feeAmount: fee,
                    maxFeeAmount: fee,
                    presets: undefined,
                    isPending,
                    isError: false,
                }
            },
        ),
    }
})

const RECIPIENT_WARNING: ChainNotice = {
    title: {
        key: i18nKey('send_funds.confirmation.recipient_below_mbr.title'),
    },
    body: [
        {
            key: i18nKey('send_funds.confirmation.recipient_below_mbr.body'),
            params: { min: '0.1' },
        },
    ],
}

describe('useTransactionConfirmationScreen', () => {
    const mockOnNext = vi.fn()
    const mockShowToast = vi.fn()

    const mockAccount = {
        id: 'test-account',
        name: 'Test Account',
        custody: { kind: 'local', seed: null },
        chains: { algorand: { address: 'TEST_ADDRESS' } },
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
        feePreset: 'normal',
        setFeePreset: vi.fn(),
        reset: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        recipientSafety.current = {
            ...recipientSafety.current,
            isConfirmBlocked: false,
        }
        ;(useSelectedScope as Mock).mockImplementation((chainId: string) => ({
            chainId,
            networkId: 'mainnet',
        }))
        ;(useRecipientWarningQuery as Mock).mockReturnValue({
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
        capabilityState.reset()
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

        it('does not confirm while the recipient check blocks it', () => {
            recipientSafety.current = {
                ...recipientSafety.current,
                isConfirmBlocked: true,
            }
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

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(result.current.recipientSafety.isConfirmBlocked).toBe(true)
        })
    })

    describe('fee coverage on a chain priced by its transfer adapter', () => {
        const ETH_FEE = {
            feeAmount: new Decimal(300),
            maxFeeAmount: new Decimal(500),
            presets: undefined,
            isPending: false,
            isError: false,
        }

        const confirmNativeSend = (amount: Decimal) => {
            ;(sendFlowChainAdapters.has as Mock).mockReturnValue(false)
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: '0',
                amount,
                destination: 'DEST_ADDRESS',
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['0', { ...NATIVE_ASSET, decimals: 0 }]]),
            })
            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )
            act(() => {
                result.current.handleConfirm()
            })
        }

        // clearAllMocks keeps a mockReturnValue, so put the planner-fee
        // default back for the suites after this one.
        const plannerFee = (useSendFeeQuery as Mock).getMockImplementation()

        beforeEach(() => {
            ;(useSendFeeQuery as Mock).mockReturnValue(ETH_FEE)
        })

        afterEach(() => {
            ;(sendFlowChainAdapters.has as Mock).mockReturnValue(true)
            ;(useSendFeeQuery as Mock).mockImplementation(plannerFee!)
            ;(useSpendableBalanceQuery as Mock).mockReturnValue({
                data: undefined,
                isPending: false,
            })
        })

        it("blocks a send whose amount plus the preset's worst-case fee exceeds the native balance", () => {
            ;(useSpendableBalanceQuery as Mock).mockReturnValue({
                data: { balance: new Decimal(1000), max: new Decimal(1000) },
                isPending: false,
            })

            confirmNativeSend(new Decimal(600))

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.confirmation.fee_shortfall.title',
                }),
                expect.anything(),
            )
        })

        it('confirms a send the native balance covers at the worst-case fee', () => {
            ;(useSpendableBalanceQuery as Mock).mockReturnValue({
                data: { balance: new Decimal(1000), max: new Decimal(1000) },
                isPending: false,
            })

            confirmNativeSend(new Decimal(500))

            expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
        })

        it('blocks a token send when the native balance cannot pay the fee', () => {
            ;(sendFlowChainAdapters.has as Mock).mockReturnValue(false)
            ;(useSpendableBalanceQuery as Mock).mockReturnValue({
                data: { balance: new Decimal(100), max: new Decimal(100) },
                isPending: false,
            })
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

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.confirmation.fee_shortfall.title',
                }),
                expect.anything(),
            )
        })

        it('blocks the send when the fee could not be estimated', () => {
            ;(useSendFeeQuery as Mock).mockReturnValue({
                ...ETH_FEE,
                maxFeeAmount: undefined,
                isError: true,
            })

            confirmNativeSend(new Decimal(1))

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.confirmation.fee_unavailable.title',
                }),
                expect.anything(),
            )
        })

        it('reads no native balance on a chain with a send-flow adapter', () => {
            renderHook(() => useTransactionConfirmationScreen())

            expect(useSpendableBalanceQuery).toHaveBeenCalledWith(undefined)
        })
    })

    describe('recipient warning', () => {
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

        const warnWith = (data: ChainNotice | undefined, isPending = false) =>
            (useRecipientWarningQuery as Mock).mockReturnValue({
                data,
                isPending,
            })

        it('asks the chain about the recipient with the amount in base units', () => {
            setupAlgoSend(new Decimal('0.05'))

            renderHook(() => useTransactionConfirmationScreen())

            expect(useRecipientWarningQuery).toHaveBeenLastCalledWith({
                recipient: 'DEST_ADDRESS',
                asset: { chainId: 'algorand', assetId: '0' },
                amount: new Decimal(50_000),
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            })
        })

        it('asks nothing until the send has a destination', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: '0',
                amount: new Decimal('1'),
            })

            renderHook(() => useTransactionConfirmationScreen())

            expect(useRecipientWarningQuery).toHaveBeenLastCalledWith(undefined)
        })

        it("surfaces the chain's warning", () => {
            setupAlgoSend(new Decimal('0.05'))
            warnWith(RECIPIENT_WARNING)

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.recipientWarning).toEqual(RECIPIENT_WARNING)
        })

        it('confirms a send the chain has no warning for', () => {
            setupAlgoSend(new Decimal('0'))

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.handleConfirm()
            })

            expect(result.current.recipientWarning).toBeUndefined()
            expect(mockNavigate).toHaveBeenCalledWith('TransactionProcessing')
            expect(mockShowToast).not.toHaveBeenCalled()
        })

        it('handleConfirm is a no-op while the recipient check is pending', () => {
            setupAlgoSend(new Decimal('0.05'))
            warnWith(undefined, true)

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            act(() => {
                result.current.handleConfirm()
            })

            expect(result.current.isRecipientInfoPending).toBe(true)
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockShowToast).not.toHaveBeenCalled()
        })

        it("blocks confirm and toasts the chain's warning", () => {
            setupAlgoSend(new Decimal('0.05'))
            warnWith(RECIPIENT_WARNING)

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
                    body: 'send_funds.confirmation.recipient_below_mbr.body',
                    type: 'error',
                }),
                expect.anything(),
            )
        })
    })

    describe("the chain's send-confirmation sections", () => {
        it("renders the sections from the send chain's family", () => {
            const FeeSection = () => null
            const TrailingSection = () => null
            ;(getChainDescriptor as Mock).mockReturnValue({ family: 'evm' })
            ;(chainUiFor as Mock).mockReturnValue({
                sendConfirmation: { FeeSection, TrailingSection },
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(chainUiFor).toHaveBeenCalledWith('evm')
            expect(result.current.FeeSection).toBe(FeeSection)
            expect(result.current.TrailingSection).toBe(TrailingSection)
            ;(getChainDescriptor as Mock).mockReturnValue({
                family: 'algorand',
            })
            ;(chainUiFor as Mock).mockReturnValue({})
        })

        it('shows the fee alone, with nothing after the balance, for a chain without sections', () => {
            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.FeeSection).toBe(NeutralSendFeeSection)
            expect(result.current.TrailingSection).toBeUndefined()
        })

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
            expect(result.current.feeAmount).toEqual(new Decimal(1000))
            expect(result.current.isFeePending).toBe(false)
            expect(result.current.currentBalance).toEqual(mockCurrentBalance)
            expect(result.current.currentBalancePending).toBe(false)
        })
    })

    describe('fee row inputs', () => {
        it("prices the fee on the send scope's chain", () => {
            ;(useSelectedScope as Mock).mockReturnValue({
                chainId: 'otherchain',
                networkId: 'mainnet',
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.scope.chainId).toBe('otherchain')
        })

        it('prices the send to its receiver at its base-unit amount and preset', () => {
            ;(useSelectedAccount as Mock).mockReturnValue(mockAccount)
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([[mockSelectedAssetId, mockAsset]]),
            })
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                selectedAssetId: mockSelectedAssetId,
                amount: new Decimal('1.5'),
                destination: 'RECEIVER',
                feePreset: 'fast',
            })

            renderHook(() => useTransactionConfirmationScreen())

            expect(useSendFeeQuery).toHaveBeenLastCalledWith({
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                senderAddress: 'TEST_ADDRESS',
                assetId: mockSelectedAssetId,
                recipient: 'RECEIVER',
                amount: new Decimal(1_500_000),
                feePreset: 'fast',
            })
        })

        it("passes the chain's fee presets through to the fee row", () => {
            const presets = {
                slow: { amount: new Decimal(1), maxAmount: new Decimal(2) },
                normal: { amount: new Decimal(3), maxAmount: new Decimal(4) },
                fast: { amount: new Decimal(5), maxAmount: new Decimal(6) },
            }
            ;(useSendFeeQuery as Mock).mockReturnValueOnce({
                feeAmount: new Decimal(3),
                maxFeeAmount: new Decimal(4),
                presets,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.feePresets).toBe(presets)
            expect(result.current.feeAmount).toEqual(new Decimal(3))
        })

        it('passes the fee preset and its setter through from the send flow', () => {
            const setFeePreset = vi.fn()
            ;(useSendFunds as Mock).mockReturnValue({
                ...mockSendFundsState,
                feePreset: 'fast',
                setFeePreset,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )
            result.current.setFeePreset('slow')

            expect(result.current.feePreset).toBe('fast')
            expect(setFeePreset).toHaveBeenCalledWith('slow')
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

            expect(useMinFeeForSender).toHaveBeenCalledWith(
                'TEST_ADDRESS',
                'algorand',
            )
            expect(result.current.feeAmount).toEqual(new Decimal(3000))
            expect(result.current.isFeePending).toBe(false)
        })

        it('exposes the base fee for a non-quantum sender (regression)', () => {
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 1000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.feeAmount).toEqual(new Decimal(1000))
            expect(result.current.isFeePending).toBe(false)
        })

        it('returns no fee while the resolved fee is pending', () => {
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: undefined,
                isPending: true,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.feeAmount).toBeUndefined()
            expect(result.current.isFeePending).toBe(true)
        })

        it('flags a quantum fee when the signer is a quantum account', () => {
            ;(useSignerFor as Mock).mockReturnValue({
                chains: { algorand: { address: 'QUANTUM_ADDRESS' } },
                custody: { kind: 'local', seed: 'quantum' },
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 3000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isQuantumFee).toBe(true)
            expect(result.current.feeAmount).toEqual(new Decimal(3000))
        })

        it('does not flag a quantum fee for a standard signer', () => {
            ;(useSignerFor as Mock).mockReturnValue({
                chains: { algorand: { address: 'STANDARD_ADDRESS' } },
                custody: { kind: 'local', seed: null },
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 1000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isQuantumFee).toBe(false)
            expect(result.current.feeAmount).toEqual(new Decimal(1000))
        })

        it('flags a quantum fee when a standard sender is rekeyed to a quantum signer', () => {
            ;(useSignerFor as Mock).mockReturnValue({
                chains: { algorand: { address: 'QUANTUM_AUTH_ADDRESS' } },
                custody: { kind: 'local', seed: 'quantum' },
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 3000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(useSignerFor).toHaveBeenCalledWith(
                'TEST_ADDRESS',
                'algorand',
            )
            expect(usesNonPrimaryScheme).toHaveBeenCalledWith(
                expect.objectContaining({
                    chains: { algorand: { address: 'QUANTUM_AUTH_ADDRESS' } },
                }),
                'algorand',
            )
            expect(result.current.isQuantumFee).toBe(true)
        })

        it('still flags the quantum fee an existing account pays after quantumAccounts is switched off', () => {
            capabilityState.turnOff('quantumAccounts')
            ;(useSignerFor as Mock).mockReturnValue({
                chains: { algorand: { address: 'QUANTUM_ADDRESS' } },
                custody: { kind: 'local', seed: 'quantum' },
            })
            ;(useMinFeeForSender as Mock).mockReturnValue({
                minFee: 3000n,
                isPending: false,
            })

            const { result } = renderHook(() =>
                useTransactionConfirmationScreen(),
            )

            expect(result.current.isQuantumFee).toBe(true)
        })
    })
})
