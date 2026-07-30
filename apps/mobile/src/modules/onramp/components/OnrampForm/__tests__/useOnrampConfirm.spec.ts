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
import { Decimal } from 'decimal.js'
import { NoConnectionError } from '@perawallet/wallet-core-shared'
import type { RampPair, MeldQuote } from '@perawallet/wallet-core-onramp'
import { useOnrampConfirm } from '../useOnrampConfirm'

// --- mock fns -------------------------------------------------------------

const mockCreateRampOrder = vi.fn()
const mockEnsureOptIn = vi.fn()
const mockErrorToast = vi.fn()

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

let mockSelectedAccountAddress: string | null = 'ACCOUNT_ADDRESS'
let mockNetwork = 'mainnet'

// --- mocks ----------------------------------------------------------------

vi.mock('@perawallet/wallet-core-onramp', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-onramp')
    >('@perawallet/wallet-core-onramp')
    return {
        ...actual,
        useCreateRampOrderMutation: () => ({
            mutateAsync: mockCreateRampOrder,
        }),
        useEnsureDestinationOptIn: () => ({ ensureOptIn: mockEnsureOptIn }),
        useOnramp: () => ({ senderAddress: 'SENDER_ADDRESS' }),
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

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: mockNetwork }),
}))

// The order-review sheet (imported transitively by the confirm hook) pulls in
// AddressDisplay → AccountIcon → the full accounts module, which this hook
// test does not stub. The hook only references the sheet as an opaque
// component, so stub it out (mirrors useOnrampForm.spec.tsx).
vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: () => null,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane. A
    // constant id here would route past resolveDestinationAssetId's null
    // branch instead of exercising it.
    getKnownAssetId: (_key: string, network: string) =>
        ({ mainnet: '31566704', testnet: '10458941' })[network] ?? null,
    ALGO_ASSET: { assetId: '0', unitName: 'ALGO', decimals: 6 },
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

// Same pair with a USDC destination: unlike ALGO, USDC needs an ASA id, so
// this is the fixture that reaches getKnownAssetId at all.
const usdcPair: RampPair = {
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

const meldQuote: MeldQuote = {
    kind: 'meld',
    quoteId: 'm1',
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
}

const defaultProps: Parameters<typeof useOnrampConfirm>[0] = {
    selectedPair: meldPair,
    selectedQuote: meldQuote,
    sourceAmount: '100',
    destinationAmount: new Decimal(500),
    isMeld: true,
}

describe('useOnrampConfirm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSelectedAccountAddress = 'ACCOUNT_ADDRESS'
        mockNetwork = 'mainnet'
        mockEnsureOptIn.mockResolvedValue(true)
        mockRequestBottomSheet.mockResolvedValue(undefined)
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
            expect.objectContaining({ destinationAssetId: 31_566_704n }),
        )
        expect(mockCreateRampOrder).toHaveBeenCalled()
    })

    it('bails out before opt-in when the network has no known destination asset id', async () => {
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
})
