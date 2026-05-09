/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    upsertAccountBalance,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { AccountHistory } from '@modules/accounts/components/AccountHistory/AccountHistory'
import { TransactionDetailsScreen } from '@modules/signing/screens/TransactionDetailsScreen/TransactionDetailsScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30000

const ACCOUNT: WalletAccount = {
    id: 'observer-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'observer-key',
    name: 'Observer',
}

// Two pinned transactions seeded directly into the on-device DB. The
// production sync service writes the same shape from indexer
// responses; here we author them so the test doesn't depend on remote
// fixtures. Stable txIds so the details screen can look one up.
const TX_PAYMENT: TransactionHistoryItem = {
    id: 'TXPAYMENT0000000000000000000000000000000000000000000001',
    txType: 'pay',
    sender: ALGO25_TEST_ADDRESS,
    receiver: HD_TEST_ADDRESS,
    confirmedRound: 100,
    roundTime: 1_700_000_000,
    swapGroupDetail: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(1_000_000), // 1 ALGO
    closeTo: null,
    asset: null,
    applicationId: null,
    innerTransactionCount: null,
}

const TX_ASSET_TRANSFER: TransactionHistoryItem = {
    id: 'TXASSETTRANSFER000000000000000000000000000000000000002',
    txType: 'axfer',
    sender: HD_TEST_ADDRESS,
    receiver: ALGO25_TEST_ADDRESS,
    confirmedRound: 99,
    roundTime: 1_699_900_000,
    swapGroupDetail: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(2_500_000),
    closeTo: null,
    asset: {
        assetId: 31566704,
        name: 'USD Coin',
        unitName: 'USDC',
        decimals: 6,
    },
    applicationId: null,
    innerTransactionCount: null,
}

describe('Flow: View transactions → tap into details', () => {
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

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountAddress(ACCOUNT.address)
        vi.mocked(Notifier.showNotification).mockClear()

        // Account balance row so the history hook has something to
        // anchor its query against.
        await upsertAccountBalance({
            accountAddress: ACCOUNT.address,
            network: 'mainnet',
            algoBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(100_000),
            status: 'Offline',
            authAddress: null,
        })

        // Seed two transactions for the observer account. The history
        // hook reads page 1 from the local DB, so this is enough for
        // the list to render without touching the network.
        await upsertTransactions({
            items: [TX_PAYMENT, TX_ASSET_TRANSFER],
            accountAddress: ACCOUNT.address,
            network: 'mainnet',
        })
    })

    it(
        'Given seeded transactions, when the user taps the payment row, then the details screen renders for that transaction',
        async () => {
            // Spy on the indexer lookup so we can confirm the details
            // screen actually fetched by the right txId — it's
            // triggered when navigating with `transactionId` (the
            // history list's tap behavior).
            const lookupSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        'current-round': 100,
                        transaction: {
                            id: TX_PAYMENT.id,
                            'tx-type': 'pay',
                            sender: TX_PAYMENT.sender,
                            'confirmed-round': TX_PAYMENT.confirmedRound,
                            'round-time': TX_PAYMENT.roundTime,
                            fee: 1000,
                            'payment-transaction': {
                                receiver: TX_PAYMENT.receiver,
                                amount: 1_000_000,
                                'close-amount': 0,
                            },
                        },
                    },
                    { status: 200 },
                ),
            )
            server.use(
                http.get(`*/v2/transactions/${TX_PAYMENT.id}`, lookupSpy),
            )

            renderWithNavigation(AccountHistory, 'AccountHistory', {
                additionalScreens: [
                    {
                        name: 'TransactionDetails',
                        component: TransactionDetailsScreen,
                    },
                ],
            })

            // The TransactionListItem renders its title via
            // `getTitle()` which keys off direction relative to the
            // selected account. Our seeded `TX_PAYMENT` has the
            // selected account as sender → 'Send'. The asset-transfer
            // tx has the selected account as receiver → 'Receive'.
            // Both rows should mount once the DB read settles.
            await waitFor(
                () => {
                    expect(
                        screen.queryAllByText(
                            (_, node) => (node?.textContent ?? '') === 'Send',
                        ).length,
                    ).toBeGreaterThan(0)
                },
                { timeout: 5000 },
            )
            expect(
                screen.queryAllByText(
                    (_, node) => (node?.textContent ?? '') === 'Receive',
                ).length,
            ).toBeGreaterThan(0)

            // Tap the 'Send' row (the payment) — walk to its wrapping
            // button. Multiple matches by text walker because
            // ancestors also satisfy the substring; we need the leaf.
            const matches = screen.queryAllByText(
                (_, node) => (node?.textContent ?? '') === 'Send',
            )
            const leaf =
                matches.find(el => el.children.length === 0) ?? matches[0]
            const row = leaf.closest('button')
            if (!row) {
                throw new Error('Payment row button not found')
            }
            fireEvent.click(row)

            // The details screen calls `indexer.lookupTransactionById`
            // which we intercepted. Wait for the spy to fire.
            await waitFor(
                () => {
                    expect(lookupSpy).toHaveBeenCalled()
                },
                { timeout: 5000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
