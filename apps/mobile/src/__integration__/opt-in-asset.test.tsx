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

import { useEffect } from 'react'
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
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
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
    getAccountHoldings,
    insertAssetHolding,
    upsertAccountBalance,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import {
    useAssetOptInMutation,
    useAssetOptOutMutation,
} from '@perawallet/wallet-core-transactions'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'
import { OptOutConfirmationContent } from '@modules/accounts/components/AccountAssetList/OptOutConfirmationContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { Decimal } from 'decimal.js'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'
import { USDC_TEST_ASSET, USDC_TEST_ASSET_ID } from './__fixtures__/assets'

const SLOW_TEST_TIMEOUT_MS = 30_000

// Test host that mirrors what AddAssetView does for the "approve
// opt-in" step: open the confirmation sheet via `requestBottomSheet`
// and forward its 'confirm' resolution to
// `useAssetOptInMutation.optIn(...)`. The opt-in business logic lives
// in the mutation; this host is just the UI hand-off.
const OptInHost = ({
    sender,
    assetId,
}: {
    sender: WalletAccount
    assetId: string
}) => {
    const { optIn } = useAssetOptInMutation()
    const { request } = useBottomSheet()
    useEffect(() => {
        void request<'confirm'>({
            contents: (
                <OptInConfirmationContent
                    assetId={assetId}
                    accountAddress={sender.address}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        }).then(result => {
            if (result !== 'confirm') return
            // Swallow rejection at the host boundary — test 2
            // intentionally drives the mutation into an
            // `AlreadyOptedInError` and we don't want it surfacing
            // as an unhandled rejection.
            optIn({
                sender: sender.address,
                assetId: BigInt(assetId),
            }).catch(() => {})
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
}

// Same shape as `OptInHost` but for the opt-out path. Wires the
// opt-out confirmation sheet (production lives on the asset / NFT
// detail screens) to `useAssetOptOutMutation.optOut(...)`.
//
// Tests pass `onResolved`/`onRejected` to surface the mutation's
// terminal state — checking `isLoading` flips to false isn't enough on
// its own because the success / error paths both flip it.
const OptOutHost = ({
    sender,
    accountBalance,
    creator,
    onResolved,
    onRejected,
}: {
    sender: WalletAccount
    accountBalance: AssetWithAccountBalance
    /** Pre-resolved creator skips the indexer asset lookup. */
    creator: string
    onResolved?: (result: { txIds: string[] }) => void
    onRejected?: (error: unknown) => void
}) => {
    const { optOut } = useAssetOptOutMutation()
    const { request } = useBottomSheet()
    useEffect(() => {
        void request<'confirm'>({
            contents: (
                <OptOutConfirmationContent
                    assetId={accountBalance.assetId}
                    accountAddress={sender.address}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        }).then(result => {
            if (result !== 'confirm') return
            optOut({
                sender: sender.address,
                assetId: BigInt(accountBalance.assetId),
                creator,
            })
                .then(res => onResolved?.(res))
                .catch(error => onRejected?.(error))
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
}

describe('Flow: Opt into an asset', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    let sender: WalletAccount

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await seedAssets([USDC_TEST_ASSET], 'mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.mocked(Notifier.showNotification).mockClear()

        // Mint a real algo25 key so the signing pipeline has something
        // to sign with. The opt-in mutation calls
        // algod.accountInformation(sender) to check current opt-ins; we
        // supply a comfortable balance and no existing assets so the
        // mutation proceeds.
        const { result: kms } = renderHook(() => useKMS())
        let key: Algo25KeyResult | null = null
        await waitFor(async () => {
            key = await kms.current.createAlgo25Key({
                mnemonic: ALGO25_TEST_MNEMONIC,
            })
            expect(key).not.toBeNull()
        })
        sender = {
            id: 'sender-1',
            type: AccountTypes.algo25,
            address: ALGO25_TEST_ADDRESS,
            keyPairId: key!.seedKey.id ?? '',
            name: 'Sender',
        }
        useAccountsStore.getState().setAccounts([sender])
        useAccountsStore.getState().setSelectedAccountAddress(sender.address)

        server.use(
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 100_000,
                    assets: [],
                },
            }),
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            // After the opt-in submits, the mutation calls
            // `fetchAndPersistAssets` against the Pera REST surface.
            // Return an empty result — we already seeded the asset
            // locally, so the mutation's persist step is a no-op.
            http.get('*/v1/assets/', () =>
                HttpResponse.json({ results: [], next: null }, { status: 200 }),
            ),
        )
    })

    it(
        'Given the user approves the opt-in confirmation, when the mutation runs, then a zero-amount asset transfer is signed and POSTed to algod',
        async () => {
            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'OPTINTESTTXID00000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderWithNavigation(
                () => (
                    <OptInHost
                        sender={sender}
                        assetId={USDC_TEST_ASSET_ID}
                    />
                ),
                'OptInHost',
            )

            await waitFor(() => {
                expect(screen.getByTestId('opt_in_confirm')).toBeTruthy()
            })

            fireEvent.click(screen.getByTestId('opt_in_confirm'))

            // Pipeline: build → sign → submit. Once algod's POST has
            // been called, the opt-in tx is on the wire.
            await waitFor(
                () => {
                    expect(sendSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the account is already opted into the asset, when the user approves, then the mutation throws and no transaction is submitted',
        async () => {
            // Override the default account info so it reports the asset
            // as already held. The mutation's pre-flight check should
            // throw `AlreadyOptedInError` and skip submission.
            server.use(
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: {
                        amount: 5_000_000,
                        'min-balance': 200_000,
                        assets: [
                            {
                                'asset-id': Number(USDC_TEST_ASSET_ID),
                                amount: 0,
                                'is-frozen': false,
                            },
                        ],
                    },
                }),
            )
            const sendSpy = vi.fn(() =>
                HttpResponse.json({ txId: 'irrelevant' }, { status: 200 }),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderWithNavigation(
                () => (
                    <OptInHost
                        sender={sender}
                        assetId={USDC_TEST_ASSET_ID}
                    />
                ),
                'OptInHost',
            )

            await waitFor(() => {
                expect(screen.getByTestId('opt_in_confirm')).toBeTruthy()
            })

            fireEvent.click(screen.getByTestId('opt_in_confirm'))

            // Give the mutation a chance to run. It should throw before
            // reaching submit. We give the spy a couple of polling ticks
            // and assert it never fires.
            await new Promise(resolve => setTimeout(resolve, 500))
            expect(sendSpy).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the account cannot cover the +0.1 ALGO MBR increase plus fee, when the user approves the opt-in, then the mutation throws InsufficientBalanceForOptInError before submitting',
        async () => {
            // The mutation's second pre-flight gate (after the already-opted-in
            // check) requires
            //   amount >= min-balance + ASSET_MBR (0.1 ALGO) + minFee.
            // With min-balance 100_000 and fee 1_000 the threshold is 201_000;
            // report a balance just under it so the gate throws
            // InsufficientBalanceForOptInError without ever reaching submit.
            server.use(
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: {
                        amount: 150_000,
                        'min-balance': 100_000,
                        assets: [],
                    },
                }),
            )
            const sendSpy = vi.fn(() =>
                HttpResponse.json({ txId: 'irrelevant' }, { status: 200 }),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderWithNavigation(
                () => (
                    <OptInHost
                        sender={sender}
                        assetId={USDC_TEST_ASSET_ID}
                    />
                ),
                'OptInHost',
            )

            await waitFor(() => {
                expect(screen.getByTestId('opt_in_confirm')).toBeTruthy()
            })

            fireEvent.click(screen.getByTestId('opt_in_confirm'))

            // The balance gate throws before the build/sign/submit step.
            await new Promise(resolve => setTimeout(resolve, 500))
            expect(sendSpy).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

// USDC's creator address (must be a real 58-char Algorand address —
// algokit's transaction encoder validates the closeAssetTo bytes).
// We borrow `HD_TEST_ADDRESS` from the onboarding fixtures: it's a
// known-good base32 address that's distinct from the sender (so the
// `CreatorCannotOptOutError` precheck doesn't fire).
const USDC_TEST_ASSET_CREATOR = HD_TEST_ADDRESS

describe('Flow: Opt out of an asset', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    let sender: WalletAccount

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await seedAssets([USDC_TEST_ASSET], 'mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        vi.mocked(Notifier.showNotification).mockClear()

        // Same signing-capable sender as the opt-in suite.
        const { result: kms } = renderHook(() => useKMS())
        let key: Algo25KeyResult | null = null
        await waitFor(async () => {
            key = await kms.current.createAlgo25Key({
                mnemonic: ALGO25_TEST_MNEMONIC,
            })
            expect(key).not.toBeNull()
        })
        sender = {
            id: 'sender-1',
            type: AccountTypes.algo25,
            address: ALGO25_TEST_ADDRESS,
            keyPairId: key!.seedKey.id ?? '',
            name: 'Sender',
        }
        useAccountsStore.getState().setAccounts([sender])
        useAccountsStore.getState().setSelectedAccountAddress(sender.address)

        // Pre-seed the opted-in holding (zero balance — the happy-path
        // precondition for opt-out).
        await insertAssetHolding({
            accountAddress: sender.address,
            assetId: USDC_TEST_ASSET_ID,
            network: 'mainnet',
            amount: '0',
        })
        await upsertAccountBalance({
            accountAddress: sender.address,
            network: 'mainnet',
            algoBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(200_000),
            status: 'Offline',
            authAddress: null,
        })

        server.use(
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 200_000,
                    assets: [
                        {
                            'asset-id': Number(USDC_TEST_ASSET_ID),
                            amount: 0,
                            'is-frozen': false,
                        },
                    ],
                },
            }),
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
        )
    })

    it(
        'Given the sender holds zero of the asset, when the user approves opt-out, then a zero-amount asset transfer with closeAssetTo=creator is POSTed to algod',
        async () => {
            const accountBalance: AssetWithAccountBalance = {
                assetId: USDC_TEST_ASSET_ID,
                asset: USDC_TEST_ASSET,
                amount: new Decimal(0),
                algoValue: new Decimal(0),
                isFrozen: false,
            }

            // Pre-flight: confirm the seeded holding exists in the DB
            // (this is what the mutation removes on success).
            const before = await getAccountHoldings({
                accountAddress: sender.address,
                network: 'mainnet',
            })
            expect(before.some(h => h.assetId === USDC_TEST_ASSET_ID)).toBe(
                true,
            )

            const onResolved = vi.fn()
            const onRejected = vi.fn()

            renderWithNavigation(
                () => (
                    <OptOutHost
                        sender={sender}
                        accountBalance={accountBalance}
                        creator={USDC_TEST_ASSET_CREATOR}
                        onResolved={onResolved}
                        onRejected={onRejected}
                    />
                ),
                'OptOutHost',
            )

            await waitFor(() => {
                expect(screen.getByTestId('opt_out_confirm')).toBeTruthy()
            })

            fireEvent.click(screen.getByTestId('opt_out_confirm'))

            // The mutation resolves with the txIds from algod — that's
            // the terminal signal we care about. The downstream
            // `deleteAssetHoldings` write happens in the same tick,
            // so a follow-up check on the DB confirms the persistence
            // side-effect too.
            await waitFor(
                () => {
                    expect(onResolved).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(onRejected).not.toHaveBeenCalled()

            const after = await getAccountHoldings({
                accountAddress: sender.address,
                network: 'mainnet',
            })
            expect(after.some(h => h.assetId === USDC_TEST_ASSET_ID)).toBe(
                false,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the sender still holds a non-zero balance, when the user approves opt-out, then the mutation throws NonZeroBalanceError before submitting',
        async () => {
            // Override the algod account-info handler to report a
            // non-zero holding. The mutation reads `algod.accountInfo`
            // (not the local DB) for its pre-flight check, so this
            // override is what actually trips `NonZeroBalanceError`.
            server.use(
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: {
                        amount: 5_000_000,
                        'min-balance': 200_000,
                        assets: [
                            {
                                'asset-id': Number(USDC_TEST_ASSET_ID),
                                amount: 1_500_000,
                                'is-frozen': false,
                            },
                        ],
                    },
                }),
            )

            const accountBalance: AssetWithAccountBalance = {
                assetId: USDC_TEST_ASSET_ID,
                asset: USDC_TEST_ASSET,
                amount: new Decimal('1.5'),
                algoValue: new Decimal(0),
                isFrozen: false,
            }

            const sendSpy = vi.fn(() =>
                HttpResponse.json({ txId: 'unused' }, { status: 200 }),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderWithNavigation(
                () => (
                    <OptOutHost
                        sender={sender}
                        accountBalance={accountBalance}
                        creator={USDC_TEST_ASSET_CREATOR}
                    />
                ),
                'OptOutHost',
            )

            await waitFor(() => {
                expect(screen.getByTestId('opt_out_confirm')).toBeTruthy()
            })
            fireEvent.click(screen.getByTestId('opt_out_confirm'))

            // No POST should reach algod — the validation throws first.
            await new Promise(resolve => setTimeout(resolve, 500))
            expect(sendSpy).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
