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

// Fund onto an Ethereum account through the real OnrampScreen, the Fund
// hooks and the Ethereum ramp adapter. Only the network (MSW) and base app
// state are seeded. The router lists destinations for every chain at once; the
// wallet shows the ones the chosen chain's adapter can read.

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
import { Linking } from 'react-native'
import { http, HttpResponse } from 'msw'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'

const RPC_URL = 'https://mainnet.rpc.test/'

// The integration setup registers whichever chains config enables, and hands
// each chain the endpoints config gives it; tests leave Ethereum's RPC unset.
// The funding state reads the overview's receive handler, which this flow doesn't mount.
vi.mock(
    '@modules/accounts/components/AccountOverview/AccountOverviewModalContext',
    () => ({
        useAccountOverviewModal: () => ({ openReceiveFundsOn: vi.fn() }),
    }),
)

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        // History is keyed by the deployment's device id; the backend mock
        // only answers the deployment of a scope through `peraDeploymentOf`.
        deploymentOf: (scope: Parameters<typeof withBackend.deploymentOf>[0]) =>
            scope === null
                ? null
                : (withBackend.peraDeploymentOf(scope) ?? null),
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : withBackend.chainEndpointsFor(chainId),
    }
})

// The router is reached through the chain's Pera deployment. The integration
// setup loads the query client before this file's config mock exists, and the
// client reads its deployments once, so everything under test is loaded afresh,
// the test theme the setup installed included. The fixtures keep the server the
// setup is listening on.
vi.resetModules()
vi.doMock('@test-utils/msw-server', () => ({ server }))
// The navigator stand-ins the setup installed were loaded before the reset; the
// screens and the navigator must share one fresh copy, or a screen's navigation
// reaches no stack.
vi.doMock(
    '@react-navigation/native',
    () => import('@test-utils/test-navigator'),
)
vi.doMock('@react-navigation/native-stack', async () => ({
    createNativeStackNavigator: (await import('@test-utils/test-navigator'))
        .createNativeStackNavigator,
}))
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { act, fireEvent, renderHook, screen, waitFor, within } =
    await import('@testing-library/react')
const { createNativeStackNavigator } =
    await import('@react-navigation/native-stack')
const { useRoute } = await import('@react-navigation/native')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { useDeviceStore } = await import('@perawallet/wallet-core-device')
const { useOnrampSigningAccounts, useOnrampStore } =
    await import('@perawallet/wallet-core-onramp')
const { useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { useSettingsStore } = await import('@perawallet/wallet-core-settings')
const {
    mockCancelRampOrder,
    mockCreateRampOrder,
    mockCreateRampQuote,
    mockRampRegion,
} = await import('@perawallet/wallet-core-onramp/test-handlers')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { createQueryClientWrapper } = await import('@test-utils/render')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { setCapabilityOverrides } =
    await import('@test-utils/capability-overrides')
const { isElementDisabled } = await import('@test-utils/rnw')
const { AssetDetailsScreen } =
    await import('@modules/assets/screens/AssetDetailsScreen')
const { useBottomSheetStore } = await import('@modules/bottom-sheet')
const { useCanFundAccount } = await import('@modules/onramp')
const { OnrampScreen } = await import('@modules/onramp/routes')
const { useNetworkFundingState } =
    await import('@modules/accounts/components/AccountAssetList/NetworkFundingState/useNetworkFundingState')
const { ETH_ADDRESS, ETH_USDC, LOOKALIKE, seedHoldings, TWO_CHAIN_ACCOUNT } =
    await import('./__fixtures__/multichainHoldings')
const { ALGO25_TEST_ADDRESS } = await import('./__fixtures__/onboarding')

const FORM_TIMEOUT = { timeout: 8000 }

const ETH_ONLY_ACCOUNT: WalletAccount = {
    id: 'eth-only',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: ETH_ADDRESS, keyPairId: 'e-key' } },
    name: 'Eth only',
}

const ETH_CAIP10 = `eip155:1:${ETH_ADDRESS}`
const ALGORAND_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const ALGORAND_CAIP10 = `${ALGORAND_CAIP2}:${ALGO25_TEST_ADDRESS}`

// The router's asset ids (CAIP-19).
const ETH_ID = 'eip155:1/slip44:60'
const USDC_ETH_ID = `eip155:1/erc20:${ETH_USDC.toLowerCase()}`
const ALGO_ID = `${ALGORAND_CAIP2}/asa:0`
const BTC_ID = 'bip122:000000000019d6689c085ae165831e93/slip44:0'
const EUR_ID = 'swift:0/iso4217:EUR'

const asset = (
    assetId: string,
    unitName: string,
    decimals: number,
    chain?: string,
) => ({
    asset_id: assetId,
    name: unitName,
    unit_name: unitName,
    fraction_decimals: decimals,
    ...(chain ? { chain } : {}),
})

const ETH_ASSET = asset(ETH_ID, 'ETH', 18)
const USDC_ETH_ASSET = asset(USDC_ETH_ID, 'USDC', 6)
const ALGO_ASSET = asset(ALGO_ID, 'ALGO', 6)
const BTC_ASSET = asset(BTC_ID, 'BTC', 8, 'Bitcoin')
const EUR_ASSET = asset(EUR_ID, 'EUR', 2)

const row = (rowAsset: ReturnType<typeof asset>, kind: string) => ({
    kind,
    asset: rowAsset,
    aggregator: 'meld',
    funding_method: 'provider_checkout',
})

// What the router lists across every chain.
const DESTINATIONS = [
    row(ALGO_ASSET, 'token'),
    row(ETH_ASSET, 'token'),
    row(USDC_ETH_ASSET, 'token'),
]

const CHECKOUT_URL = 'https://checkout.meld.test/session-1'
const PAY_IN_ADDRESS = 'bc1qpayinaddress0000000000000000000000000'
const PAY_IN_MEMO = 'MEMO-4711'
const TEST_DEVICE_ID = 'device-onramp-eth-1'
const MELD_ORDER_ID = 'meld-order-1'
const XO_ORDER_ID = 'xo-order-1'

const meldOffer = (destination: ReturnType<typeof asset>, amount: string) => ({
    quote_id: `quote-meld-${destination.unit_name}`,
    aggregator: 'meld',
    provider: 'MERCURYO',
    source_asset: EUR_ASSET,
    destination_asset: destination,
    source_amount: '10000',
    destination_amount_expected: amount,
    source_amount_usd_value: '110',
    destination_amount_usd_value: null,
    funding_method: 'provider_checkout',
    extras: { payment_method: 'CREDIT_DEBIT_CARD' },
})

const xoOffer = () => ({
    quote_id: 'quote-xo-1',
    aggregator: 'xo',
    provider: 'XO',
    source_asset: BTC_ASSET,
    destination_asset: ETH_ASSET,
    source_amount: '100000000',
    destination_amount_expected: '15000000000000000000',
    funding_method: 'external_deposit',
})

const historyItem = (
    orderId: string,
    kind: 'meld' | 'xo',
    destinationAccount: string,
) => ({
    order_id: orderId,
    aggregator: kind,
    provider: kind === 'meld' ? 'MELD' : 'XO',
    status: 'pending' as const,
    funding_method: kind === 'meld' ? 'provider_checkout' : 'external_deposit',
    destination_account: destinationAccount,
    source_asset: kind === 'meld' ? EUR_ASSET : BTC_ASSET,
    destination_asset: ETH_ASSET,
    source_amount: kind === 'meld' ? '10000' : '100000000',
    destination_amount_expected:
        kind === 'meld' ? '50000000000000000' : '15000000000000000000',
    created_at: '2026-11-01T10:00:00Z',
})

type Captured = {
    method: string
    path: string
    search: URLSearchParams
    body: Record<string, unknown> | null
}

const captured: Captured[] = []

const onRequestStart = ({ request }: { request: Request }) => {
    const { pathname, searchParams } = new URL(request.url)
    const entry: Captured = {
        method: request.method,
        path: pathname,
        search: searchParams,
        body: null,
    }
    captured.push(entry)
    if (request.method === 'GET') return
    // Cloned in the same tick, before a handler reads the body.
    void request
        .clone()
        .json()
        .then(body => {
            entry.body = body as Record<string, unknown>
        })
        .catch(() => undefined)
}

const requestsTo = (method: string, suffix: string) =>
    captured.filter(
        entry => entry.method === method && entry.path.endsWith(suffix),
    )

const lastQuoteBody = () => requestsTo('POST', '/quotes/').at(-1)?.body ?? null

// The orders the router would list for the account asked about, once placed.
const placedOrders: ReturnType<typeof historyItem>[] = []

const serveRouter = (
    options: {
        sources?: ReturnType<typeof row>[]
        offers?: ReturnType<typeof meldOffer>[]
    } = {},
) =>
    server.use(
        http.get('*/api/v4/swap/pairs/', ({ request }) => {
            const isDestinationList =
                new URL(request.url).searchParams.get('destination') === null
            return HttpResponse.json({
                next: null,
                results: isDestinationList
                    ? DESTINATIONS
                    : (options.sources ?? [row(EUR_ASSET, 'fiat')]),
            })
        }),
        mockRampRegion({
            response: { country_code: 'DE', country_name: 'Germany' },
        }),
        http.get('*/api/v4/swap/history/', ({ request }) => {
            const accounts = new URL(request.url).searchParams.get('accounts')
            return HttpResponse.json({
                next: null,
                results: placedOrders.filter(
                    order => order.destination_account === accounts,
                ),
            })
        }),
    )

const markIntroSeen = () =>
    useSettingsStore.getState().setPreference('onramp-introduction-seen', true)

const markXoTermsAccepted = () =>
    useSettingsStore.getState().setPreference('onramp-xo-terms-accepted', true)

const selectAccount = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

const enterPayAmount = (value: string) =>
    fireEvent.change(screen.getByTestId('onramp-pay-input'), {
        target: { value },
    })

const waitForReceiveAmount = (text: string) =>
    waitFor(
        () =>
            expect(
                screen.getByTestId('onramp-receive-amount').textContent,
            ).toContain(text),
        FORM_TIMEOUT,
    )

const clickBuy = async () => {
    const buyButton = () => screen.getByTestId('onramp-buy-button')
    await waitFor(() => expect(isElementDisabled(buyButton())).toBe(false), {
        timeout: 8000,
    })
    fireEvent.click(buyButton())
}

// A stand-in for the tab bar, with the Fund tab as its own navigator, as in the app.
const FundTabs = createNativeStackNavigator()
const TabBarWithFund = () => {
    const route = useRoute() as unknown as {
        params?: { params?: Record<string, unknown> }
    }
    return (
        <FundTabs.Navigator initialRouteName='Fund'>
            <FundTabs.Screen
                name='Fund'
                component={OnrampScreen}
                initialParams={route.params?.params}
            />
        </FundTabs.Navigator>
    )
}

const renderAssetDetails = (assetId: string) =>
    renderWithNavigation(AssetDetailsScreen, 'AssetDetails', {
        initialParams: { assetId, chainId: 'ethereum' },
        additionalScreens: [{ name: 'TabBar', component: TabBarWithFund }],
    })

describe('Flow: Fund an Ethereum account', () => {
    // Background fetches the flows don't exercise (balances, prices) stay unmocked.
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        captured.length = 0
        placedOrders.length = 0
        server.events.on('request:start', onRequestStart)
        useAccountsStore.getState().setAccounts([])
        useOnrampStore.getState().resetState()
        useSettingsStore.setState({ preferences: {} })
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('live', TEST_DEVICE_ID)
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        await useRemoteConfigStore.persist.rehydrate()
        await resetTestDatabase()
        await seedHoldings()
        vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
        markIntroSeen()
    })

    afterEach(() => {
        server.events.removeListener('request:start', onRequestStart)
        vi.restoreAllMocks()
        useRemoteConfigStore.getState().resetState()
    })

    it('Given an Ethereum account, when it buys ETH with EUR, then it is quoted to its address, the checkout opens in the system browser, and the order is found in history by that address', async () => {
        selectAccount(ETH_ONLY_ACCOUNT)
        useOnrampStore.setState({
            selectedSourceTokenId: EUR_ID,
            selectedDestinationTokenId: ETH_ID,
        })
        serveRouter()
        server.use(
            mockCreateRampQuote({
                response: {
                    results: [meldOffer(ETH_ASSET, '50000000000000000')],
                },
            }),
            mockCreateRampOrder({
                response: {
                    order_id: MELD_ORDER_ID,
                    status: 'pending',
                    steps: [{ kind: 'open_checkout', url: CHECKOUT_URL }],
                },
            }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')
        await screen.findByTestId('onramp-pay-input', {}, FORM_TIMEOUT)
        await waitForReceiveAmount('0.05')

        expect(requestsTo('GET', '/pairs/').length).toBeGreaterThan(0)
        expect(lastQuoteBody()).toMatchObject({
            destination_asset_id: ETH_ID,
            destination_account: ETH_CAIP10,
            source_asset_id: EUR_ID,
        })

        await clickBuy()

        await waitFor(() =>
            expect(Linking.openURL).toHaveBeenCalledWith(CHECKOUT_URL),
        )
        // Ethereum needs no opt-in before buying.
        expect(screen.queryByTestId('opt_in_confirm')).toBeNull()

        placedOrders.push(historyItem(MELD_ORDER_ID, 'meld', ETH_CAIP10))
        fireEvent.click(screen.getByTestId('onramp-tab-history'))

        expect(
            await screen.findByTestId(
                `onramp-history-item-${MELD_ORDER_ID}`,
                {},
                FORM_TIMEOUT,
            ),
        ).toBeTruthy()
        const historyRequest = requestsTo('GET', '/history/').at(-1)
        expect(historyRequest?.search.get('accounts')).toBe(ETH_CAIP10)
        expect(historyRequest?.search.get('device_id')).toBe(TEST_DEVICE_ID)
    })

    it('Given an Ethereum account, when it buys ETH with BTC through XO, then the deposit address and memo are shown and the order is found in history by its address', async () => {
        selectAccount(ETH_ONLY_ACCOUNT)
        markXoTermsAccepted()
        useOnrampStore.setState({
            selectedSourceTokenId: BTC_ID,
            selectedDestinationTokenId: ETH_ID,
        })
        serveRouter({ sources: [row(BTC_ASSET, 'deposit')] })
        server.use(
            mockCreateRampQuote({ response: { results: [xoOffer()] } }),
            mockCreateRampOrder({
                response: {
                    order_id: XO_ORDER_ID,
                    status: 'pending',
                    steps: [
                        {
                            kind: 'deposit_instructions',
                            address: PAY_IN_ADDRESS,
                            memo: PAY_IN_MEMO,
                        },
                    ],
                },
            }),
        )

        renderWithNavigation(OnrampScreen, 'Fund')
        await screen.findByTestId('onramp-pay-input', {}, FORM_TIMEOUT)
        enterPayAmount('1')
        await waitForReceiveAmount('15')

        expect(lastQuoteBody()).toMatchObject({
            destination_asset_id: ETH_ID,
            destination_account: ETH_CAIP10,
        })

        await clickBuy()

        expect(
            await screen.findByText(PAY_IN_ADDRESS, {}, FORM_TIMEOUT),
        ).toBeTruthy()
        expect(screen.getByText(PAY_IN_MEMO)).toBeTruthy()
        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(screen.queryByTestId('opt_in_confirm')).toBeNull()

        // The deposit is made outside the wallet; closing the review lands on History.
        placedOrders.push(historyItem(XO_ORDER_ID, 'xo', ETH_CAIP10))
        act(() => useBottomSheetStore.getState().dismiss())

        expect(
            await screen.findByTestId(
                `onramp-history-item-${XO_ORDER_ID}`,
                {},
                FORM_TIMEOUT,
            ),
        ).toBeTruthy()
        expect(
            requestsTo('GET', '/history/').at(-1)?.search.get('accounts'),
        ).toBe(ETH_CAIP10)
    })

    describe('Buy on an ERC-20', () => {
        it('Given a token the router lists, when Buy is pressed on its asset detail, then Fund opens with that token selected over a remembered one and the quote goes to the account address', async () => {
            selectAccount(TWO_CHAIN_ACCOUNT)
            useOnrampStore.setState({
                selectedSourceTokenId: EUR_ID,
                selectedDestinationTokenId: ETH_ID,
                selectedChainId: 'algorand',
            })
            serveRouter()
            server.use(
                mockCreateRampQuote({
                    response: {
                        results: [meldOffer(USDC_ETH_ASSET, '9000000')],
                    },
                }),
            )

            renderAssetDetails(ETH_USDC)
            fireEvent.click(
                await screen.findByTestId(
                    'asset_detail_buy_button',
                    {},
                    FORM_TIMEOUT,
                ),
            )

            await screen.findByTestId('onramp-pay-input', {}, FORM_TIMEOUT)
            await waitForReceiveAmount('9')

            expect(useOnrampStore.getState().selectedChainId).toBe('ethereum')
            expect(useOnrampStore.getState().selectedDestinationTokenId).toBe(
                USDC_ETH_ID,
            )
            expect(lastQuoteBody()).toMatchObject({
                destination_asset_id: USDC_ETH_ID,
                destination_account: ETH_CAIP10,
            })
        })

        it("Given a token the router doesn't list, then its asset detail offers no Buy", async () => {
            selectAccount(ETH_ONLY_ACCOUNT)
            serveRouter()

            renderAssetDetails(LOOKALIKE)

            await screen.findByTestId('asset_detail_receive_button')
            await waitFor(() =>
                expect(requestsTo('GET', '/pairs/').length).toBeGreaterThan(0),
            )
            await act(() => new Promise(resolve => setTimeout(resolve, 100)))
            expect(screen.queryByTestId('asset_detail_buy_button')).toBeNull()
        })
    })

    describe('An account on both Algorand and Ethereum', () => {
        const pickReceiveToken = async (chain: string, tokenId: string) => {
            // The pay and receive selectors share a testID; receive comes second.
            fireEvent.click(screen.getAllByTestId('onramp-pair-selector')[1])
            fireEvent.click(
                await screen.findByTestId(
                    `onramp_destination_chain_${chain}`,
                    {},
                    FORM_TIMEOUT,
                ),
            )
            fireEvent.click(
                await screen.findByTestId(
                    `onramp-asset-row-${tokenId}`,
                    {},
                    FORM_TIMEOUT,
                ),
            )
        }

        it('can fund onto either chain, each quoted to its own address', async () => {
            selectAccount(TWO_CHAIN_ACCOUNT)
            useOnrampStore.setState({ selectedSourceTokenId: EUR_ID })
            serveRouter()
            server.use(
                mockCreateRampQuote({
                    response: {
                        results: [
                            meldOffer(ALGO_ASSET, '300000000'),
                            meldOffer(ETH_ASSET, '50000000000000000'),
                        ],
                    },
                }),
            )

            renderWithNavigation(OnrampScreen, 'Fund')
            await screen.findByTestId('onramp-pay-input', {}, FORM_TIMEOUT)
            await waitFor(
                () =>
                    expect(lastQuoteBody()).toMatchObject({
                        destination_asset_id: ALGO_ID,
                        destination_account: ALGORAND_CAIP10,
                    }),
                FORM_TIMEOUT,
            )

            await pickReceiveToken('ethereum', ETH_ID)
            await waitFor(
                () =>
                    expect(lastQuoteBody()).toMatchObject({
                        destination_asset_id: ETH_ID,
                        destination_account: ETH_CAIP10,
                    }),
                FORM_TIMEOUT,
            )
            expect(useOnrampStore.getState().selectedChainId).toBe('ethereum')

            await pickReceiveToken('algorand', ALGO_ID)
            await waitFor(
                () =>
                    expect(lastQuoteBody()).toMatchObject({
                        destination_asset_id: ALGO_ID,
                        destination_account: ALGORAND_CAIP10,
                    }),
                FORM_TIMEOUT,
            )
            expect(useOnrampStore.getState().selectedChainId).toBe('algorand')
        })

        it('lists each token with the chain it arrives on', async () => {
            selectAccount(TWO_CHAIN_ACCOUNT)
            serveRouter()

            renderWithNavigation(OnrampScreen, 'Fund')
            await screen.findByTestId('onramp-pay-input', {}, FORM_TIMEOUT)
            fireEvent.click(screen.getAllByTestId('onramp-pair-selector')[1])
            fireEvent.click(
                await screen.findByTestId(
                    'onramp_destination_chain_ethereum',
                    {},
                    FORM_TIMEOUT,
                ),
            )

            const usdcRow = await screen.findByTestId(
                `onramp-asset-row-${USDC_ETH_ID}`,
                {},
                FORM_TIMEOUT,
            )
            expect(
                within(usdcRow).getByTestId('chain_label_ethereum'),
            ).toBeTruthy()
            expect(
                screen.queryByTestId(`onramp-asset-row-${ALGO_ID}`),
            ).toBeNull()
        })
    })

    describe('Cancelling an order', () => {
        const placeXoOrder = async () => {
            selectAccount(ETH_ONLY_ACCOUNT)
            markXoTermsAccepted()
            useOnrampStore.setState({
                selectedSourceTokenId: BTC_ID,
                selectedDestinationTokenId: ETH_ID,
            })
            serveRouter({ sources: [row(BTC_ASSET, 'deposit')] })
            server.use(
                mockCreateRampQuote({ response: { results: [xoOffer()] } }),
                mockCreateRampOrder({
                    response: {
                        order_id: XO_ORDER_ID,
                        status: 'pending',
                        steps: [
                            {
                                kind: 'deposit_instructions',
                                address: PAY_IN_ADDRESS,
                                memo: PAY_IN_MEMO,
                            },
                        ],
                    },
                }),
            )
            renderWithNavigation(OnrampScreen, 'Fund')
            await screen.findByTestId('onramp-pay-input', {}, FORM_TIMEOUT)
            enterPayAmount('1')
            await waitForReceiveAmount('15')
            await clickBuy()
            await screen.findByText(PAY_IN_ADDRESS, {}, FORM_TIMEOUT)
        }

        it('Given a pending order placed on this device, when the user cancels it, then the router is asked to cancel it and the review closes', async () => {
            await placeXoOrder()
            server.use(
                mockCancelRampOrder({
                    response: {
                        ...historyItem(XO_ORDER_ID, 'xo', ETH_CAIP10),
                        status: 'cancelled',
                    },
                }),
            )

            fireEvent.click(screen.getByTestId('onramp-cancel-order'))
            fireEvent.click(
                await screen.findByTestId('onramp-cancel-order-confirm'),
            )

            await waitFor(() =>
                expect(
                    requestsTo('PATCH', `/orders/${XO_ORDER_ID}/`),
                ).toHaveLength(1),
            )
            expect(
                requestsTo('PATCH', `/orders/${XO_ORDER_ID}/`)[0].body,
            ).toEqual({ status: 'cancelled' })
            await waitFor(() =>
                expect(screen.queryByText(PAY_IN_ADDRESS)).toBeNull(),
            )
        })

        it('Given the provider no longer allows it, when the user cancels, then the order stays open', async () => {
            await placeXoOrder()
            server.use(
                mockCancelRampOrder({
                    response: {
                        error: 'The order can no longer be cancelled.',
                        code: 'order_not_cancellable',
                    },
                    status: 409,
                }),
            )

            fireEvent.click(screen.getByTestId('onramp-cancel-order'))
            fireEvent.click(
                await screen.findByTestId('onramp-cancel-order-confirm'),
            )

            await waitFor(() =>
                expect(
                    requestsTo('PATCH', `/orders/${XO_ORDER_ID}/`),
                ).toHaveLength(1),
            )
            await act(() => new Promise(resolve => setTimeout(resolve, 100)))
            expect(screen.getByText(PAY_IN_ADDRESS)).toBeTruthy()
        })
    })

    describe('Switching onramp off for Ethereum', () => {
        it('Given onramp is off in the Ethereum override, then no Fund entry point is left for an Ethereum account', async () => {
            selectAccount(ETH_ONLY_ACCOUNT)
            serveRouter()
            setCapabilityOverrides({ onramp: false }, 'ethereum')

            const { result: canFund } = renderHook(
                () => useCanFundAccount(ETH_ONLY_ACCOUNT),
                { wrapper: createQueryClientWrapper() },
            )
            const { result: funding } = renderHook(
                () =>
                    useNetworkFundingState({
                        account: ETH_ONLY_ACCOUNT,
                        chainId: 'ethereum',
                    }),
                { wrapper: createQueryClientWrapper() },
            )
            const { result: signers } = renderHook(
                () => useOnrampSigningAccounts(),
                { wrapper: createQueryClientWrapper() },
            )

            expect(canFund.current).toBe(false)
            expect(funding.current.canBuy).toBe(false)
            expect(signers.current).toEqual([])
        })

        it('Given onramp is off, then the asset detail of an Ethereum token has no Buy', async () => {
            selectAccount(ETH_ONLY_ACCOUNT)
            serveRouter()
            setCapabilityOverrides({ onramp: false }, 'ethereum')

            renderAssetDetails(ETH_USDC)

            await screen.findByTestId('asset_detail_receive_button')
            expect(screen.queryByTestId('asset_detail_buy_button')).toBeNull()
            expect(requestsTo('GET', '/pairs/')).toHaveLength(0)
        })

        it('Given onramp is off, then the Fund screen says the account cannot be funded', async () => {
            selectAccount(ETH_ONLY_ACCOUNT)
            serveRouter()
            setCapabilityOverrides({ onramp: false }, 'ethereum')

            renderWithNavigation(OnrampScreen, 'Fund')

            expect(
                await screen.findByText('onramp.account_unsupported.title'),
            ).toBeTruthy()
            expect(screen.queryByTestId('onramp-pay-input')).toBeNull()
        })
    })
})
