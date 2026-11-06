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

// The native onramp BUY flow end-to-end through the real OnrampScreen,
// OnrampForm and wallet-core-onramp hooks. Only the network (MSW) and base app
// state (selected account, network, device, opt-in holdings) are seeded.
//
// Every provider's quote is fetched per amount through the v4 swap router; the
// receive amount is the offer's expected amount. The fetch is debounced 500ms,
// so the test waits on the receive amount with real timers rather than mocking
// the clock.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import {
    Address,
    SignedTransaction,
    Transaction,
    TransactionType,
} from 'algosdk'
import {
    encodeTransaction,
    encodeSignedTransaction,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'

import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { useAppIntegrityStore } from '@perawallet/wallet-core-app-integrity'
import { useOnrampStore } from '@perawallet/wallet-core-onramp'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import { useWebViewStore } from '@modules/webview'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { OnrampScreen } from '@modules/onramp/routes'
import {
    mockRampDestinations,
    mockRampSources,
    mockRampRegion,
    mockCreateRampQuote,
    mockCreateRampQuoteError,
    mockCreateRampOrder,
    mockRampHistory,
    type MockRampPairsParams,
    type MockCreateRampQuoteParams,
    type MockCreateRampQuoteErrorParams,
    type MockCreateRampOrderParams,
    type MockRampHistoryParams,
} from '@perawallet/wallet-core-onramp/test-handlers'
import {
    mockAlgodAccountInformation,
    mockAssetItems,
    mockAlgodStatus,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'

import { isElementDisabled } from '@test-utils/rnw'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
} from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

// The API-response shapes aren't exported from the package (schemas are
// internal); the mock-factory param types carry them, so derive the fixture
// types from there.
type RampPairRow = MockRampPairsParams['response']['results'][number]
type RampAsset = RampPairRow['asset']
type RampOffer = MockCreateRampQuoteParams['response']['results'][number]
type RampOrderApiResponse = MockCreateRampOrderParams['response']
type RampHistoryPageApiResponse = MockRampHistoryParams['response']

// The intro-seen flag lives in the settings preferences store (read via
// `useOnrampIntroduction`), not the onramp store. Set it so the screen renders
// the form directly instead of opening the one-time welcome sheet.
const ONRAMP_INTRO_SEEN_KEY = 'onramp-introduction-seen'
const markIntroSeen = () => {
    useSettingsStore.getState().setPreference(ONRAMP_INTRO_SEEN_KEY, true)
}

// The first XO order is gated by a one-time Terms acceptance (read via
// `useOnrampTerms`). Seed it so these flow tests exercise the order path
// directly rather than the terms sheet (covered by the hook's unit test).
const ONRAMP_XO_TERMS_ACCEPTED_KEY = 'onramp-xo-terms-accepted'
const markXoTermsAccepted = () => {
    useSettingsStore
        .getState()
        .setPreference(ONRAMP_XO_TERMS_ACCEPTED_KEY, true)
}

// The on-chain USDC asset id the form resolves for an ASA destination on
// mainnet (the integration default network). The opt-in check reads the
// account's algod holdings for this id.
const USDC_MAINNET_ASSET_ID = 31_566_704
const USDC_ASSET_NUMBER = '31566704'

const PAY_IN_ADDRESS =
    'XOPAYINADDRESS33333333333333333333333333333333333333333333Q'
const TO_ADDRESS = ALGO25_TEST_ADDRESS

// The router's asset ids (CAIP-19).
const MAINNET_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const ALGO_ID = `${MAINNET_CAIP2}/asa:0`
const USDC_ID = `${MAINNET_CAIP2}/asa:${USDC_ASSET_NUMBER}`
const BTC_ID = 'bip122:000000000019d6689c085ae165831e93/slip44:0'
const USD_ID = 'swift:0/iso4217:USD'

const ALGO_ASSET: RampAsset = {
    asset_id: ALGO_ID,
    name: 'ALGO',
    unit_name: 'ALGO',
    fraction_decimals: 6,
}
const USDC_ASSET: RampAsset = {
    asset_id: USDC_ID,
    name: 'USDC',
    unit_name: 'USDC',
    fraction_decimals: 6,
}
const BTC_ASSET: RampAsset = {
    asset_id: BTC_ID,
    name: 'Bitcoin',
    unit_name: 'BTC',
    fraction_decimals: 8,
    chain: 'Bitcoin',
}
const USD_ASSET: RampAsset = {
    asset_id: USD_ID,
    name: 'US Dollar',
    unit_name: 'USD',
    fraction_decimals: 2,
}

const row = (asset: RampAsset, kind: string): RampPairRow => ({
    kind,
    asset,
    aggregator: 'meld',
    funding_method: 'provider_checkout',
})

// The destinations Fund lists, and the deposit sources of one of them. The
// destination is the one the form opens on (native) unless told otherwise.
const buildXoPairHandlers = (destination: RampAsset = ALGO_ASSET) => [
    mockRampDestinations({
        response: { next: null, results: [row(destination, 'token')] },
    }),
    mockRampSources({
        response: { next: null, results: [row(BTC_ASSET, 'deposit')] },
    }),
]

const buildMeldPairHandlers = () => [
    mockRampDestinations({
        response: { next: null, results: [row(ALGO_ASSET, 'token')] },
    }),
    mockRampSources({
        response: { next: null, results: [row(USD_ASSET, 'fiat')] },
    }),
]

// XO offer: 1 BTC (the amount the tests enter) buys 999.5 of the destination.
const buildXoQuote = (
    destination: RampAsset = ALGO_ASSET,
    quoteId = 'quote-xo-1',
): RampOffer => ({
    quote_id: quoteId,
    aggregator: 'xo',
    provider: 'XO',
    source_asset: BTC_ASSET,
    destination_asset: destination,
    source_amount: '100000000',
    destination_amount_expected: '999500000',
    funding_method: 'external_deposit',
})

// Meld offer at the provider minimum: 600 USD -> 950.5 ALGO.
const buildMeldQuoteResponse = (
    overrides: {
        quoteId?: string
        destinationAmount?: number
        destinationUsdValue?: string
        serviceProvider?: string
        paymentMethodId?: string
    } = {},
): RampOffer => ({
    quote_id: overrides.quoteId ?? 'quote-meld-600',
    aggregator: 'meld',
    provider: overrides.serviceProvider ?? 'MERCURYO',
    source_asset: USD_ASSET,
    destination_asset: ALGO_ASSET,
    source_amount: '60000',
    destination_amount_expected: String(
        Math.round((overrides.destinationAmount ?? 950.5) * 1_000_000),
    ),
    source_amount_usd_value: '600',
    destination_amount_usd_value: overrides.destinationUsdValue ?? null,
    funding_method: 'provider_checkout',
    extras: {
        payment_method: overrides.paymentMethodId ?? 'CREDIT_DEBIT_CARD',
    },
})

// The router's refusal of an amount below the minimum. A real one carries no
// maximum; the default adds one to keep the MIN and MAX pill segments.
const buildBelowMinQuoteErrorBody = (
    withMaximum = true,
): MockCreateRampQuoteErrorParams['response'] => ({
    error: 'Source amount is below the minimum allowed.',
    code: 'amount_too_low',
    source_amount_minimum: '60000',
    ...(withMaximum ? { source_amount_maximum: '500000' } : {}),
})

const buildXoOrder = (): RampOrderApiResponse => ({
    order_id: 'order-1',
    status: 'pending',
    expires_at: null,
    steps: [
        {
            kind: 'deposit_instructions',
            address: PAY_IN_ADDRESS,
            memo: null,
        },
    ],
})

const REGION_RESPONSE = {
    country_code: 'US',
    country_name: 'United States',
}

// useRampHistoryInfiniteQuery is `enabled` only when both a device id (for the
// default mainnet network) and a selected account address are present.
const TEST_DEVICE_ID = 'device-onramp-1'
const seedDeviceId = () => {
    useDeviceStore.getState().setDeviceID('live', TEST_DEVICE_ID)
}

const HISTORY_ORDER_ID = 'history-order-1'

// One completed provider-checkout (fiat) history item: 100 USD -> 50 ALGO. The
// list row renders "100 USD for 50 ALGO" and the details sheet shows the order
// id.
const buildMeldHistoryItem = (
    orderId: string,
    status: 'completed' | 'pending' = 'completed',
): RampHistoryPageApiResponse['results'][number] => ({
    order_id: orderId,
    aggregator: 'meld',
    provider: 'MELD',
    status,
    funding_method: 'provider_checkout',
    destination_account: `${MAINNET_CAIP2}:${TO_ADDRESS}`,
    source_asset: USD_ASSET,
    destination_asset: ALGO_ASSET,
    source_amount: '10000',
    destination_amount_expected: '50000000',
    created_at: '2025-12-23T23:16:00Z',
})

const buildMeldHistoryPage = (): RampHistoryPageApiResponse => ({
    next: null,
    previous: null,
    results: [buildMeldHistoryItem(HISTORY_ORDER_ID)],
})

const seedSelectedAccount = (): WalletAccount => {
    const account: WalletAccount = {
        id: 'buyer-1',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: {
                address: ALGO25_TEST_ADDRESS,
                keyPairId: 'buyer-key-1',
            },
        },
        name: 'Buyer',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
    return account
}

// Like `seedSelectedAccount`, but mints a REAL algo25 key in the test
// keystore so the signing pipeline can actually sign the delegated opt-in.
const seedSignableAccount = async (): Promise<WalletAccount> => {
    resetTestKeystore()
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await act(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(key).not.toBeNull()
    })
    const account: WalletAccount = {
        id: 'buyer-1',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: {
                address: ALGO25_TEST_ADDRESS,
                keyPairId: key!.seedKey.id ?? '',
            },
        },
        name: 'Buyer',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
    return account
}

// Fee delegation requires a valid (non-expired) device attestation token.
const seedAttestation = () => {
    useAppIntegrityStore.getState().setRegistration({
        integrityToken: 'integration-test-token',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        keyId: 'integrity-key-1',
        deviceInstallationId: TEST_DEVICE_ID,
    })
}

const SPONSOR_ADDRESS = new Address(new Uint8Array(32).fill(7))

// The sponsor payment the backend prepends: pays the account's MBR shortfall
// when `mbrFunding > 0`, otherwise a 0-amount self-payment that only carries
// the pooled fee.
const buildSponsorTxn = (mbrFunding: bigint): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender: SPONSOR_ADDRESS,
        suggestedParams: {
            fee: 2000n,
            minFee: 1000n,
            flatFee: true,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisID: 'mainnet-v1.0',
            // Mainnet's: the pipeline checks every group member's network.
            // Re-wrapped so algosdk's same-realm Uint8Array check passes.
            genesisHash: new Uint8Array(
                decodeFromBase64(
                    'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
                ),
            ),
        },
        paymentParams: {
            receiver:
                mbrFunding > 0n
                    ? Address.fromString(ALGO25_TEST_ADDRESS)
                    : SPONSOR_ADDRESS,
            amount: mbrFunding,
        },
    })

type CapturedFeeDelegationBody = {
    txnGroup: { txn: string }[]
    account: string
    includeAssetOptInMbr: boolean
    optInAssetIds: string[]
}

// Echo-style fee-delegation handler: captures the request body and returns
// the wallet's own opt-in (unchanged) behind a pre-signed sponsor payment.
// The entries carry no group id — the signing pipeline treats ungrouped
// transactions as independent, mirroring what matters for the client flow.
const mockFeeDelegationEcho = (
    mbrFunding: bigint,
    onRequest: (body: CapturedFeeDelegationBody) => void,
) =>
    http.post('*/api/v3/fee-delegation', async ({ request }) => {
        const body = (await request.json()) as CapturedFeeDelegationBody
        onRequest(body)
        const sponsor = buildSponsorTxn(mbrFunding)
        return HttpResponse.json({
            txnGroup: [
                {
                    txn: encodeToBase64(encodeTransaction(sponsor)),
                    signers: [],
                    stxn: encodeToBase64(
                        encodeSignedTransaction(
                            new SignedTransaction({
                                txn: sponsor,
                                sig: new Uint8Array(64),
                            }),
                        ),
                    ),
                },
                { txn: body.txnGroup[0]!.txn, signers: [ALGO25_TEST_ADDRESS] },
            ],
        })
    })

// Shared MSW setup for the delegated opt-in flows: a USDC-destination XO
// pair, an un-opted-in account whose spendable ALGO can't cover the opt-in,
// and the algod surface the signing pipeline talks to.
const installDelegatedOptInHandlers = ({
    accountAddress,
    accountAmount,
    sendSpy,
}: {
    accountAddress: string
    accountAmount: number
    sendSpy: () => Response
}) => {
    server.use(
        mockAlgodAccountInformation({
            address: accountAddress,
            response: {
                amount: accountAmount,
                'min-balance': 100_000,
                assets: [],
            },
        }),
        mockAlgodTransactionParams({ response: { fee: 1000 } }),
        mockAlgodStatus({ response: { 'last-round': 100 } }),
        http.post('*/v2/transactions', sendSpy),
        // Asset metadata lookups (opt-in sheet + post-submit refresh).
        mockAssetItems(),
        ...buildXoPairHandlers(USDC_ASSET),
        mockRampRegion({ response: REGION_RESPONSE }),
        mockCreateRampQuote({
            response: { results: [buildXoQuote(USDC_ASSET)] },
        }),
        mockCreateRampOrder({ response: buildXoOrder() }),
    )
}

const enterPayAmount = (value: string) => {
    const input = screen.getByTestId('onramp-pay-input') as HTMLInputElement
    fireEvent.change(input, { target: { value } })
}

describe('Flow: Onramp buy (native XO)', () => {
    // Cases that don't exercise balances or history leave the background
    // account-information and ramp-history fetches unmocked.
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        // The delegated opt-in flows render the asset opt-in confirmation
        // sheet, whose asset lookup goes through the sqlite-backed assets
        // query.
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        useAccountsStore.getState().setAccounts([])
        useOnrampStore.getState().resetState()
        useWebViewStore.setState({ openWebViews: [] })
        useSettingsStore.setState({ preferences: {} })
        useDeviceStore.getState().resetState()
        useAppIntegrityStore.getState().resetState()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
    })

    describe('mode gate', () => {
        afterEach(() => {
            useNetworkStore.getState().setMode('live')
        })

        it('Given developer mode, when the wallet switches to live, then the placeholder gives way to the buy flow without a remount', async () => {
            seedSelectedAccount()
            markIntroSeen()
            useNetworkStore.getState().setMode('developer')
            server.use(
                ...buildXoPairHandlers(),
                mockRampRegion({ response: REGION_RESPONSE }),
            )

            renderWithNavigation(OnrampScreen, 'Fund')

            expect(await screen.findByText('onramp.testnet.title')).toBeTruthy()
            expect(screen.queryByTestId('onramp-screen')).toBeNull()

            await act(async () => {
                useNetworkStore.getState().setMode('live')
            })

            expect(await screen.findByTestId('onramp-screen')).toBeTruthy()
            expect(screen.queryByText('onramp.testnet.title')).toBeNull()
        })
    })

    it('Given an ALGO-destination XO pair, when the user enters an amount and taps Buy, then no opt-in occurs and the XO order-review sheet shows the pay-in address', async () => {
        seedSelectedAccount()
        // Mark the intro as seen so the screen renders the form directly.
        markIntroSeen()
        markXoTermsAccepted()
        // The source is unset on entry; seed the selection so a pair resolves.
        useOnrampStore.setState({
            selectedSourceTokenId: BTC_ID,
            selectedDestinationTokenId: ALGO_ID,
        })

        server.use(
            ...buildXoPairHandlers(),
            mockRampRegion({ response: REGION_RESPONSE }),
            mockCreateRampQuote({ response: { results: [buildXoQuote()] } }),
            mockCreateRampOrder({ response: buildXoOrder() }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')

        // Pairs load → isReady flips → the pay input mounts.
        const input = await screen.findByTestId(
            'onramp-pay-input',
            {},
            { timeout: 5000 },
        )
        expect(input).toBeTruthy()

        enterPayAmount('1')

        // Debounced quote resolves → receive amount populates
        // (1000 * 1 - 0.5 = 999.5, formatted to ALGO's 6 decimals).
        await waitFor(
            () => {
                expect(
                    screen.getByTestId('onramp-receive-amount').textContent,
                ).toContain('999.5')
            },
            { timeout: 5000 },
        )

        const buyButton = () => screen.getByTestId('onramp-buy-button')
        await waitFor(() => expect(isElementDisabled(buyButton())).toBe(false))

        fireEvent.click(buyButton())

        // ALGO destination → ensureOptIn is a no-op → the order is created
        // and the XO order-review sheet renders the pay-in address.
        expect(
            await screen.findByText(PAY_IN_ADDRESS, {}, { timeout: 5000 }),
        ).toBeTruthy()
        expect(screen.getByTestId('onramp-cancel-order')).toBeTruthy()
    })

    it('Given a USDC-destination XO pair and an account already opted into USDC, when the user buys, then opt-in is skipped and the order-review sheet is reached', async () => {
        const account = seedSelectedAccount()
        markIntroSeen()
        markXoTermsAccepted()
        useOnrampStore.setState({
            selectedSourceTokenId: BTC_ID,
            selectedDestinationTokenId: USDC_ID,
        })

        // Account already holds USDC on-chain → ensureOptIn takes the
        // "already opted in" branch (no attestation, no extra signing).
        server.use(
            mockAlgodAccountInformation({
                address: addressOf(account),
                response: {
                    amount: 5_000_000,
                    'min-balance': 100_000,
                    assets: [
                        {
                            'asset-id': USDC_MAINNET_ASSET_ID,
                            amount: 1_000_000,
                            'is-frozen': false,
                        },
                    ],
                },
            }),
            ...buildXoPairHandlers(USDC_ASSET),
            mockRampRegion({ response: REGION_RESPONSE }),
            mockCreateRampQuote({
                response: { results: [buildXoQuote(USDC_ASSET)] },
            }),
            mockCreateRampOrder({ response: buildXoOrder() }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')

        await screen.findByTestId('onramp-pay-input', {}, { timeout: 5000 })
        enterPayAmount('1')

        await waitFor(
            () => {
                expect(
                    screen.getByTestId('onramp-receive-amount').textContent,
                ).toContain('999.5')
            },
            { timeout: 5000 },
        )

        const buyButton = () => screen.getByTestId('onramp-buy-button')
        await waitFor(() => expect(isElementDisabled(buyButton())).toBe(false))

        fireEvent.click(buyButton())

        // Reaching the order-review sheet proves opt-in did NOT block:
        // the already-opted-in branch returned without raising an
        // attestation error.
        expect(
            await screen.findByText(PAY_IN_ADDRESS, {}, { timeout: 5000 }),
        ).toBeTruthy()
        // No webview was pushed — XO orders render in-sheet, not a Meld
        // widget.
        expect(useWebViewStore.getState().openWebViews).toHaveLength(0)
    })

    it('Given a Meld pair whose seeded amount is below the provider minimum, when the user taps MIN, then the form re-quotes at the minimum and Proceed enables', async () => {
        seedSelectedAccount()
        markIntroSeen()
        useOnrampStore.setState({
            selectedSourceTokenId: USD_ID,
            selectedDestinationTokenId: ALGO_ID,
        })

        server.use(
            ...buildMeldPairHandlers(),
            mockRampRegion({ response: REGION_RESPONSE }),
            mockCreateRampQuoteError({
                response: buildBelowMinQuoteErrorBody(),
            }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')

        // Meld pairs seed the amount to 100, so the failing quote fires on
        // entry without typing. i18n is uninitialized in the harness, so
        // copy renders as raw keys.
        expect(
            await screen.findByText(
                'onramp.form.amount_below_min',
                {},
                { timeout: 5000 },
            ),
        ).toBeTruthy()
        expect(screen.getByTestId('onramp-min-button')).toBeTruthy()
        expect(screen.getByTestId('onramp-max-button')).toBeTruthy()

        const buyButton = () => screen.getByTestId('onramp-buy-button')
        expect(isElementDisabled(buyButton())).toBe(true)

        // Swap in a successful quote for the re-fetch, then tap MIN.
        server.use(
            mockCreateRampQuote({
                response: { results: [buildMeldQuoteResponse()] },
            }),
        )
        fireEvent.click(screen.getByTestId('onramp-min-button'))

        const input = screen.getByTestId('onramp-pay-input') as HTMLInputElement
        expect(input.value).toBe('600')

        await waitFor(
            () => {
                expect(
                    screen.getByTestId('onramp-receive-amount').textContent,
                ).toContain('950.5')
            },
            { timeout: 5000 },
        )
        expect(screen.queryByText('onramp.form.amount_below_min')).toBeNull()
        await waitFor(() => expect(isElementDisabled(buyButton())).toBe(false))
    })

    it('Given one provider quoting two payment methods, when the user opens the provider sheet, then that provider is listed once with the fiat value of what it pays out', async () => {
        seedSelectedAccount()
        markIntroSeen()
        useOnrampStore.setState({
            selectedSourceTokenId: USD_ID,
            selectedDestinationTokenId: ALGO_ID,
        })

        // The offer values 960 ALGO at $480, so the fiat value line cannot be
        // confused with the ALGO amount (or with a fee).
        server.use(
            ...buildMeldPairHandlers(),
            mockRampRegion({ response: REGION_RESPONSE }),
            mockCreateRampQuote({
                response: {
                    results: [
                        buildMeldQuoteResponse({
                            quoteId: 'quote-mercuryo-card',
                            destinationAmount: 950.5,
                        }),
                        buildMeldQuoteResponse({
                            quoteId: 'quote-mercuryo-apple',
                            destinationAmount: 940,
                            paymentMethodId: 'APPLE_PAY',
                        }),
                        buildMeldQuoteResponse({
                            quoteId: 'quote-banxa-card',
                            destinationAmount: 960,
                            destinationUsdValue: '480',
                            serviceProvider: 'BANXA',
                        }),
                    ],
                },
            }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')

        // Wait for the quote to land — the row renders a skeleton first,
        // and tapping it before then opens the sheet with no quotes.
        await waitFor(
            () => {
                expect(
                    screen.getByTestId('onramp-receive-amount').textContent,
                ).toContain('960')
            },
            { timeout: 5000 },
        )
        fireEvent.click(screen.getByTestId('onramp-provider-row'))

        // The best card quote is auto-selected, so the sheet lists the two
        // card providers — Mercuryo once, not once per payment method.
        await screen.findByTestId(
            'onramp-provider-option-quote-banxa-card',
            {},
            { timeout: 5000 },
        )
        expect(
            screen.getByTestId('onramp-provider-option-quote-mercuryo-card'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('onramp-provider-option-quote-mercuryo-apple'),
        ).toBeNull()

        // 960 ALGO at $0.50 → $480, not the $6 fee.
        expect(
            screen.getByTestId('onramp-provider-option-quote-banxa-card')
                .textContent,
        ).toContain('480')
    })

    it('Given a min-only below-minimum error, when the pill renders, then only the MIN segment shows', async () => {
        seedSelectedAccount()
        markIntroSeen()
        useOnrampStore.setState({
            selectedSourceTokenId: USD_ID,
            selectedDestinationTokenId: ALGO_ID,
        })

        server.use(
            ...buildMeldPairHandlers(),
            mockRampRegion({ response: REGION_RESPONSE }),
            mockCreateRampQuoteError({
                response: buildBelowMinQuoteErrorBody(false),
            }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')

        await screen.findByTestId('onramp-min-button', {}, { timeout: 5000 })
        expect(screen.queryByTestId('onramp-max-button')).toBeNull()
    })

    it('Given a seeded history item, when the user opens the History tab and taps the row, then the Order Details sheet opens', async () => {
        seedSelectedAccount()
        seedDeviceId()
        markIntroSeen()

        // The Fund tab still loads destinations/region on mount; stub them so the
        // screen settles, then serve the history page for the History tab.
        server.use(
            ...buildXoPairHandlers(),
            mockRampRegion({ response: REGION_RESPONSE }),
            mockRampHistory({ response: buildMeldHistoryPage() }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')

        // Switch to the History tab (the inline header toggle).
        const historyTab = await screen.findByTestId(
            'onramp-tab-history',
            {},
            { timeout: 5000 },
        )
        fireEvent.click(historyTab)

        // The seeded item renders as a row (testID keyed on the order id).
        const row = await screen.findByTestId(
            `onramp-history-item-${HISTORY_ORDER_ID}`,
            {},
            { timeout: 5000 },
        )
        expect(row).toBeTruthy()

        fireEvent.click(row)

        // Tapping the row opens the Order Details sheet; the order id is
        // surfaced both in the header and as the "Order ID" detail value.
        expect(
            await screen.findByTestId(
                'onramp-order-details',
                {},
                { timeout: 5000 },
            ),
        ).toBeTruthy()
        expect(screen.getAllByText(HISTORY_ORDER_ID).length).toBeGreaterThan(0)
    })

    it('Given mixed-status history, when the user filters by status and switches back to All, then the full list is restored', async () => {
        seedSelectedAccount()
        seedDeviceId()
        markIntroSeen()

        // Two items with distinct statuses. The router has no status filter,
        // so the list narrows the loaded items itself.
        const completedItem = buildMeldHistoryItem('h-completed', 'completed')
        const pendingItem = buildMeldHistoryItem('h-pending', 'pending')

        server.use(
            ...buildXoPairHandlers(),
            mockRampRegion({ response: REGION_RESPONSE }),
            mockRampHistory({
                response: { next: null, results: [completedItem, pendingItem] },
            }),
        )

        // Production QueryClient defaults (QueryProvider.tsx) — the
        // staleTime/gcTime combination changes refetch-on-key-switch
        // behaviour vs the zeroed test defaults.
        const prodLikeQueryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    gcTime: 60 * 60 * 1000,
                    staleTime: 60 * 1000,
                    retry: 0,
                },
            },
        })
        renderWithNavigation(OnrampScreen, 'Fund', {
            queryClient: prodLikeQueryClient,
        })

        const historyTab = await screen.findByTestId(
            'onramp-tab-history',
            {},
            { timeout: 5000 },
        )
        fireEvent.click(historyTab)

        // Unfiltered: both rows visible.
        await screen.findByTestId(
            'onramp-history-item-h-completed',
            {},
            { timeout: 5000 },
        )
        await screen.findByTestId('onramp-history-item-h-pending')

        // Filter to Pending: only the pending row remains.
        fireEvent.click(screen.getByTestId('onramp-history-filter-pending'))
        await waitFor(
            () =>
                expect(
                    screen.queryByTestId('onramp-history-item-h-completed'),
                ).toBeNull(),
            { timeout: 5000 },
        )
        // Async: the pending-filtered key loads fresh — the badge no
        // longer pre-warms it with a duplicate pending-status query.
        expect(
            await screen.findByTestId(
                'onramp-history-item-h-pending',
                {},
                { timeout: 5000 },
            ),
        ).toBeTruthy()

        // Back to All: both rows must return (regression: the list used
        // to keep showing the last filtered set).
        fireEvent.click(screen.getByTestId('onramp-history-filter-all'))
        await waitFor(
            () =>
                expect(
                    screen.queryByTestId('onramp-history-item-h-completed'),
                ).toBeTruthy(),
            { timeout: 5000 },
        )
        expect(screen.getByTestId('onramp-history-item-h-pending')).toBeTruthy()
    })

    // Drives the shared front half of the delegated flows: render, quote,
    // tap Buy, and wait for the opt-in confirmation sheet.
    const driveToOptInConfirmation = async () => {
        renderWithNavigation(OnrampScreen, 'Fund')
        await screen.findByTestId('onramp-pay-input', {}, { timeout: 5000 })
        enterPayAmount('1')
        await waitFor(
            () =>
                expect(
                    screen.getByTestId('onramp-receive-amount').textContent,
                ).toContain('999.5'),
            { timeout: 5000 },
        )
        const buyButton = () => screen.getByTestId('onramp-buy-button')
        await waitFor(() => expect(isElementDisabled(buyButton())).toBe(false))
        fireEvent.click(buyButton())
        await screen.findByTestId('opt_in_confirm', {}, { timeout: 5000 })
    }

    it('Given an underfunded un-opted-in account, when the user confirms the sponsored opt-in, then the MBR-funded delegated group is signed, submitted, and the order is placed', async () => {
        const account = await seedSignableAccount()
        markIntroSeen()
        markXoTermsAccepted()
        seedDeviceId()
        seedAttestation()
        useOnrampStore.setState({
            selectedSourceTokenId: BTC_ID,
            selectedDestinationTokenId: USDC_ID,
        })

        let feeDelegationBody: CapturedFeeDelegationBody | null = null
        const sendSpy = vi.fn(() =>
            HttpResponse.json(
                {
                    txId: 'DELEGATEDTXID000000000000000000000000000000000000000',
                },
                { status: 200 },
            ),
        )
        // Spendable balance below min-balance + MBR + fee → sponsored,
        // and below the MBR requirement → the sponsor funds the MBR too.
        installDelegatedOptInHandlers({
            accountAddress: addressOf(account),
            accountAmount: 150_000,
            sendSpy,
        })
        server.use(
            mockFeeDelegationEcho(200_000n, body => {
                feeDelegationBody = body
            }),
        )

        await driveToOptInConfirmation()

        // Sponsored opt-in → the confirmation sheet shows a ZERO fee
        // (vs '0.001' for a self-funded opt-in).
        expect(screen.getByTestId('opt_in_fee').textContent).toBe('0.00')
        // The Account row shows the receiving account (a second 'Buyer'
        // beyond the header account selector).
        expect(screen.getAllByText('Buyer').length).toBeGreaterThan(1)

        fireEvent.click(screen.getByTestId('opt_in_confirm'))

        // The unsigned zero-fee opt-in goes up with MBR funding requested.
        await waitFor(() => expect(feeDelegationBody).not.toBeNull(), {
            timeout: 10_000,
        })
        expect(feeDelegationBody).toMatchObject({
            account: addressOf(account),
            includeAssetOptInMbr: true,
            optInAssetIds: [String(USDC_MAINNET_ASSET_ID)],
        })
        expect(feeDelegationBody!.txnGroup).toHaveLength(1)

        // Sponsor + wallet-signed opt-in are submitted to algod, then the
        // order is created and the review sheet shows the pay-in address.
        await waitFor(() => expect(sendSpy).toHaveBeenCalled(), {
            timeout: 10_000,
        })
        expect(
            await screen.findByText(PAY_IN_ADDRESS, {}, { timeout: 5000 }),
        ).toBeTruthy()
    })

    it('Given an account that can cover MBR but not fees, when the user confirms the sponsored opt-in, then the fee-only delegated group is submitted and the order is placed', async () => {
        const account = await seedSignableAccount()
        markIntroSeen()
        markXoTermsAccepted()
        seedDeviceId()
        seedAttestation()
        useOnrampStore.setState({
            selectedSourceTokenId: BTC_ID,
            selectedDestinationTokenId: USDC_ID,
        })

        let feeDelegationBody: CapturedFeeDelegationBody | null = null
        const sendSpy = vi.fn(() =>
            HttpResponse.json(
                {
                    txId: 'DELEGATEDTXID000000000000000000000000000000000000000',
                },
                { status: 200 },
            ),
        )
        // 200_500 covers min-balance (100k) + MBR (100k) but not the fee
        // on top → still sponsored, but the sponsor only pools the fee
        // (0-amount self-payment; no MBR transfer to the account).
        installDelegatedOptInHandlers({
            accountAddress: addressOf(account),
            accountAmount: 200_500,
            sendSpy,
        })
        server.use(
            mockFeeDelegationEcho(0n, body => {
                feeDelegationBody = body
            }),
        )

        await driveToOptInConfirmation()
        expect(screen.getByTestId('opt_in_fee').textContent).toBe('0.00')
        fireEvent.click(screen.getByTestId('opt_in_confirm'))

        await waitFor(() => expect(feeDelegationBody).not.toBeNull(), {
            timeout: 10_000,
        })
        // MBR funding is always requested; the backend decides the amount
        // (zero here) from the account's live balance.
        expect(feeDelegationBody).toMatchObject({
            account: addressOf(account),
            includeAssetOptInMbr: true,
            optInAssetIds: [String(USDC_MAINNET_ASSET_ID)],
        })

        await waitFor(() => expect(sendSpy).toHaveBeenCalled(), {
            timeout: 10_000,
        })
        expect(
            await screen.findByText(PAY_IN_ADDRESS, {}, { timeout: 5000 }),
        ).toBeTruthy()
    })

    it('Given the sponsored opt-in confirmation is dismissed, when the sheet closes, then no delegation or order request is sent', async () => {
        const account = await seedSignableAccount()
        markIntroSeen()
        markXoTermsAccepted()
        seedDeviceId()
        seedAttestation()
        useOnrampStore.setState({
            selectedSourceTokenId: BTC_ID,
            selectedDestinationTokenId: USDC_ID,
        })

        const feeDelegationSpy = vi.fn()
        const sendSpy = vi.fn(() =>
            HttpResponse.json({ txId: 'irrelevant' }, { status: 200 }),
        )
        installDelegatedOptInHandlers({
            accountAddress: addressOf(account),
            accountAmount: 150_000,
            sendSpy,
        })
        server.use(mockFeeDelegationEcho(200_000n, feeDelegationSpy))

        await driveToOptInConfirmation()

        // Dismiss the opt-in sheet instead of confirming — the order
        // must not be sent and the form returns to an idle state.
        useBottomSheetStore.getState().dismiss()

        await waitFor(
            () =>
                expect(
                    isElementDisabled(screen.getByTestId('onramp-buy-button')),
                ).toBe(false),
            { timeout: 5000 },
        )
        expect(feeDelegationSpy).not.toHaveBeenCalled()
        expect(sendSpy).not.toHaveBeenCalled()
        expect(screen.queryByText(PAY_IN_ADDRESS)).toBeNull()
    })
})
