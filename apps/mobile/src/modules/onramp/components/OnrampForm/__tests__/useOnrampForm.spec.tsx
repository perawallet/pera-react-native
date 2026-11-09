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
import {
    RampAmountOutOfRangeError,
    type RampPair,
    type RampQuote,
    type RampOrder,
} from '@perawallet/wallet-core-onramp'
import { registerAlgorandRampAdapter } from '@test-utils/rampChainAdapter'
import {
    ALGO_ROUTER_ID,
    BTC_ROUTER_ID,
    USD_ROUTER_ID,
    makeAlgoToken,
    makeDepositToken,
    makeFiatToken,
    makeRampPair,
    makeRampToken,
} from '@test-utils/rampFixtures'
import { useOnrampForm } from '../useOnrampForm'
import { OnrampTermsContent } from '../../OnrampTermsContent'

// --- mock fns -------------------------------------------------------------

const mockCreateQuote = vi.fn()
const mockCreateOrder = vi.fn()
const mockEnsureOptIn = vi.fn()
const mockSetSenderAddress = vi.fn()
const mockRememberDepositInstructions = vi.fn()
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
        useEnsureRampDestination: () => ({
            ensureCanReceive: mockEnsureOptIn,
        }),
        useCreateRampQuoteMutation: () => ({ mutateAsync: mockCreateQuote }),
        useCreateRampOrderMutation: () => ({ mutateAsync: mockCreateOrder }),
        useRampRegionQuery: () => ({
            data: { countryCode: 'DE', countryName: 'Germany' },
        }),
        useOnramp: () => ({
            rememberDepositInstructions: mockRememberDepositInstructions,
            senderAddress: mockSenderAddress,
            setSenderAddress: mockSetSenderAddress,
            setSelectedSourceTokenId: mockSetSelectedSourceTokenId,
            setSelectedDestinationTokenId: mockSetSelectedDestinationTokenId,
        }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    // Real enums (models/accounts has no runtime imports): components reached
    // through module barrels read them at import time.
    ...(await vi.importActual<object>(
        '@packages/accounts/src/models/accounts',
    )),
    getSelectedAccount: () => selectedAccountMock(),
    addressOn: (
        account: { chains: Record<string, { address: string }> },
        scope: { chainId: string },
    ) => account.chains[scope.chainId]?.address,
}))

const selectedAccountMock = () =>
    mockSelectedAccountAddress === null
        ? null
        : {
              id: 'selected',
              custody: { kind: 'watch' },
              chains: { algorand: { address: mockSelectedAccountAddress } },
          }

// The order-review sheet (imported transitively by the form hook) pulls in
// AddressDisplay → AccountIcon → the full accounts module, which this hook
// test does not stub. The hook only references the sheet as an opaque
// component, so stub it out.
vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: () => null,
}))

const NATIVE_ASSET = vi.hoisted(() => ({
    assetId: '0',
    unitName: 'ALGO',
    decimals: 6,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane, so
    // this stub can never route a consumer past a `=== null` guard.
    getKnownAssetId: (
        _key: string,
        { networkId: network }: { networkId: string },
    ) => ({ mainnet: '31566704', testnet: '10458941' })[network] ?? null,
    // Imported at module scope by OptInConfirmationContent (rendered via the
    // confirm-opt-in sheet the form hook now requests).
    useNativeAsset: () => NATIVE_ASSET,
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

// Stable across renders like the real hook's memoised scope; a fresh object
// would refire the quote effect on every render.
const MAINNET_SCOPE = { chainId: 'algorand', networkId: 'mainnet' }

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: () => ({
        account: selectedAccountMock(),
        scope: mockSelectedAccountAddress === null ? null : MAINNET_SCOPE,
        address: mockSelectedAccountAddress,
    }),
}))

vi.mock('@modules/onramp/hooks/useTrackOnrampEvent', () => ({
    useTrackOnrampEvent: () => vi.fn(),
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
vi.mock('@modules/webview', async () => ({
    useWebView: () => ({ pushWebView: vi.fn(), removeWebView: vi.fn() }),
    openValidatedBrowserUrl: (
        await vi.importActual<typeof import('@modules/webview/hooks/handlers')>(
            '@modules/webview/hooks/handlers',
        )
    ).openValidatedBrowserUrl,
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

const meldPair = makeRampPair(makeFiatToken('USD'), makeAlgoToken())

const usdcMeldPair = makeRampPair(makeFiatToken('USD'), makeRampToken())

const xoPair = makeRampPair(makeDepositToken(), makeAlgoToken())

const makeMeldQuote = (
    overrides: Partial<RampQuote> & { quoteId: string },
): RampQuote => ({
    kind: 'meld',
    provider: 'STRIPE',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(500),
    sourceValueInUsd: new Decimal(100),
    destinationValueInUsd: new Decimal(80),
    ...overrides,
})

const makeXoQuote = (
    overrides: Partial<RampQuote> & { quoteId: string },
): RampQuote =>
    makeMeldQuote({
        kind: 'xo',
        provider: 'XO',
        paymentMethod: { id: 'CRYPTO', logo: null, name: '' },
        ...overrides,
    })

const meldOrder: RampOrder = {
    kind: 'meld',
    orderId: 'order-1',
    checkoutUrl: 'https://meld.widget/checkout',
}

const xoOrder: RampOrder = {
    kind: 'xo',
    orderId: 'order-2',
    deposit: { address: 'PAY_IN', memo: null },
}

const belowMinQuoteError = new RampAmountOutOfRangeError(
    'min',
    { min: new Decimal(600), max: new Decimal(5000) },
    'Source amount is below the minimum allowed.',
)

describe('useOnrampForm', () => {
    beforeEach(() => {
        registerAlgorandRampAdapter()
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
            result.current.setSourceAmountText('100')
        })

        // Before the debounce window the quote endpoint has not been called.
        expect(mockCreateQuote).not.toHaveBeenCalled()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
        expect(mockCreateQuote).toHaveBeenCalledWith({
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            sourceToken: {
                id: USD_ROUTER_ID,
                kind: 'fiat',
                fractionDecimals: 2,
            },
            destinationToken: { id: ALGO_ROUTER_ID, fractionDecimals: 6 },
            sourceAmount: new Decimal(100),
            destinationAddress: 'ACCOUNT_ADDRESS',
            countryCode: 'DE',
            refundAddress: 'SENDER_ADDRESS',
        })
    })

    it('asks for no quote while the amount is empty or floors to nothing', async () => {
        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmountText('')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        act(() => {
            result.current.setSourceAmountText('0.001')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).not.toHaveBeenCalled()
        expect(result.current.errorMessage).toBeNull()
        expect(result.current.isQuoting).toBe(false)
    })

    it('does not re-quote when an edit leaves the amount unchanged', async () => {
        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmountText('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        act(() => {
            result.current.setSourceAmountText('100.')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).toHaveBeenCalledTimes(1)
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
        let resolveStale: (v: RampQuote[]) => void = () => {}
        mockCreateQuote
            .mockImplementationOnce(
                () =>
                    new Promise<RampQuote[]>(resolve => {
                        resolveStale = resolve
                    }),
            )
            .mockImplementationOnce(() => Promise.resolve([freshQuote]))

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmountText('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        act(() => {
            result.current.setSourceAmountText('200')
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

    it('cannot confirm while a re-quote is in flight, so an order never uses a quote for another amount', async () => {
        let resolveRequote: (v: RampQuote[]) => void = () => {}
        mockCreateQuote
            .mockResolvedValueOnce([makeMeldQuote({ quoteId: 'q100' })])
            .mockImplementationOnce(
                () =>
                    new Promise<RampQuote[]>(resolve => {
                        resolveRequote = resolve
                    }),
            )
        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmountText('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        expect(result.current.canConfirm).toBe(true)

        act(() => {
            result.current.setSourceAmountText('200')
        })
        expect(result.current.isQuoting).toBe(true)
        expect(result.current.canConfirm).toBe(false)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        await act(async () => {
            resolveRequote([makeMeldQuote({ quoteId: 'q200' })])
            await Promise.resolve()
        })

        expect(result.current.canConfirm).toBe(true)
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
            result.current.setSourceAmountText('100')
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
            result.current.setSourceAmountText('100')
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
            result.current.setSourceAmountText('100')
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
            result.current.setSourceAmountText('100')
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

    it('quotes a deposit pair per amount, sending the sender address as the refund address', async () => {
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])

        const { result } = renderHook(() => useOnrampForm(xoPair))

        // No amount yet, so nothing to ask.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        expect(mockCreateQuote).not.toHaveBeenCalled()

        act(() => {
            result.current.setSourceAmountText('0.5')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        act(() => {
            result.current.setSourceAmountText('0.7')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).toHaveBeenCalledTimes(2)
        expect(mockCreateQuote).toHaveBeenLastCalledWith(
            expect.objectContaining({
                sourceToken: {
                    id: BTC_ROUTER_ID,
                    kind: 'deposit',
                    fractionDecimals: 8,
                },
                sourceAmount: new Decimal('0.7'),
                refundAddress: 'SENDER_ADDRESS',
            }),
        )
    })

    it('sends no refund address when the sender address is blank', async () => {
        mockSenderAddress = '   '
        mockCreateQuote.mockResolvedValue([])

        const { result } = renderHook(() => useOnrampForm(xoPair))
        act(() => {
            result.current.setSourceAmountText('1')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).toHaveBeenCalledWith(
            expect.objectContaining({ refundAddress: null }),
        )
    })

    it('exposes the selected quote USD prices per unit', async () => {
        mockCreateQuote.mockResolvedValue([
            makeMeldQuote({
                quoteId: 'm1',
                destinationAmount: new Decimal(1000),
            }),
        ])

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.sourceUsdPrice?.toString()).toBe('1')
        expect(result.current.destinationUsdPrice?.toString()).toBe('0.08')
        expect(result.current.destinationAmount?.toString()).toBe('1000')
    })

    it('shows the router message and the above-max copy when the amount is too high', async () => {
        mockCreateQuote.mockRejectedValue(
            new RampAmountOutOfRangeError(
                'max',
                { min: null, max: new Decimal(5000) },
                'Amount is too high.',
            ),
        )

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.errorMessage).toBe('onramp.form.amount_above_max')
        expect(result.current.limits?.max?.toString()).toBe('5000')
        expect(result.current.limits?.min).toBeNull()
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

        // The pill calls onSetSourceAmountText with limits.min.toString().
        const min = result.current.limits?.min?.toString() ?? ''
        act(() => {
            result.current.setSourceAmountText(min)
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(mockCreateQuote).toHaveBeenLastCalledWith(
            expect.objectContaining({ sourceAmount: new Decimal(600) }),
        )
        expect(result.current.errorMessage).toBeNull()
        // Limits stay sticky after success so the pill remains available.
        expect(result.current.limits?.min?.toString()).toBe('600')
    })

    it('exposes a min-only limit with a null max', async () => {
        mockCreateQuote.mockRejectedValue(
            new RampAmountOutOfRangeError(
                'min',
                { min: new Decimal(600), max: null },
                'Too low.',
            ),
        )

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.limits?.min?.toString()).toBe('600')
        expect(result.current.limits?.max).toBeNull()
    })

    it('shows localized below-minimum copy when the router names no limit', async () => {
        mockCreateQuote.mockRejectedValue(
            new RampAmountOutOfRangeError(
                'min',
                { min: null, max: null },
                'Too low.',
            ),
        )

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.limits).toBeNull()
        expect(result.current.errorMessage).toBe(
            'onramp.form.amount_below_min_unknown',
        )
    })

    it("shows the router's message for any other refusal", async () => {
        mockCreateQuote.mockRejectedValue({
            name: 'HTTPError',
            status: 403,
            data: {
                error: 'Not available in your country.',
                code: 'pair_restricted_in_country',
            },
        })

        const { result } = renderHook(() => useOnrampForm(meldPair))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(result.current.errorMessage).toBe(
            'Not available in your country.',
        )
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
            result.current.setSourceAmountText('100')
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
            result.current.setSourceAmountText('100')
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
            result.current.setSourceAmountText('100')
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

    it("hands the USDC destination's asset id to the receive preparation", async () => {
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])

        const { result } = renderHook(() => useOnrampForm(usdcMeldPair))

        act(() => {
            result.current.setSourceAmountText('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockEnsureOptIn).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'ACCOUNT_ADDRESS',
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                assetId: '31566704',
            }),
        )
    })

    it('opens the Meld widget in the OS browser when the order is a Meld order', async () => {
        mockCreateQuote.mockResolvedValue([makeMeldQuote({ quoteId: 'm1' })])
        mockCreateOrder.mockResolvedValue(meldOrder)

        const { result } = renderHook(() => useOnrampForm(meldPair))

        act(() => {
            result.current.setSourceAmountText('100')
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

        expect(result.current.sourceAmountText).toBe('100')
    })

    it('leaves the source amount empty for an XO pair', () => {
        const { result } = renderHook(() => useOnrampForm(xoPair))

        expect(result.current.sourceAmountText).toBe('')
    })

    it('opens the review sheet when the order is an XO order', async () => {
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])
        mockCreateOrder.mockResolvedValue(xoOrder)

        const { result } = renderHook(() => useOnrampForm(xoPair))

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        act(() => {
            result.current.setSourceAmountText('100')
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

    it('quotes with the parsed source amount and orders by quote id', async () => {
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])
        mockCreateOrder.mockResolvedValue(xoOrder)

        const { result } = renderHook(() => useOnrampForm(xoPair))

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        act(() => {
            result.current.setSourceAmountText('100.50')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        await act(async () => {
            await result.current.handleConfirm()
        })

        const [quoteParams] = mockCreateQuote.mock.calls.at(-1)! as [
            { sourceAmount: Decimal },
        ]
        expect(quoteParams.sourceAmount.toFixed()).toBe('100.5')
        expect(mockCreateOrder).toHaveBeenCalledWith({
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            quoteId: 'xo-1',
        })
    })

    it("remembers a deposit order's pay-in details for History", async () => {
        mockCreateQuote.mockResolvedValue([makeXoQuote({ quoteId: 'xo-1' })])
        mockCreateOrder.mockResolvedValue({
            ...xoOrder,
            deposit: { address: 'PAY_IN', memo: '99' },
        })

        const { result } = renderHook(() => useOnrampForm(xoPair))

        act(() => {
            result.current.setSourceAmountText('100')
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })
        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockRememberDepositInstructions).toHaveBeenCalledWith(
            'order-2',
            { address: 'PAY_IN', memo: '99' },
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
            result.current.setSourceAmountText('100')
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
            result.current.setSourceAmountText('100')
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
            result.current.setSourceAmountText('100')
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
