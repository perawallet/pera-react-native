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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { Linking, Platform } from 'react-native'
import type {
    RampPair,
    MeldQuote,
    XoQuote,
    RampOrder,
} from '@perawallet/wallet-core-onramp'
import { useOnrampForm } from '../useOnrampForm'
import { OnrampTermsContent } from '../../OnrampTermsContent'

// --- mock fns -------------------------------------------------------------

const mockCreateQuote = vi.fn()
const mockCreateOrder = vi.fn()
const mockEnsureOptIn = vi.fn()
const mockSetSenderAddress = vi.fn()
const mockSetSelectedSourceTokenId = vi.fn()
const mockSetSelectedDestinationTokenId = vi.fn()
const mockErrorToast = vi.fn()
const mockSuccessToast = vi.fn()
const mockOpenURL = vi.fn()
const mockMarkTermsAccepted = vi.fn()

let mockIsTermsAccepted = true

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

let mockSelectedAccountAddress: string | null = 'ACCOUNT_ADDRESS'
let mockSenderAddress = 'SENDER_ADDRESS'

// --- mocks ----------------------------------------------------------------

vi.mock('@perawallet/wallet-core-onramp', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-onramp')
    >('@perawallet/wallet-core-onramp')
    return {
        ...actual,
        useCreateRampQuoteMutation: () => ({ mutateAsync: mockCreateQuote }),
        useCreateRampOrderMutation: () => ({ mutateAsync: mockCreateOrder }),
        useEnsureDestinationOptIn: () => ({ ensureOptIn: mockEnsureOptIn }),
        useOnramp: () => ({
            senderAddress: mockSenderAddress,
            setSenderAddress: mockSetSenderAddress,
            setSelectedSourceTokenId: mockSetSelectedSourceTokenId,
            setSelectedDestinationTokenId: mockSetSelectedDestinationTokenId,
        }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: mockSelectedAccountAddress,
    }),
    useAccountsStore: {
        getState: () => ({
            selectedAccountAddress: mockSelectedAccountAddress,
        }),
    },
}))

// The order-review sheet (imported transitively by the form hook) pulls in
// AddressDisplay → AccountIcon → the full accounts module, which this hook
// test does not stub. The hook only references the sheet as an opaque
// component, so stub it out.
vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: () => null,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane, so
    // this stub can never route a consumer past a `=== null` guard.
    getKnownAssetId: (_key: string, network: string) =>
        ({ mainnet: '31566704', testnet: '10458941' })[network] ?? null,
    // Imported at module scope by OptInConfirmationContent (rendered via the
    // confirm-opt-in sheet the form hook now requests).
    ALGO_ASSET: { assetId: '0', unitName: 'ALGO', decimals: 6 },
    toWholeUnits: (value: number) => value,
    useAssetsQuery: () => ({ data: undefined }),
    // Imported at module scope by buildAccountBalanceFromRampToken, reached via
    // the destination pair-selection sheet's OnrampAssetItemView.
    PeraAssetVerificationTier: {
        verified: 'verified',
        suspicious: 'suspicious',
        unverified: 'unverified',
    },
    DEFAULT_ASSET_METADATA: {
        isDeleted: false,
        verificationTier: 'unverified',
        isFavorited: false,
        isPriceAlertEnabled: false,
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        successToast: mockSuccessToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

// Shadow the webview barrel so its transitive `AccountTypes` import (via
// usePeraWebviewInterface) doesn't load against the partial accounts mock.
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn(), removeWebView: vi.fn() }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../useOnrampTerms', () => ({
    useOnrampTerms: () => ({
        isTermsAccepted: mockIsTermsAccepted,
        markTermsAccepted: mockMarkTermsAccepted,
    }),
}))

// --- fixtures -------------------------------------------------------------

const meldPair: RampPair = {
    id: 'pair-meld',
    sourceToken: {
        id: 'USD',
        symbol: 'USD',
        name: 'US Dollar',
        fractionDecimals: 2,
        logo: null,
        network: { id: 'fiat', name: 'Fiat', logo: null },
        priceInUsd: null,
    },
    destinationToken: {
        id: 'ALGO',
        symbol: 'ALGO',
        name: 'Algorand',
        fractionDecimals: 6,
        logo: null,
        network: { id: 'algorand', name: 'Algorand', logo: null },
        priceInUsd: null,
    },
    provider: { id: 'meld', paymentTypes: ['CARD'], limits: null },
}

const usdcMeldPair: RampPair = {
    ...meldPair,
    id: 'pair-meld-usdc',
    destinationToken: {
        id: 'USDC_ALGORAND',
        symbol: 'USDC',
        name: 'USD Coin',
        fractionDecimals: 6,
        logo: null,
        network: { id: 'algorand', name: 'Algorand', logo: null },
        priceInUsd: null,
    },
}

const xoPair: RampPair = {
    ...meldPair,
    id: 'pair-xo',
    provider: {
        id: 'xo',
        paymentTypes: ['CARD'],
        limits: null,
    },
}

const makeMeldQuote = (
    overrides: Partial<MeldQuote> & { quoteId: string },
): MeldQuote => ({
    kind: 'meld',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(500),
    sourceCurrencyCode: 'USD',
    destinationCurrencyCode: 'ALGO',
    totalFee: new Decimal(1),
    networkFee: null,
    transactionFee: new Decimal(1),
    exchangeRate: new Decimal(5),
    paymentMethodType: 'CARD',
    serviceProvider: 'STRIPE',
    institutionName: null,
    lowKyc: false,
    ...overrides,
})

const makeXoQuote = (
    overrides: Partial<XoQuote> & { quoteId: string },
): XoQuote => ({
    kind: 'xo',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    amount: { assetId: 'ALGO', value: new Decimal(5) },
    min: { assetId: 'USD', value: new Decimal(10) },
    max: { assetId: 'USD', value: new Decimal(5000) },
    minerFee: { assetId: 'ALGO', value: new Decimal(1) },
    expiry: Date.now() + 60_000,
    pairId: 'pair-xo',
    providerQuoteId: 'provider-quote-1',
    ...overrides,
})

const meldOrder: RampOrder = {
    kind: 'meld',
    swapOrderId: 'order-1',
    widgetUrl: 'https://meld.widget/checkout',
}

const xoOrder: RampOrder = {
    kind: 'xo',
    swapOrderId: 'order-2',
    payInAddress: 'PAY_IN',
    sourceAmount: new Decimal(100),
    toAddress: 'ACCOUNT_ADDRESS',
    status: 'pending',
}

// Real /v1/ramp/quotes/ 400 body; the single-quoted JSON leaf in
// non_field_errors[0] carries the provider limits.
const buildBelowMinQuoteError = (leaf: string) => ({
    type: 'SourceAmountIsTooLow',
    fallback_message: 'Amount is too low.',
    detail: { non_field_errors: [leaf] },
})

const belowMinQuoteError = buildBelowMinQuoteError(
    "{'message': 'Source amount is below the minimum allowed, which is 600.00.', 'min_amount': '600.00', 'max_amount': '5000.00'}",
)

describe('useOnrampForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.spyOn(Linking, 'openURL').mockImplementation(mockOpenURL)
        mockSelectedAccountAddress = 'ACCOUNT_ADDRESS'
        mockSenderAddress = 'SENDER_ADDRESS'
        mockIsTermsAccepted = true
        Platform.OS = 'ios'
        mockCreateQuote.mockResolvedValue([])
        mockCreateOrder.mockResolvedValue(meldOrder)
        mockEnsureOptIn.mockResolvedValue(true)
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
    })

    it('fetches Meld quotes only after the debounce elapses', async () => {
        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })

        // Before the debounce window the quote endpoint has not been called.
        expect(mockCreateQuote).not.toHaveBeenCalled()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
        expect(mockCreateQuote).toHaveBeenCalledWith(
            expect.objectContaining({
                pair: 'pair-meld',
                sourceAmount: 100,
            }),
        )
    })

    it('applies only the latest quote result when amount changes rapidly (stale guard)', async () => {
        const staleQuote = makeMeldQuote({
            quoteId: 'stale',
            destinationAmount: new Decimal(1),
        })
        const freshQuote = makeMeldQuote({
            quoteId: 'fresh',
            destinationAmount: new Decimal(999),
        })

        // First call resolves slowly, second call resolves fast — the fresh
        // one wins regardless of resolution order.
        let resolveStale: (v: MeldQuote[]) => void = () => {}
        mockCreateQuote
            .mockImplementationOnce(
                () =>
                    new Promise<MeldQuote[]>(resolve => {
                        resolveStale = resolve
                    }),
            )
            .mockImplementationOnce(() => Promise.resolve([freshQuote]))

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        act(() => {
            result.current.setSourceAmount('200')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        // Now the stale (first) request resolves late.
        await act(async () => {
            resolveStale([staleQuote])
            await Promise.resolve()
        })

        expect(result.current.selectedQuote?.quoteId).toBe('fresh')
    })

    it('filters out quotes with an excluded payment method on Android', async () => {
        Platform.OS = 'android'
        const applePay = makeMeldQuote({
            quoteId: 'apple',
            paymentMethod: { id: 'APPLE_PAY', logo: null, name: 'Apple Pay' },
        })
        const card = makeMeldQuote({
            quoteId: 'card',
            paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
        })
        mockCreateQuote.mockResolvedValue([applePay, card])

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        const ids = result.current.quotes.map(q => q.quoteId)
        expect(ids).toContain('card')
        expect(ids).not.toContain('apple')
    })

    it('auto-selects the quote with the highest destination amount', async () => {
        const low = makeMeldQuote({
            quoteId: 'low',
            destinationAmount: new Decimal(100),
        })
        const high = makeMeldQuote({
            quoteId: 'high',
            destinationAmount: new Decimal(500),
        })
        mockCreateQuote.mockResolvedValue([low, high])

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.selectedQuote?.quoteId).toBe('high')
    })

    it('allows manual quote override via selectQuote', async () => {
        const low = makeMeldQuote({
            quoteId: 'low',
            destinationAmount: new Decimal(100),
        })
        const high = makeMeldQuote({
            quoteId: 'high',
            destinationAmount: new Decimal(500),
        })
        mockCreateQuote.mockResolvedValue([low, high])

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        act(() => {
            result.current.selectQuote('low')
        })

        expect(result.current.selectedQuote?.quoteId).toBe('low')
    })

    it('selectPaymentMethod selects the best quote for that payment method', async () => {
        const cardLow = makeMeldQuote({
            quoteId: 'card-low',
            destinationAmount: new Decimal(400),
            paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
        })
        const cardHigh = makeMeldQuote({
            quoteId: 'card-high',
            destinationAmount: new Decimal(600),
            paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
        })
        const applePay = makeMeldQuote({
            quoteId: 'apple',
            destinationAmount: new Decimal(999),
            paymentMethod: { id: 'APPLE_PAY', logo: null, name: 'Apple Pay' },
        })
        mockCreateQuote.mockResolvedValue([cardLow, cardHigh, applePay])

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        // Best overall is Apple Pay; selecting CARD must pick the best CARD quote.
        expect(result.current.selectedQuote?.quoteId).toBe('apple')

        act(() => {
            result.current.selectPaymentMethod('CARD')
        })

        expect(result.current.selectedQuote?.quoteId).toBe('card-high')
        expect(result.current.selectedPaymentMethodId).toBe('CARD')
    })

    it('exposes a payment-method sheet handler', () => {
        const { result } = renderHook(() => useOnrampForm(meldPair))

        expect(typeof result.current.handleOpenPaymentMethod).toBe('function')
    })

    it('sets an error message when the amount is below the XO minimum', async () => {
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])

        const { result } = renderHook(() => useOnrampForm(xoPair))

        // XO fetches on pair mount with source_amount null.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        act(() => {
            result.current.setSourceAmount('5') // below min of 10
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.limits?.min?.toString()).toBe('10')
        expect(result.current.errorMessage).toBeTruthy()
    })

    it('exposes Meld limits and the below-min copy when the seeded quote fails', async () => {
        mockCreateQuote.mockRejectedValue(belowMinQuoteError)

        const { result } = renderHook(() => useOnrampForm(meldPair))

        // Meld pairs seed the amount to '100' on mount, so the failing quote
        // fires without any typing.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.errorMessage).toBe('onramp.form.amount_below_min')
        expect(result.current.limits?.min?.toString()).toBe('600')
        expect(result.current.limits?.max?.toString()).toBe('5000')
    })

    it('re-quotes at the minimum and clears the error after a MIN tap', async () => {
        mockCreateQuote.mockRejectedValueOnce(belowMinQuoteError)

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        expect(result.current.errorMessage).toBe('onramp.form.amount_below_min')

        mockCreateQuote.mockResolvedValue([
            makeMeldQuote({
                quoteId: 'm-min',
                sourceAmount: new Decimal(600),
            }),
        ])

        // The pill calls onSetSourceAmount with limits.min.toString().
        const min = result.current.limits?.min?.toString() ?? ''
        act(() => {
            result.current.setSourceAmount(min)
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).toHaveBeenLastCalledWith(
            expect.objectContaining({ sourceAmount: 600 }),
        )
        expect(result.current.errorMessage).toBeNull()
        // Limits stay sticky after success so the pill remains available.
        expect(result.current.limits?.min?.toString()).toBe('600')
    })

    it('exposes a min-only limit with a null max', async () => {
        mockCreateQuote.mockRejectedValue(
            buildBelowMinQuoteError(
                "{'message': 'Too low.', 'min_amount': '600.00'}",
            ),
        )

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.limits?.min?.toString()).toBe('600')
        expect(result.current.limits?.max).toBeNull()
    })

    it('falls back to the flattened message when the limits are unparseable', async () => {
        // The apostrophe corrupts the single-quote normalisation.
        mockCreateQuote.mockRejectedValue(
            buildBelowMinQuoteError("{'message': 'isn't parseable'}"),
        )

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.limits).toBeNull()
        expect(result.current.errorMessage).toBe('Amount is too low.')
    })

    it('clears Meld limits when the pair changes', async () => {
        mockCreateQuote.mockRejectedValue(belowMinQuoteError)

        const { result, rerender } = renderHook(
            ({ pair }: { pair: RampPair }) => useOnrampForm(pair),
            { initialProps: { pair: meldPair } },
        )
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        expect(result.current.limits?.min?.toString()).toBe('600')

        rerender({ pair: xoPair })

        expect(result.current.limits).toBeNull()
    })

    it('calls ensureOptIn BEFORE createRampOrder on confirm', async () => {
        const callOrder: string[] = []
        mockEnsureOptIn.mockImplementation(async () => {
            callOrder.push('ensureOptIn')
            return true
        })
        mockCreateOrder.mockImplementation(async () => {
            callOrder.push('createOrder')
            return meldOrder
        })
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(callOrder).toEqual(['ensureOptIn', 'createOrder'])
    })

    it('does not create the order (and shows no error) when the opt-in confirmation is declined', async () => {
        mockEnsureOptIn.mockResolvedValue(false)
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockCreateOrder).not.toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(result.current.isConfirming).toBe(false)
    })

    it('does not create an order and shows a toast when ensureOptIn rejects', async () => {
        mockEnsureOptIn.mockRejectedValue(new Error('attestation required'))
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockCreateOrder).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('passes the ASA id as destinationAssetId for a USDC pair', async () => {
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])

        const { result } = renderHook(() => useOnrampForm(usdcMeldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockEnsureOptIn).toHaveBeenCalledWith(
            expect.objectContaining({ address: 'ACCOUNT_ADDRESS' }),
        )
        const arg = mockEnsureOptIn.mock.calls[0]![0] as {
            destinationAssetId: unknown
        }
        expect(arg.destinationAssetId).not.toBe('ALGO')
    })

    it('opens the Meld widget in the OS browser when the order is a Meld order', async () => {
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])
        mockCreateOrder.mockResolvedValue(meldOrder)

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockOpenURL).toHaveBeenCalledWith('https://meld.widget/checkout')
    })

    it('defaults the source amount to 100 for a Meld pair', () => {
        const { result } = renderHook(() => useOnrampForm(meldPair))

        expect(result.current.sourceAmount).toBe('100')
    })

    it('leaves the source amount empty for an XO pair', () => {
        const { result } = renderHook(() => useOnrampForm(xoPair))

        expect(result.current.sourceAmount).toBe('')
    })

    it('opens the review sheet when the order is an XO order', async () => {
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])
        mockCreateOrder.mockResolvedValue(xoOrder)

        const { result } = renderHook(() => useOnrampForm(xoPair))

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        mockRequestBottomSheet.mockClear()

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockCreateOrder).toHaveBeenCalled()
        expect(mockRequestBottomSheet).toHaveBeenCalled()
        expect(mockOpenURL).not.toHaveBeenCalled()
    })

    it('sends a null source address for an XO order with no sender address', async () => {
        // Sender address is optional for XO; an empty value must become null,
        // not '' (the backend rejects an empty string as a missing field).
        mockSenderAddress = ''
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])
        mockCreateOrder.mockResolvedValue(xoOrder)

        const { result } = renderHook(() => useOnrampForm(xoPair))

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockCreateOrder).toHaveBeenCalledWith(
            expect.objectContaining({ sourceAddress: null }),
        )
    })

    it('prompts for terms on a first XO order and aborts when dismissed', async () => {
        mockIsTermsAccepted = false
        mockRequestBottomSheet.mockResolvedValue(undefined)
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])
        mockCreateOrder.mockResolvedValue(xoOrder)

        const { result } = renderHook(() => useOnrampForm(xoPair))

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        mockRequestBottomSheet.mockClear()

        await act(async () => {
            await result.current.handleConfirm()
        })

        // The terms sheet was opened.
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const termsRequest = mockRequestBottomSheet.mock.calls[0]![0] as {
            contents: { type: unknown }
        }
        expect(termsRequest.contents.type).toBe(OnrampTermsContent)
        // Dismissed (falsy) → no acceptance persisted, no order created.
        expect(mockMarkTermsAccepted).not.toHaveBeenCalled()
        expect(mockCreateOrder).not.toHaveBeenCalled()
    })

    it('persists acceptance and proceeds when the terms sheet resolves true', async () => {
        mockIsTermsAccepted = false
        // First request resolves the terms sheet; later the XO review sheet.
        mockRequestBottomSheet
            .mockResolvedValueOnce(true)
            .mockResolvedValue(undefined)
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])
        mockCreateOrder.mockResolvedValue(xoOrder)

        const { result } = renderHook(() => useOnrampForm(xoPair))

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockMarkTermsAccepted).toHaveBeenCalledTimes(1)
        expect(mockCreateOrder).toHaveBeenCalled()
    })

    it('never prompts for terms on a Meld order', async () => {
        mockIsTermsAccepted = false
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])
        mockCreateOrder.mockResolvedValue(meldOrder)

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmount('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockMarkTermsAccepted).not.toHaveBeenCalled()
        expect(mockCreateOrder).toHaveBeenCalled()
        expect(mockOpenURL).toHaveBeenCalled()
    })
})
