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

import React, { useEffect } from 'react'
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
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Notifier } from 'react-native-notifier'
import { Decimal } from 'decimal.js'

import { server, http, HttpResponse } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAssets,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import type { Arc59AssetRequest } from '@perawallet/wallet-core-asa-inbox'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { useClaimAssetsStore } from '@modules/transactions/hooks/claim-assets/useClaimAssets'
import { AssetTransferRequestsScreen } from '@modules/transactions/screens/claim-assets/AssetTransferRequestsScreen/AssetTransferRequestsScreen'
import { AssetClaimDetailScreen } from '@modules/transactions/screens/claim-assets/AssetClaimDetailScreen/AssetClaimDetailScreen'
import { ClaimProcessingScreen } from '@modules/transactions/screens/claim-assets/ClaimProcessingScreen/ClaimProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
} from './__fixtures__/onboarding'
import { modelsv2, encodeMsgpack, decodeMsgpack } from 'algosdk'

// AlgoKit's transaction composer auto-runs a `POST /v2/transactions/simulate`
// (msgpack) to populate app-call resources whenever the group contains an app
// call — which every ARC-59 claim/reject group does. There is no shared handler
// factory for it, so we synthesize a faithful success response by echoing the
// request's own transactions back (no extra resources to populate → the group
// is built and submitted as-is), decoding the request and encoding the response
// through algosdk's `modelsv2` simulate types so the bytes round-trip through
// the same codec the client uses.

// The claim flow hops through the Messages stack with
// `push('Messages', { screen, params })`, but the test navigator is a single
// FLAT stack that doesn't forward into a child navigator. So all four screens
// are registered flat behind a tiny `Messages` dispatcher that flat-replaces
// itself with `route.params.screen`, reproducing the nested forwarding.
//
// `PWSlideToConfirm` is mocked as a <button> whose onClick is onConfirm — the
// pan gesture itself is unreachable under the gesture-handler mock.

const SENDER_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

const INBOX_ADDRESS =
    'OJVMSUIFJXMRWFSFG2CPPWMFTWXRXN3J42PZATE24FVKU4Q43DPCZXEA24'

const ASSET_ID = '741234567'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The list screen's GET endpoint returns the *raw* (snake_case) ARC-59 shape;
// `fetchArc59AssetRequests` runs it through the real zod schema + transformer,
// so this must be schema-valid. The asa-inbox `mockArc59AssetRequests` factory
// is NOT aliased into apps/mobile (no `@perawallet/wallet-core-asa-inbox/test-handlers`
// entry in vitest.config.ts / tsconfig.json), so we register the handler with a
// plain `http.get` instead.
const rawAssetRequestsResponse = {
    inbox_address: INBOX_ADDRESS,
    results: [
        {
            total_amount: '250',
            asset: {
                asset_id: ASSET_ID,
                name: 'Test Asset',
                logo: null,
                unit_name: 'TST',
                fraction_decimals: 0,
                usd_value: '1.5',
                verification_tier: 'verified',
                is_verified: true,
                is_deleted: false,
                collectible: null,
                creator: { address: SENDER_ADDRESS },
                type: 'standard_asset' as const,
            },
            algo_gain_on_claim: '0',
            algo_gain_on_reject: '100000',
            senders: {
                count: 1,
                results: [
                    {
                        sender: { address: SENDER_ADDRESS, name: 'Alice' },
                        amount: '250',
                    },
                ],
            },
            insufficient_algo_for_claiming: false,
            insufficient_algo_for_rejecting: false,
            should_use_funds_before_claiming: false,
            should_use_funds_before_rejecting: false,
        },
    ],
}

// The claimed asset, in the in-app domain shape, used both to (a) seed the DB
// so the list item's `useSingleAssetDetailsQuery` resolves locally instead of
// hitting the asset API, and (b) build the `Arc59AssetRequest` the store needs
// for tests that start at the detail screen.
const CLAIMED_ASSET: PeraAsset = {
    assetId: ASSET_ID,
    name: 'Test Asset',
    unitName: 'TST',
    decimals: 0,
    totalSupply: new Decimal(0),
    creator: { address: SENDER_ADDRESS },
    peraMetadata: {
        verificationTier: 'verified',
        isVerified: true,
        isDeleted: false,
        logo: null,
    },
}

// A domain-shaped request matching `rawAssetRequestsResponse` after transform.
// `overrides` lets the financial-guard test flip the relevant flags.
const buildAssetRequest = (
    overrides: Partial<Arc59AssetRequest> = {},
): Arc59AssetRequest => ({
    id: ASSET_ID,
    inboxAddress: INBOX_ADDRESS,
    totalAmount: new Decimal(250),
    asset: CLAIMED_ASSET,
    usdValue: new Decimal('1.5'),
    microAlgoGainOnClaim: new Decimal(0),
    microAlgoGainOnReject: new Decimal(100_000),
    senders: {
        count: 1,
        results: [
            {
                sender: { address: SENDER_ADDRESS, name: 'Alice' },
                amount: new Decimal(250),
            },
        ],
    },
    insufficientAlgoForClaiming: false,
    insufficientAlgoForRejecting: false,
    shouldUseFundsBeforeClaiming: false,
    shouldUseFundsBeforeRejecting: false,
    ...overrides,
})

// Mint a real algo25 key in the in-memory keystore from the pinned mnemonic
// and register the matching account — the signing pipeline needs a real key to
// produce a valid signature for the ARC-59 app-call group.
const seedClaimingAccount = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(keyResult).not.toBeNull()
    })

    const account: WalletAccount = {
        id: 'claimer-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: keyResult!.seedKey.id ?? '',
        name: 'Claimer',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountAddress(account.address)
    return account
}

// Counts invocations of the simulate handler below so tests can assert on
// it directly: the ARC-59 claim/reject builders (Tasks 4-6) attach explicit
// resource refs and call `buildGroup` (no simulate) whenever the inbox
// address is known, falling back to `buildPopulatedGroup` (one simulate
// call) only when it is null. Reset per test in `beforeEach`.
let simulateCallCount = 0

// Echoes a successful, resource-free simulate result for every transaction in
// the request group, so AlgoKit's `composer.build()` resource-population step
// resolves and the group proceeds to signing + submission.
const mockAlgodSimulate = () =>
    http.post('*/v2/transactions/simulate', async ({ request }) => {
        simulateCallCount += 1
        const reqBytes = new Uint8Array(await request.arrayBuffer())
        const decoded = decodeMsgpack(reqBytes, modelsv2.SimulateRequest)
        const response = new modelsv2.SimulateResponse({
            version: 2n,
            lastRound: decoded.round ?? 1n,
            txnGroups: decoded.txnGroups.map(
                group =>
                    new modelsv2.SimulateTransactionGroupResult({
                        txnResults: group.txns.map(
                            stxn =>
                                new modelsv2.SimulateTransactionResult({
                                    txnResult:
                                        new modelsv2.PendingTransactionResponse(
                                            { poolError: '', txn: stxn },
                                        ),
                                }),
                        ),
                    }),
            ),
        })
        const responseBytes = encodeMsgpack(response)
        return HttpResponse.arrayBuffer(
            responseBytes.buffer.slice(
                responseBytes.byteOffset,
                responseBytes.byteOffset + responseBytes.byteLength,
            ) as ArrayBuffer,
            { headers: { 'content-type': 'application/msgpack' } },
        )
    })

const HomeStub = () => <View testID='claim-flow-home' />

// Stand-in for production's nested `Messages` navigator under the flat test
// navigator: forwards `push('Messages', { screen, params })` to the named flat
// screen so the child route mounts with the right params.
const MessagesDispatcher = () => {
    // Under the integration test navigator, `useNavigation()` exposes
    // `replace`; the production stack types don't, so cast to the bit we use.
    const navigation = useNavigation() as unknown as {
        replace: (name: string, params?: Record<string, unknown>) => void
    }
    const route = useRoute() as {
        params?: { screen?: string; params?: Record<string, unknown> }
    }
    const targetScreen = route.params?.screen
    const targetParams = route.params?.params
    useEffect(() => {
        if (targetScreen) {
            navigation.replace(targetScreen, targetParams ?? {})
        }
        // Forward exactly once on mount; the dispatcher is transient.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
}

// Flat claim-flow stack. The first screen is the initial route; the dispatcher
// + the remaining claim screens + a TabBar stub (the "finished" reset target)
// are registered alongside so every real navigation hop resolves.
const renderClaimFlow = (
    initialRoute: 'AssetTransferRequests' | 'AssetClaimDetail',
) => {
    const claimScreens = [
        {
            name: 'AssetTransferRequests',
            component: AssetTransferRequestsScreen,
            // The list is scoped to the *claimer* (receiver) account — the one
            // whose key we hold and whose inbox the ARC-59 requests endpoint is
            // keyed by. Senders live inside each request's `senders` list.
            params: { item: { address: ALGO25_TEST_ADDRESS } },
        },
        {
            name: 'AssetClaimDetail',
            component: AssetClaimDetailScreen,
            params: { assetIndex: 0 },
        },
        { name: 'ClaimProcessing', component: ClaimProcessingScreen },
        { name: 'ClaimSuccess', component: TransactionSuccessScreen },
    ] as const

    const primary = claimScreens.find(s => s.name === initialRoute)!
    const rest = claimScreens.filter(s => s.name !== initialRoute)

    return renderWithNavigation(primary.component, primary.name, {
        initialParams: 'params' in primary ? primary.params : undefined,
        additionalScreens: [
            { name: 'Messages', component: MessagesDispatcher },
            ...rest.map(s => ({
                name: s.name,
                component: s.component,
                ...('params' in s ? { params: s.params } : {}),
            })),
            { name: 'TabBar', component: HomeStub },
        ],
    })
}

describe('Flow: Inbound ARC-59 asset claim (Requests → Detail → Processing → Success)', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        // The list item resolves its asset from the DB before falling back to
        // the asset API — seed it so the row renders without a network call.
        await seedAssets([CLAIMED_ASSET], 'mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useClaimAssetsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        simulateCallCount = 0

        // Algod surface for the ARC-59 claim/reject build + sign + submit
        // pipeline. `buildClaimAssetTxs` calls getSuggestedParams (params) and
        // accountInformation(sender) for its opt-in check; the signing
        // pipeline POSTs the signed group to /v2/transactions.
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSimulate(),
            mockAlgodSendRawTransaction(),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given an inbound request in the list, when the user taps it and confirms the claim, then the ARC-59 claim group is signed, POSTed to algod, and the success screen renders',
        async () => {
            const account = await seedClaimingAccount()

            // The list screen reads requests for the claimer account via the
            // ARC-59 requests endpoint. Register it directly (the asa-inbox
            // `mockArc59AssetRequests` factory isn't aliased into apps/mobile).
            server.use(
                http.get(
                    `*/v1/asa-inboxes/requests/${ALGO25_TEST_ADDRESS}/`,
                    () =>
                        HttpResponse.json(rawAssetRequestsResponse, {
                            status: 200,
                        }),
                ),
            )

            // Spy on the submission so we can prove the pipeline reached algod
            // with the signed ARC-59 claim group.
            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'CLAIMTXID000000000000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderClaimFlow('AssetTransferRequests')

            // The list resolves once the requests query returns; the row shows
            // the asset name. Tapping it pushes into the claim detail screen.
            await waitFor(
                () => {
                    expect(screen.getByText('Test Asset')).toBeTruthy()
                },
                { timeout: 5000 },
            )
            fireEvent.click(screen.getByText('Test Asset'))

            // Claim detail renders the slide-to-confirm (mocked as a button).
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arc59_claim_confirm_slide'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            fireEvent.click(screen.getByTestId('arc59_claim_confirm_slide'))

            // ClaimProcessing kicks off the claim in a useEffect; success
            // renders once algod accepts the submission.
            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            // The signed ARC-59 claim group reached algod — the load-bearing
            // assertion that the build + sign chain produced a valid group.
            expect(sendSpy).toHaveBeenCalled()
            const calls = sendSpy.mock.calls as unknown as Array<
                [{ request: Request }]
            >
            const body = await calls[0][0].request.arrayBuffer()
            // A real signed app-call group is well over a few bytes.
            expect(body.byteLength).toBeGreaterThan(50)
            expect(account.address).toBe(ALGO25_TEST_ADDRESS)

            // Core Task 4-6 guarantee: with an inbox address on record, the
            // claim group is built via explicit resource refs (`buildGroup`)
            // and never falls back to a live `/v2/transactions/simulate`
            // call.
            expect(simulateCallCount).toBe(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an inbound request with no inbox address on record, when the user confirms the claim, then the claim group is populated via a live simulate call and the success screen still renders',
        async () => {
            await seedClaimingAccount()

            // Same requests endpoint as the happy path, but the router
            // reports no known inbox address for this receiver yet — the
            // builders must fall back to `buildPopulatedGroup`, which calls
            // simulate exactly once to populate resources.
            server.use(
                http.get(
                    `*/v1/asa-inboxes/requests/${ALGO25_TEST_ADDRESS}/`,
                    () =>
                        HttpResponse.json(
                            {
                                ...rawAssetRequestsResponse,
                                inbox_address: null,
                            },
                            { status: 200 },
                        ),
                ),
            )

            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'FALLBACKTXID00000000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderClaimFlow('AssetTransferRequests')

            await waitFor(
                () => {
                    expect(screen.getByText('Test Asset')).toBeTruthy()
                },
                { timeout: 5000 },
            )
            fireEvent.click(screen.getByText('Test Asset'))

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arc59_claim_confirm_slide'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            fireEvent.click(screen.getByTestId('arc59_claim_confirm_slide'))

            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            expect(sendSpy).toHaveBeenCalled()
            // Fallback path: exactly one simulate call to populate resources.
            expect(simulateCallCount).toBe(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the claim detail screen, when the user rejects and confirms the warning sheet, then a reject group is signed, POSTed to algod, and the success screen renders',
        async () => {
            await seedClaimingAccount()
            // Reject reads the request from the store; start at the detail
            // screen with the store pre-populated the way the list tap would.
            useClaimAssetsStore
                .getState()
                .setAccountAddress(ALGO25_TEST_ADDRESS)
            useClaimAssetsStore
                .getState()
                .setAssetRequests([buildAssetRequest()])

            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'REJECTTXID00000000000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderClaimFlow('AssetClaimDetail')

            // The detail screen's reject trigger (a link button). i18n returns
            // raw keys in tests, so it renders as `arc59.claim.reject`; the
            // sheet's confirm/cancel use the distinct `messages.claim.*` keys.
            await waitFor(
                () => {
                    expect(screen.getByText('arc59.claim.reject')).toBeTruthy()
                },
                { timeout: 5000 },
            )
            fireEvent.click(screen.getByText('arc59.claim.reject'))

            // The reject confirmation sheet (ConfirmActionContent) renders via
            // the BottomSheetManager that renderWithNavigation mounts.
            await waitFor(
                () => {
                    expect(
                        screen.getByText('messages.claim.reject'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            fireEvent.click(screen.getByText('messages.claim.reject'))

            // Confirming pushes ClaimProcessing in rejectArc59 mode, which
            // builds + signs + submits the reject group and lands on success.
            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 15_000 },
            )

            expect(sendSpy).toHaveBeenCalled()
            const calls = sendSpy.mock.calls as unknown as Array<
                [{ request: Request }]
            >
            const body = await calls[0][0].request.arrayBuffer()
            expect(body.byteLength).toBeGreaterThan(50)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a request flagged insufficientAlgoForClaiming, when the user confirms the claim, then an error toast fires and nothing is submitted to algod',
        async () => {
            await seedClaimingAccount()
            useClaimAssetsStore
                .getState()
                .setAccountAddress(ALGO25_TEST_ADDRESS)
            // The guard in useAssetClaimDetailScreen.handleClaim blocks only
            // when insufficientAlgoForClaiming AND NOT shouldUseFundsBeforeClaiming.
            useClaimAssetsStore.getState().setAssetRequests([
                buildAssetRequest({
                    insufficientAlgoForClaiming: true,
                    shouldUseFundsBeforeClaiming: false,
                }),
            ])

            const sendSpy = vi.fn(() =>
                HttpResponse.json({ txId: 'unused' }, { status: 200 }),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderClaimFlow('AssetClaimDetail')

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('arc59_claim_confirm_slide'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            fireEvent.click(screen.getByTestId('arc59_claim_confirm_slide'))

            // The guard short-circuits with an error toast — algod is never
            // touched and the flow stays on the detail screen.
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 5000 },
            )
            expect(sendSpy).not.toHaveBeenCalled()
            expect(
                screen.queryByTestId('arc59_claim_confirm_slide'),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
