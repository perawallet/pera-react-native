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

import { renderHook, act } from '@test-utils/render'
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useSwapForm } from '../useSwapForm'
import type { Nullable } from '@perawallet/wallet-core-shared'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const mockSetFromAsset = vi.fn()
const mockSetToAsset = vi.fn()
const mockSetSlippage = vi.fn()
const mockResetQuoteMutation = vi.fn()
const mockCreateQuotes = vi.fn()
const mockSetIsLocalCurrencyInput = vi.fn()
const mockResetAssetPair = vi.fn()
const mockInfoToast = vi.fn()
const mockErrorToast = vi.fn()
const mockSuccessToast = vi.fn()

// Captured so a test can run the cleanup React Navigation would run on blur.
let focusEffectCleanup: Nullable<() => void> = null
let mockIsFocused = false
vi.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => () => void) => {
        focusEffectCleanup = effect()
    },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ isFocused: () => mockIsFocused }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
        showToast: vi.fn(),
    }),
}))

const {
    mockRequestBottomSheet,
    mockRegisterTabResume,
    mockClearTabResume,
    mockCompleteTabResume,
} = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
    mockRegisterTabResume: vi.fn(),
    mockClearTabResume: vi.fn(),
    mockCompleteTabResume: vi.fn(),
}))

vi.mock('@utils/tabResumeIntent', () => ({
    registerTabResumeIntent: mockRegisterTabResume,
    clearTabResumeIntent: mockClearTabResume,
    completeTabResume: mockCompleteTabResume,
}))

let mockFromAsset = '0'
let mockToAsset = '31566704'
let mockSlippage: Nullable<string> = null

vi.mock('@perawallet/wallet-core-swaps', async () => ({
    // The real selection rule, by path: the package barrel drags in stores
    // the global shared mock can't satisfy.
    peraFeeInSourceAsset: (
        await vi.importActual<
            typeof import('../../../../../../../../packages/swaps/src/utils/swapFees')
        >('../../../../../../../../packages/swaps/src/utils/swapFees')
    ).peraFeeInSourceAsset,
    pickBestByAmountOut: (
        await vi.importActual<
            typeof import('../../../../../../../../packages/swaps/src/utils/swapQuoteHelpers')
        >('../../../../../../../../packages/swaps/src/utils/swapQuoteHelpers')
    ).pickBestByAmountOut,
    useSwaps: () => ({
        fromAsset: mockFromAsset,
        toAsset: mockToAsset,
        slippage: mockSlippage,
        isLocalCurrencyInput: false,
        setFromAsset: mockSetFromAsset,
        setToAsset: mockSetToAsset,
        setSlippage: mockSetSlippage,
        setIsLocalCurrencyInput: mockSetIsLocalCurrencyInput,
        resetAssetPair: mockResetAssetPair,
    }),
    useCreateQuotesMutation: () => ({
        mutateAsync: mockCreateQuotes,
        isPending: false,
        isError: false,
        reset: mockResetQuoteMutation,
    }),
    swapAdapterFor: () => ({
        maxAmountFeeReserve: new Decimal(100_000),
        holdingReserve: () => new Decimal(100_000),
    }),
}))

const accountAt = (address: string) => ({
    chains: { algorand: { address } },
})
let mockSelectedAccount = accountAt('TESTADDRESS123')
let mockPayBalance: Nullable<Decimal> = new Decimal('5000000')
let mockIsPayBalanceFetched = true
let mockIsPayBalanceError = false
let mockUnheldAssetId: Nullable<string> = null
let mockSpendableMax: Nullable<Decimal> = new Decimal('5000000')
let mockIsSpendablePending = false
const mockUseSpendableBalanceQuery = vi.fn()
vi.mock('@perawallet/wallet-core-transactions', () => ({
    useSpendableBalanceQuery: (input: unknown) => {
        mockUseSpendableBalanceQuery(input)
        return {
            data: mockSpendableMax ? { max: mockSpendableMax } : undefined,
            isPending: mockIsSpendablePending,
        }
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    addressOn: (account: { chains: { algorand?: { address: string } } }) =>
        account.chains.algorand?.address,
    useSelectedAccount: () => mockSelectedAccount,
    useAccountAssetBalanceQuery: (_account: unknown, assetId: string) => ({
        data:
            mockPayBalance && assetId !== mockUnheldAssetId
                ? { amount: mockPayBalance }
                : null,
        isFetched: mockIsPayBalanceFetched,
        isError: mockIsPayBalanceError,
    }),
    useAccountBalancesInvalidator: () => ({
        invalidate: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: () => ({ assetId: '0', decimals: 6 }),
    useAssetsQuery: () => ({
        data: new Map([
            [
                '0',
                {
                    assetId: '0',
                    name: 'Algorand',
                    unitName: 'ALGO',
                    decimals: 6,
                },
            ],
            [
                '123',
                {
                    assetId: '123',
                    name: 'Test Asset',
                    unitName: 'TEST',
                    decimals: 2,
                },
            ],
            [
                '456',
                {
                    assetId: '456',
                    name: 'Other Asset',
                    unitName: 'OTHR',
                    decimals: 6,
                },
            ],
            [
                '31566704',
                {
                    assetId: '31566704',
                    name: 'USD Coin',
                    unitName: 'USDC',
                    decimals: 6,
                },
            ],
        ]),
        isFetched: true,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
    useNetworkStore: { getState: () => ({ network: 'mainnet' }) },
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    logEvent: vi.fn(),
    createBaseLogger: vi.fn(() => vi.fn()),
    useDeviceIdLookup: () => () => 'test-device-id',
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../SwapAssetSelectionContent', () => ({
    SwapAssetSelectionContent: () => null,
}))

vi.mock('../../SwapReceivingAccountContent', () => ({
    SwapReceivingAccountContent: () => null,
}))

const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ETH_ACCOUNT = { id: 'eth', chains: { ethereum: { address: '0xETH' } } }
type MockReceiveTarget = {
    receiveScope: { chainId: string; networkId: string }
    isCrossChain: boolean
    receivingAccount: unknown
    receivingAddress: Nullable<string>
    receivingAccounts: unknown[]
    selectReceivingAccount: () => void
}
const sameScopeTarget = (): MockReceiveTarget => ({
    receiveScope: SCOPE,
    isCrossChain: false,
    receivingAccount: mockSelectedAccount,
    receivingAddress: 'TESTADDRESS123',
    receivingAccounts: [mockSelectedAccount],
    selectReceivingAccount: vi.fn(),
})
let mockReceiveTarget: MockReceiveTarget
vi.mock('../../../hooks/useSwapReceiveTarget', () => ({
    useSwapReceiveTarget: () => mockReceiveTarget,
}))
vi.mock('@hooks/useIsCrossChainSwapEnabled', () => ({
    useIsCrossChainSwapEnabled: () => true,
}))

vi.mock('../../SwapConfigurationContent', () => ({
    SwapConfigurationContent: () => null,
}))

vi.mock('../../SwapProviderContent', () => ({
    SwapProviderContent: () => null,
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const { baseUnitsToDisplayUnits, displayUnitsToBaseUnits } =
        await vi.importActual<
            typeof import('@packages/shared/src/utils/unit-conversion')
        >('@packages/shared/src/utils/unit-conversion')
    return {
        ...(await vi.importActual<
            typeof import('@packages/shared/src/errors/base')
        >('@packages/shared/src/errors/base')),
        ALGO_ASSET_NAME: 'ALGO',
        isAlgoAssetName: (value: string) => value === 'ALGO',
        isDecimalEqual: (a: Nullable<Decimal>, b: Nullable<Decimal>) => {
            if (a === b) return true
            if (a === null || b === null) return false
            return a.equals(b)
        },
        useDebouncedValue: (value: unknown) => value,
        uint64IdToNumber: (id: string | number) => Number(id),
        baseUnitsToDisplayUnits,
        displayUnitsToBaseUnits,
    }
})

vi.mock('../../SwapConfirmationContent', () => ({
    SwapConfirmationContent: () => null,
}))

describe('useSwapForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFromAsset = '0'
        mockToAsset = '31566704'
        mockSlippage = null
        mockSelectedAccount = accountAt('TESTADDRESS123')
        mockPayBalance = new Decimal('5000000')
        mockSpendableMax = new Decimal('5000000')
        mockIsSpendablePending = false
        mockUnheldAssetId = null
        mockIsPayBalanceFetched = true
        mockIsPayBalanceError = false
        focusEffectCleanup = null
        mockIsFocused = false
        mockReceiveTarget = sameScopeTarget()
    })

    describe('receiving on another chain', () => {
        beforeEach(() => {
            mockToAsset = '0'
            mockReceiveTarget = {
                ...sameScopeTarget(),
                receiveScope: ETH_SCOPE,
                isCrossChain: true,
                receivingAccount: ETH_ACCOUNT,
                receivingAddress: '0xETH',
                receivingAccounts: [ETH_ACCOUNT],
            }
        })

        it('disables the direction swap, since the account can only pay on its own chain', () => {
            const { result } = renderHook(() => useSwapForm(SCOPE))

            act(() => result.current.handleSwapDirection())

            expect(result.current.isDirectionDisabled).toBe(true)
            expect(result.current.isChainShown).toBe(true)
            expect(mockSetFromAsset).not.toHaveBeenCalled()
        })

        it('leaves the pay picker whole, since the receive id means nothing on the pay chain', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() => useSwapForm(SCOPE))

            await act(async () => {
                await result.current.handleOpenPayAssetSelection()
            })

            const { contents } = mockRequestBottomSheet.mock.calls[0][0]
            expect(contents.props.excludeAssetId).toBeUndefined()
        })

        it('keeps the scope of a receive asset picked on another chain', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce({
                assetId: '0',
                scope: ETH_SCOPE,
            })
            const { result } = renderHook(() => useSwapForm(SCOPE))

            await act(async () => {
                await result.current.handleOpenReceiveAssetSelection()
            })

            expect(mockSetToAsset).toHaveBeenCalledWith('0', ETH_SCOPE)
        })

        it('reserves no first holding, since the receive asset locks nothing on the pay chain', () => {
            mockToAsset = '31566704'
            mockUnheldAssetId = '31566704'

            renderHook(() => useSwapForm(SCOPE))

            expect(mockUseSpendableBalanceQuery).toHaveBeenLastCalledWith(
                expect.objectContaining({ fee: new Decimal(100_000) }),
            )
        })
    })

    it('leaves the direction swap on for a pair on one chain', () => {
        const { result } = renderHook(() => useSwapForm(SCOPE))

        expect(result.current.isDirectionDisabled).toBe(false)
        expect(result.current.isChainShown).toBe(false)
    })

    it('initializes with null amounts and canSwap false', () => {
        const { result } = renderHook(() => useSwapForm(SCOPE))

        expect(result.current.payAmount).toBeNull()
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(result.current.canSwap).toBe(false)
    })

    it('returns asset IDs from swap store', () => {
        const { result } = renderHook(() => useSwapForm(SCOPE))

        expect(result.current.payAssetId).toBe('0')
        expect(result.current.receiveAssetId).toBe('31566704')
    })

    it('handlePayAmountChange updates payAmount', () => {
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(result.current.payAmount).toEqual(new Decimal(5))
    })

    it('handleSwapDirection swaps assets and amounts', () => {
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handlePayAmountChange(new Decimal(10))
        })

        act(() => {
            result.current.handleSwapDirection()
        })

        expect(mockSetFromAsset).toHaveBeenCalledWith('31566704')
        expect(mockSetToAsset).toHaveBeenCalledWith('0')
        expect(mockResetQuoteMutation).toHaveBeenCalled()
    })

    // The typed amount is denominated in the pay asset, so it cannot survive
    // the pay asset changing: quoting the old number against the new asset
    // produces a wrong quote.
    it('handleOpenPayAssetSelection resets both amounts and the quote when a new asset is picked', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            assetId: '123',
            scope: SCOPE,
        })
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        await act(async () => {
            await result.current.handleOpenPayAssetSelection()
        })

        expect(mockSetFromAsset).toHaveBeenCalledWith('123')
        expect(result.current.payAmount).toBeNull()
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(mockResetQuoteMutation).toHaveBeenCalled()
    })

    it('handleOpenPayAssetSelection no-ops when picker is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenPayAssetSelection()
        })

        expect(mockSetFromAsset).not.toHaveBeenCalled()
    })

    it('handleOpenPayAssetSelection does not re-quote the stale amount against the new asset', async () => {
        mockCreateQuotes.mockResolvedValue([])
        mockRequestBottomSheet.mockResolvedValueOnce({
            assetId: '123',
            scope: SCOPE,
        })

        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)

        mockFromAsset = '123'
        await act(async () => {
            await result.current.handleOpenPayAssetSelection()
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)
    })

    // Pair-history and top-pair taps write the pair straight into the store,
    // so the reset has to react to the store change, not just the sheet flow.
    it('clears the amounts when the pay asset changes outside the form', () => {
        const { result, rerender } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })
        expect(result.current.payAmount).toEqual(new Decimal(5))

        mockFromAsset = '123'
        rerender()

        expect(result.current.payAmount).toBeNull()
        expect(result.current.receiveAmount).toBeNull()
    })

    it('restores a resumed amount only once the store holds its pay asset', () => {
        // In a fresh tab the route's pay asset lands after mount, and that
        // change resets the amounts, so applying earlier would be wiped.
        const { result, rerender } = renderHook(() =>
            useSwapForm(SCOPE, { assetId: '123', amount: new Decimal('2.5') }),
        )
        expect(result.current.payAmount).toBeNull()

        mockFromAsset = '123'
        rerender()

        expect(result.current.payAmount).toEqual(new Decimal('2.5'))
    })

    it('applies a resumed amount once, not again on a later return to its asset', () => {
        mockFromAsset = '123'
        const { result, rerender } = renderHook(() =>
            useSwapForm(SCOPE, { assetId: '123', amount: new Decimal('2.5') }),
        )
        expect(result.current.payAmount).toEqual(new Decimal('2.5'))

        mockFromAsset = '0'
        rerender()
        mockFromAsset = '123'
        rerender()

        expect(result.current.payAmount).toBeNull()
    })

    describe('resumed from the extension popup', () => {
        const QUOTE = {
            provider: 'tinyman',
            amountOut: new Decimal('7000000'),
            assetIn: { assetId: '0', unitName: 'ALGO', decimals: 6 },
            assetOut: { assetId: '31566704', unitName: 'USDC', decimals: 6 },
        }

        beforeEach(() => {
            mockCreateQuotes.mockResolvedValue([QUOTE])
            mockRequestBottomSheet.mockResolvedValue({ kind: 'cancelled' })
        })

        it('reopens the confirmation once, on a fresh quote', async () => {
            const { result } = renderHook(() =>
                useSwapForm(SCOPE, { assetId: '0', amount: new Decimal(5) }),
            )
            await act(async () => {})

            expect(result.current.selectedQuote).not.toBeNull()
            expect(mockRequestBottomSheet).toHaveBeenCalledOnce()
        })

        it('waits for the pay balance before reopening the confirmation', async () => {
            mockIsPayBalanceFetched = false
            renderHook(() =>
                useSwapForm(SCOPE, { assetId: '0', amount: new Decimal(5) }),
            )
            await act(async () => {})

            expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        })

        it('leaves the confirmation closed once the user edits the amount', async () => {
            const { result } = renderHook(() =>
                useSwapForm(SCOPE, { assetId: '0', amount: new Decimal(5) }),
            )
            act(() => {
                result.current.handlePayAmountChange(new Decimal(3))
            })
            await act(async () => {})

            expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        })
    })

    it('handleSwapDirection carries the amounts across the pair change', async () => {
        mockCreateQuotes.mockResolvedValue([
            {
                provider: 'tinyman',
                amountOut: new Decimal('7000000'),
                assetIn: { assetId: '0', unitName: 'ALGO', decimals: 6 },
                assetOut: {
                    assetId: '31566704',
                    unitName: 'USDC',
                    decimals: 6,
                },
            },
        ])
        const { result, rerender } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })
        expect(result.current.receiveAmount).toEqual(new Decimal(7))

        act(() => {
            result.current.handleSwapDirection()
        })
        mockFromAsset = '31566704'
        mockToAsset = '0'
        rerender()

        // receiveAmount is quote-derived and repopulates asynchronously; the
        // carried pay amount is what the pair-change reset must not clobber.
        expect(result.current.payAmount).toEqual(new Decimal(7))
    })

    it('handleOpenReceiveAssetSelection triggers quote re-fetch when pay amount exists', async () => {
        mockCreateQuotes.mockResolvedValue([])
        mockRequestBottomSheet.mockResolvedValueOnce({
            assetId: '456',
            scope: SCOPE,
        })

        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(5))
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(1)

        mockToAsset = '456'
        await act(async () => {
            await result.current.handleOpenReceiveAssetSelection()
        })

        expect(mockCreateQuotes).toHaveBeenCalledTimes(2)
    })

    it('handleOpenReceiveAssetSelection clears receive amount and quote when an asset is picked', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            assetId: '456',
            scope: SCOPE,
        })
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenReceiveAssetSelection()
        })

        expect(mockSetToAsset).toHaveBeenCalledWith('456', SCOPE)
        expect(result.current.receiveAmount).toBeNull()
        expect(result.current.selectedQuote).toBeNull()
        expect(mockResetQuoteMutation).toHaveBeenCalled()
    })

    it('handleOpenReceiveAssetSelection no-ops when picker is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenReceiveAssetSelection()
        })

        expect(mockSetToAsset).not.toHaveBeenCalled()
    })

    it('fills MAX with everything spendable after the chain fee reserve', () => {
        mockSpendableMax = new Decimal('4900000')
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handleMaxPress()
        })

        expect(mockUseSpendableBalanceQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({
                fee: new Decimal(100_000),
                scope: SCOPE,
            }),
        )
        expect(result.current.payAmount).toEqual(new Decimal('4.9'))
    })

    it('fills a picked percentage of the spendable amount, rounded down to base units', async () => {
        mockSpendableMax = new Decimal('4900001')
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: null,
            balancePercentage: 50,
            useLocalCurrency: false,
        })
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(result.current.payAmount).toEqual(new Decimal('2.45'))
    })

    it('tells the user instead of filling 0 when the fee reserve takes the whole balance', () => {
        mockSpendableMax = new Decimal(0)
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handleMaxPress()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockInfoToast).toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('reserves the first holding of a receive asset the account does not hold', () => {
        mockUnheldAssetId = '31566704'

        renderHook(() => useSwapForm(SCOPE))

        expect(mockUseSpendableBalanceQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ fee: new Decimal(200_000) }),
        )
    })

    describe('a Pera fee charged in the pay asset', () => {
        const SOURCE_ASSET = { chainId: 'algorand', assetId: '0' }
        const quoteFor = (
            { sourceAmount }: { sourceAmount: Decimal },
            feeAsset = SOURCE_ASSET,
        ) => ({
            provider: 'tinyman',
            amountOut: new Decimal('7000000'),
            assetIn: { assetId: '0', unitName: 'ALGO', decimals: 6 },
            assetOut: { assetId: '31566704', unitName: 'USDC', decimals: 6 },
            request: { sourceAsset: SOURCE_ASSET, sourceAmount },
            fees: [
                {
                    kind: 'pera',
                    asset: feeAsset,
                    amount: sourceAmount.mul('0.003').floor(),
                },
            ],
        })

        beforeEach(() => {
            mockSpendableMax = new Decimal('1000000')
            mockCreateQuotes.mockImplementation(
                async (request: { sourceAmount: Decimal }) => [
                    quoteFor(request),
                ],
            )
        })

        afterEach(() => {
            mockCreateQuotes.mockResolvedValue([])
        })

        it('takes the fee off MAX once and re-quotes the smaller amount', async () => {
            const { result } = renderHook(() => useSwapForm(SCOPE))

            await act(async () => {
                result.current.handleMaxPress()
            })

            expect(result.current.payAmount).toEqual(new Decimal('0.997'))
            expect(mockCreateQuotes).toHaveBeenCalledTimes(2)
            expect(mockCreateQuotes.mock.calls[1][0].sourceAmount).toEqual(
                new Decimal('997000'),
            )
        })

        it('leaves a percentage with room for the fee alone', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce({
                slippageTolerance: null,
                balancePercentage: 50,
                useLocalCurrency: false,
            })
            const { result } = renderHook(() => useSwapForm(SCOPE))

            await act(async () => {
                await result.current.handleOpenConfig()
            })

            expect(result.current.payAmount).toEqual(new Decimal('0.5'))
            expect(mockCreateQuotes).toHaveBeenCalledOnce()
        })

        it('leaves a typed amount as typed', async () => {
            const { result } = renderHook(() => useSwapForm(SCOPE))

            await act(async () => {
                result.current.handlePayAmountChange(new Decimal(1))
            })

            expect(result.current.payAmount).toEqual(new Decimal(1))
        })

        it('ignores a fee charged in another asset', async () => {
            mockCreateQuotes.mockImplementation(
                async (request: { sourceAmount: Decimal }) => [
                    quoteFor(request, {
                        chainId: 'algorand',
                        assetId: '31566704',
                    }),
                ],
            )
            const { result } = renderHook(() => useSwapForm(SCOPE))

            await act(async () => {
                result.current.handleMaxPress()
            })

            expect(result.current.payAmount).toEqual(new Decimal(1))
        })

        it('clears the amount and says why when the fee takes all of it', async () => {
            mockCreateQuotes.mockImplementation(
                async (request: { sourceAmount: Decimal }) => [
                    {
                        ...quoteFor(request),
                        fees: [
                            {
                                kind: 'pera',
                                asset: SOURCE_ASSET,
                                amount: request.sourceAmount,
                            },
                        ],
                    },
                ],
            )
            const { result } = renderHook(() => useSwapForm(SCOPE))

            await act(async () => {
                result.current.handleMaxPress()
            })

            expect(result.current.payAmount).toBeNull()
            expect(mockInfoToast).toHaveBeenCalled()
        })
    })

    it('clears the amounts and the asset pair when the selected account changes', async () => {
        const { result, rerender } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            result.current.handleMaxPress()
        })
        expect(result.current.payAmount).not.toBeNull()

        mockSelectedAccount = accountAt('OTHERADDRESS456')
        rerender()

        expect(result.current.payAmount).toBeNull()
        expect(result.current.receiveAmount).toBeNull()
        expect(mockResetAssetPair).toHaveBeenCalledTimes(1)
    })

    it('clears the form when the screen loses focus', async () => {
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handlePayAmountChange(new Decimal(5))
        })
        expect(result.current.payAmount).toEqual(new Decimal(5))

        act(() => {
            focusEffectCleanup?.()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockResetAssetPair).toHaveBeenCalled()
    })

    it('keeps the pair when the form unmounts while its screen stays focused', () => {
        mockIsFocused = true
        renderHook(() => useSwapForm(SCOPE))

        act(() => {
            focusEffectCleanup?.()
        })

        expect(mockResetAssetPair).not.toHaveBeenCalled()
    })

    it('tells the user why MAX produced nothing when the account holds no pay asset', async () => {
        mockPayBalance = null
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handleMaxPress()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockInfoToast).toHaveBeenCalled()
    })

    it('surfaces an error toast when the spendable amount is not known yet', () => {
        mockSpendableMax = null
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handleMaxPress()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('refuses MAX while the spendable amount still answers the previous pay asset', () => {
        mockIsSpendablePending = true
        const { result } = renderHook(() => useSwapForm(SCOPE))

        act(() => {
            result.current.handleMaxPress()
        })

        expect(result.current.payAmount).toBeNull()
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('handleOpenConfig applies slippage when the config sheet returns a result', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: '1.5',
            balancePercentage: null,
            useLocalCurrency: false,
        })
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetSlippage).toHaveBeenCalledWith('1.5')
    })

    it('handleOpenConfig clears slippage when slippageTolerance is null', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: null,
            balancePercentage: null,
            useLocalCurrency: false,
        })
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetSlippage).toHaveBeenCalledWith(null)
    })

    it('handleOpenConfig enables the swap-scoped local currency input when the toggle is on', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: null,
            balancePercentage: null,
            useLocalCurrency: true,
        })
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetIsLocalCurrencyInput).toHaveBeenCalledWith(true)
    })

    it('handleOpenConfig disables the swap-scoped local currency input when the toggle is off', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce({
            slippageTolerance: null,
            balancePercentage: null,
            useLocalCurrency: false,
        })
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetIsLocalCurrencyInput).toHaveBeenCalledWith(false)
    })

    it('handleOpenConfig no-ops when the config sheet is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenConfig()
        })

        expect(mockSetSlippage).not.toHaveBeenCalled()
        expect(mockSetIsLocalCurrencyInput).not.toHaveBeenCalled()
    })

    it('sends the stored slippage to the router as a percent', async () => {
        mockSlippage = '1'
        mockCreateQuotes.mockResolvedValueOnce([])

        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(2))
        })

        expect(mockCreateQuotes).toHaveBeenCalledWith(
            expect.objectContaining({ slippage: '1' }),
        )
    })

    it('leaves slippage to the router when none is set', async () => {
        mockSlippage = null
        mockCreateQuotes.mockResolvedValueOnce([])

        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            result.current.handlePayAmountChange(new Decimal(2))
        })

        expect(mockCreateQuotes).toHaveBeenCalledWith(
            expect.objectContaining({ slippage: null }),
        )
    })

    it('handleOpenConfirm is a no-op when there is no selected quote', async () => {
        const { result } = renderHook(() => useSwapForm(SCOPE))

        await act(async () => {
            await result.current.handleOpenConfirm()
        })

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    describe('handleOpenConfirm error toast', () => {
        const selectAQuote = async (amount = new Decimal(5)) => {
            mockCreateQuotes.mockResolvedValue([
                {
                    provider: 'tinyman',
                    amountOut: new Decimal('7000000'),
                    assetIn: { assetId: '0', unitName: 'ALGO', decimals: 6 },
                    assetOut: {
                        assetId: '31566704',
                        unitName: 'USDC',
                        decimals: 6,
                    },
                },
            ])
            const { result } = renderHook(() => useSwapForm(SCOPE))
            await act(async () => {
                result.current.handlePayAmountChange(amount)
            })
            return result
        }

        // F1: submission-phase failures resolve a title (e.g. the honest
        // unknown-outcome headline) that must win over the hardcoded
        // "Swap Failed" default.
        it('uses the resolved title when the confirmation result carries one', async () => {
            const result = await selectAQuote()
            mockRequestBottomSheet.mockResolvedValueOnce({
                kind: 'error',
                message: 'body text',
                title: 'resolved.title',
            })

            await act(async () => {
                await result.current.handleOpenConfirm()
            })

            expect(mockErrorToast).toHaveBeenCalledWith(
                'resolved.title',
                'body text',
            )
        })

        it('says a cross-chain swap is on its way rather than complete', async () => {
            mockCreateQuotes.mockResolvedValue([
                {
                    provider: 'xo',
                    routeKind: 'cross-chain',
                    amountOut: new Decimal('7000000'),
                    assetIn: { assetId: '0', unitName: 'ALGO', decimals: 6 },
                    assetOut: { assetId: '0', unitName: 'ETH', decimals: 18 },
                },
            ])
            const { result } = renderHook(() => useSwapForm(SCOPE))
            await act(async () => {
                result.current.handlePayAmountChange(new Decimal(5))
            })
            mockRequestBottomSheet.mockResolvedValueOnce({ kind: 'success' })

            await act(async () => {
                await result.current.handleOpenConfirm()
            })

            expect(mockSuccessToast).toHaveBeenCalledWith(
                'swap.tracking.started',
                'swap.tracking.in_progress',
            )
        })

        it('registers the swap to resume in a tab only while the confirm sheet is open', async () => {
            const result = await selectAQuote()
            mockRequestBottomSheet.mockImplementationOnce(async () => {
                expect(mockRegisterTabResume).toHaveBeenCalledWith({
                    flow: 'swap',
                    chainId: 'algorand',
                    accountAddress: 'TESTADDRESS123',
                    assetInId: '0',
                    assetOutId: '31566704',
                    payAmount: '5',
                })
                expect(mockClearTabResume).not.toHaveBeenCalled()
                return { kind: 'cancelled' }
            })

            await act(async () => {
                await result.current.handleOpenConfirm()
            })

            expect(mockClearTabResume).toHaveBeenCalledOnce()
        })

        it('hands the tab the pay amount in plain notation, never exponent form', async () => {
            const result = await selectAQuote(new Decimal('0.0000001'))
            mockRequestBottomSheet.mockResolvedValueOnce({ kind: 'cancelled' })

            await act(async () => {
                await result.current.handleOpenConfirm()
            })

            expect(mockRegisterTabResume).toHaveBeenCalledWith(
                expect.objectContaining({ payAmount: '0.0000001' }),
            )
        })

        it('hands a successful swap back to the popup with its toast copy', async () => {
            const result = await selectAQuote()
            mockRequestBottomSheet.mockResolvedValueOnce({ kind: 'success' })

            await act(async () => {
                await result.current.handleOpenConfirm()
            })

            expect(mockCompleteTabResume).toHaveBeenCalledWith({
                title: 'swap.execution.success_title',
                body: 'swap.execution.success_body',
            })
        })

        it('does not hand back a swap that failed', async () => {
            const result = await selectAQuote()
            mockRequestBottomSheet.mockResolvedValueOnce({
                kind: 'error',
                message: 'body text',
            })

            await act(async () => {
                await result.current.handleOpenConfirm()
            })

            expect(mockCompleteTabResume).not.toHaveBeenCalled()
        })

        it('falls back to the default title when the confirmation result carries none', async () => {
            const result = await selectAQuote()
            mockRequestBottomSheet.mockResolvedValueOnce({
                kind: 'error',
                message: 'body text',
            })

            await act(async () => {
                await result.current.handleOpenConfirm()
            })

            expect(mockErrorToast).toHaveBeenCalledWith(
                'swap.execution.error_title',
                'body text',
            )
        })
    })

    describe('insufficient balance', () => {
        it('flags an amount larger than the holding and blocks the swap', () => {
            mockPayBalance = new Decimal(50)
            const { result } = renderHook(() => useSwapForm(SCOPE))

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1000))
            })

            expect(result.current.hasInsufficientBalance).toBe(true)
            expect(result.current.canSwap).toBe(false)
        })

        it('allows an amount within the holding', () => {
            mockPayBalance = new Decimal(50)
            const { result } = renderHook(() => useSwapForm(SCOPE))

            act(() => {
                result.current.handlePayAmountChange(new Decimal(50))
            })

            expect(result.current.hasInsufficientBalance).toBe(false)
        })

        // The reported case: swapping an asset the account does not hold at all,
        // where the balance query settles with no holding row.
        it('treats a settled query with no holding as a zero balance', () => {
            mockPayBalance = null
            const { result } = renderHook(() => useSwapForm(SCOPE))

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1))
            })

            expect(result.current.hasInsufficientBalance).toBe(true)
        })

        it('stays quiet until the balance query has settled', () => {
            mockPayBalance = null
            mockIsPayBalanceFetched = false
            const { result } = renderHook(() => useSwapForm(SCOPE))

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1))
            })

            expect(result.current.hasInsufficientBalance).toBe(false)
        })

        // `isFetched` is true after a failed fetch too, so without an explicit
        // error check a dropped balance request reads as a zero holding and
        // blocks the swap behind copy blaming the user's balance.
        it('stays quiet when the balance query settled with an error', () => {
            mockPayBalance = null
            mockIsPayBalanceFetched = true
            mockIsPayBalanceError = true
            const { result } = renderHook(() => useSwapForm(SCOPE))

            act(() => {
                result.current.handlePayAmountChange(new Decimal(1))
            })

            expect(result.current.hasInsufficientBalance).toBe(false)
        })
    })
})
