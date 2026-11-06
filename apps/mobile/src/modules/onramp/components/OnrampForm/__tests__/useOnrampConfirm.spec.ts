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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Linking } from 'react-native'
import { Decimal } from 'decimal.js'
import { NoConnectionError } from '@perawallet/wallet-core-shared'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { registerAlgorandRampAdapter } from '@test-utils/rampChainAdapter'
import {
    makeAlgoToken,
    makeDepositToken,
    makeFiatToken,
    makeRampPair,
    makeRampToken,
} from '@test-utils/rampFixtures'
import { useOnrampConfirm } from '../useOnrampConfirm'

// --- mock fns -------------------------------------------------------------

const mockCreateRampOrder = vi.fn()
const mockRememberDepositInstructions = vi.fn()
const mockEnsureOptIn = vi.fn()
const mockErrorToast = vi.fn()

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

let mockSelectedAccountAddress: string | null = 'ACCOUNT_ADDRESS'
let mockStoredAccountAddress: string | null | undefined = undefined
let mockNetwork = 'mainnet'

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
        useCreateRampOrderMutation: () => ({
            mutateAsync: mockCreateRampOrder,
        }),
        useOnramp: () => ({
            rememberDepositInstructions: mockRememberDepositInstructions,
        }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    // Real enums (models/accounts has no runtime imports): components reached
    // through module barrels read them at import time.
    ...(await vi.importActual<object>(
        '@packages/accounts/src/models/accounts',
    )),
    getSelectedAccount: () => storedAccountMock(),
    addressOn: (
        account: { chains: Record<string, { address: string }> },
        scope: { chainId: string },
    ) => account.chains[scope.chainId]?.address,
}))

const accountAt = (address: string | null) =>
    address === null
        ? null
        : {
              id: 'selected',
              custody: { kind: 'watch' },
              chains: { algorand: { address } },
          }

const selectedAccountMock = () => accountAt(mockSelectedAccountAddress)

// getSelectedAccount() re-reads at confirm time, so it can diverge from the
// account the form rendered with.
const storedAccountMock = () =>
    accountAt(
        mockStoredAccountAddress === undefined
            ? mockSelectedAccountAddress
            : mockStoredAccountAddress,
    )

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: () => ({
        account: selectedAccountMock(),
        scope:
            mockSelectedAccountAddress === null
                ? null
                : { chainId: 'algorand', networkId: mockNetwork },
        address: mockSelectedAccountAddress,
    }),
}))

vi.mock('@modules/onramp/hooks/useTrackOnrampEvent', () => ({
    useTrackOnrampEvent: () => vi.fn(),
}))

// The order-review sheet (imported transitively by the confirm hook) pulls in
// AddressDisplay → AccountIcon → the full accounts module, which this hook
// test does not stub. The hook only references the sheet as an opaque
// component, so stub it out (mirrors useOnrampForm.spec.tsx).
vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: () => null,
}))

const NATIVE_ASSET = vi.hoisted(() => ({
    assetId: '0',
    unitName: 'ALGO',
    decimals: 6,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane. A
    // constant id here would route past resolveDestinationAssetId's null
    // branch instead of exercising it.
    getKnownAssetId: (
        _key: string,
        { networkId: network }: { networkId: string },
    ) => ({ mainnet: '31566704', testnet: '10458941' })[network] ?? null,
    useNativeAsset: () => NATIVE_ASSET,
    toWholeUnits: (value: number) => value,
    useAssetsQuery: () => ({ data: undefined }),
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

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        successToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key} ${Object.values(options).join(' ')}` : key,
    }),
}))

vi.mock('../useOnrampTerms', () => ({
    useOnrampTerms: () => ({
        isTermsAccepted: true,
        markTermsAccepted: vi.fn(),
    }),
}))

// --- fixtures -------------------------------------------------------------

const meldPair = makeRampPair(makeFiatToken('USD'), makeAlgoToken())

// Same pair with a USDC destination: unlike ALGO, USDC needs an ASA id.
const usdcPair = makeRampPair(makeFiatToken('USD'), makeRampToken())

const depositPair = makeRampPair(makeDepositToken(), makeAlgoToken())

const meldQuote: RampQuote = {
    kind: 'meld',
    quoteId: 'm1',
    provider: 'STRIPE',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(500),
    sourceValueInUsd: null,
    destinationValueInUsd: null,
}

const xoQuote: RampQuote = { ...meldQuote, kind: 'xo', quoteId: 'x1' }

const defaultProps: Parameters<typeof useOnrampConfirm>[0] = {
    selectedPair: meldPair,
    selectedQuote: meldQuote,
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(500),
    isMeld: true,
}

describe('useOnrampConfirm', () => {
    beforeEach(() => {
        registerAlgorandRampAdapter()
        vi.clearAllMocks()
        mockSelectedAccountAddress = 'ACCOUNT_ADDRESS'
        mockStoredAccountAddress = undefined
        mockNetwork = 'mainnet'
        mockEnsureOptIn.mockResolvedValue(true)
        mockRequestBottomSheet.mockResolvedValue(undefined)
        vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    })

    it('shows localized offline copy and resets confirming state when order creation fails offline', async () => {
        mockCreateRampOrder.mockRejectedValueOnce(new NoConnectionError())
        const { result } = renderHook(() => useOnrampConfirm(defaultProps))

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'errors.network.no_connection.title',
            'errors.network.no_connection.body',
        )
        expect(result.current.isConfirming).toBe(false)
    })

    // Companion to the null case below: without this, "did not opt in" would
    // also pass for a fixture that never got that far.
    it('opts in and creates the order when the destination asset resolves', async () => {
        const { result } = renderHook(() =>
            useOnrampConfirm({ ...defaultProps, selectedPair: usdcPair }),
        )

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockEnsureOptIn).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                assetId: '31566704',
            }),
        )
        expect(mockCreateRampOrder).toHaveBeenCalledWith({
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            quoteId: 'm1',
        })
    })

    it("falls back to the form's address when the selected account was removed", async () => {
        mockStoredAccountAddress = null
        const { result } = renderHook(() =>
            useOnrampConfirm({ ...defaultProps, selectedPair: usdcPair }),
        )

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockEnsureOptIn).toHaveBeenCalledWith(
            expect.objectContaining({ address: 'ACCOUNT_ADDRESS' }),
        )
    })

    it('creates no order when the selected account changed since the quote was made', async () => {
        mockStoredAccountAddress = 'STORED_ADDRESS'
        const { result } = renderHook(() =>
            useOnrampConfirm({ ...defaultProps, selectedPair: usdcPair }),
        )

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockEnsureOptIn).not.toHaveBeenCalled()
        expect(mockCreateRampOrder).not.toHaveBeenCalled()
    })

    it("bails out before opt-in when the destination isn't an asset of the network", async () => {
        mockNetwork = 'betanet'
        const { result } = renderHook(() =>
            useOnrampConfirm({ ...defaultProps, selectedPair: usdcPair }),
        )

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockEnsureOptIn).not.toHaveBeenCalled()
        expect(mockCreateRampOrder).not.toHaveBeenCalled()
        expect(result.current.isConfirming).toBe(false)
    })

    it('does nothing without a valid source amount', async () => {
        const { result } = renderHook(() =>
            useOnrampConfirm({ ...defaultProps, sourceAmount: null }),
        )

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockEnsureOptIn).not.toHaveBeenCalled()
        expect(mockCreateRampOrder).not.toHaveBeenCalled()
    })

    it('opens the Meld checkout URL in the system browser', async () => {
        mockCreateRampOrder.mockResolvedValueOnce({
            kind: 'meld',
            orderId: 'order-meld-1',
            checkoutUrl: 'https://widget.example.com/session',
        })
        const { result } = renderHook(() => useOnrampConfirm(defaultProps))

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(Linking.openURL).toHaveBeenCalledWith(
            'https://widget.example.com/session',
        )
    })

    it('refuses a Meld checkout URL that is not absolute https', async () => {
        mockCreateRampOrder.mockResolvedValueOnce({
            kind: 'meld',
            orderId: 'order-meld-1',
            checkoutUrl: 'algorand://ATTACKER?amount=1',
        })
        const { result } = renderHook(() => useOnrampConfirm(defaultProps))

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it("remembers a deposit order's pay-in details and shows its review", async () => {
        mockCreateRampOrder.mockResolvedValueOnce({
            kind: 'xo',
            orderId: 'order-xo-1',
            deposit: { address: 'PAYIN', memo: '42' },
        })
        const onNavigateToHistory = vi.fn()
        const { result } = renderHook(() =>
            useOnrampConfirm({
                ...defaultProps,
                selectedPair: depositPair,
                selectedQuote: xoQuote,
                isMeld: false,
                onNavigateToHistory,
            }),
        )

        await act(async () => {
            await result.current.handleConfirm()
        })

        expect(mockRememberDepositInstructions).toHaveBeenCalledWith(
            'order-xo-1',
            { address: 'PAYIN', memo: '42' },
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(onNavigateToHistory).toHaveBeenCalled()
    })

    it("shows the quote's amount in the review, not an edit made after it", async () => {
        mockCreateRampOrder.mockResolvedValueOnce({
            kind: 'xo',
            orderId: 'order-xo-2',
            deposit: { address: 'PAYIN', memo: null },
        })
        const { result } = renderHook(() =>
            useOnrampConfirm({
                ...defaultProps,
                selectedPair: depositPair,
                selectedQuote: { ...xoQuote, sourceAmount: new Decimal(1) },
                sourceAmount: new Decimal(2),
                isMeld: false,
            }),
        )

        await act(async () => {
            await result.current.handleConfirm()
        })

        const { contents } = mockRequestBottomSheet.mock.calls[0][0]
        expect(contents.props.item.sourceAmount).toEqual(new Decimal(1))
    })
})
