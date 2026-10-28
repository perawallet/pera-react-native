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

// A worthless transfer from a look-alike of a known address stays in History,
// marked, and its details explain it and warn before the address is copied.
// Copy is asserted by key: this project renders i18n keys.

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
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import * as Clipboard from 'expo-clipboard'
import { http, HttpResponse } from 'msw'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { closestPressable, longPress } from '@test-utils/rnw'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import {
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { AccountHistory } from '@modules/accounts/components/AccountHistory/AccountHistory'
import { TransactionDetailsScreen } from '@modules/signing/routes'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const

// Same short form, different middle.
const CONTACT = '2SSSXMFNG55PKDGKJB7MLTGIRSIYAXFCJAWSQFD6C3M7L6JLG5NJIBTGAA'
const LOOK_ALIKE = '2SSSXMBXVWYMJ33BCFI5PED5O7LMFJZWXXSAJCU44W5M4NP4Q5YIJBTGAA'

const ACCOUNT: WalletAccount = {
    id: 'observer-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'observer-key' },
    },
    name: 'Observer',
}

const payment = (
    id: string,
    sender: string,
    amount: Decimal,
    roundTime: number,
): TransactionHistoryItem => ({
    id,
    txType: 'pay',
    sender,
    receiver: ALGO25_TEST_ADDRESS,
    assetSender: null,
    confirmedRound: 100,
    roundTime,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount,
    asset: null,
    balanceImpacts: [],
})

const TX_POISON = payment(
    'TXPOISON00000000000000000000000000000000000000000000001',
    LOOK_ALIKE,
    new Decimal(0),
    1_700_000_000,
)
const TX_STRANGER = payment(
    'TXSTRANGER000000000000000000000000000000000000000000002',
    HD_TEST_ADDRESS,
    new Decimal(0),
    1_699_900_000,
)

const serveDetail = (transaction: TransactionHistoryItem) =>
    server.use(
        http.get(`*/v2/transactions/${transaction.id}`, () =>
            HttpResponse.json({
                'current-round': 100,
                transaction: {
                    id: transaction.id,
                    'tx-type': 'pay',
                    sender: transaction.sender,
                    'confirmed-round': transaction.confirmedRound,
                    'round-time': transaction.roundTime,
                    fee: 1000,
                    'payment-transaction': {
                        receiver: transaction.receiver,
                        amount: 0,
                        'close-amount': 0,
                    },
                },
            }),
        ),
    )

describe('Flow: suspected address poisoning in Algorand history', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ACCOUNT.id)
        useContactsStore.setState({
            contacts: [
                {
                    id: 'alice',
                    name: 'Alice',
                    addresses: { algorand: CONTACT },
                },
            ],
        })
        vi.mocked(Clipboard.setStringAsync).mockClear()
        await seedAlgorandAccountState({
            accountAddress: ALGO25_TEST_ADDRESS,
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(5_000_000),
            minBalance: new Decimal(100_000),
        })
        await upsertTransactions({
            items: [TX_POISON, TX_STRANGER],
            accountAddress: ALGO25_TEST_ADDRESS,
            scope: MAINNET_SCOPE,
        })
    })

    afterEach(() => {
        server.resetHandlers()
        useContactsStore.setState({ contacts: [] })
    })

    it('Given a zero-value payment from a look-alike of a contact, then its row is marked in place and a stranger is not', async () => {
        renderWithNavigation(AccountHistory, 'AccountHistory')

        await screen.findByTestId(
            `transaction_row_suspected_poisoning_${TX_POISON.id}`,
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen
                .queryAllByTestId(/^transaction_row_TX[A-Z0-9]+$/)
                .map(row => row.getAttribute('data-testid')),
        ).toEqual([
            `transaction_row_${TX_POISON.id}`,
            `transaction_row_${TX_STRANGER.id}`,
        ])
        expect(
            screen.queryByTestId(
                `transaction_row_suspected_poisoning_${TX_STRANGER.id}`,
            ),
        ).toBeNull()
    })

    it('Given a marked row, when the user opens it and copies the sender, then the details name the contact it imitates and copying waits for a warning', async () => {
        serveDetail(TX_POISON)
        renderWithNavigation(AccountHistory, 'AccountHistory', {
            additionalScreens: [
                {
                    name: 'TransactionDetails',
                    component: TransactionDetailsScreen,
                },
            ],
        })
        await screen.findByTestId(
            `transaction_row_suspected_poisoning_${TX_POISON.id}`,
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        const row = closestPressable(
            screen.getByTestId(`transaction_row_${TX_POISON.id}`),
        )
        if (!row) throw new Error('Marked row is not pressable')
        fireEvent.click(row)

        const notice = await screen.findByTestId(
            'suspected_poisoning_notice',
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            within(notice).getByTestId('suspected_poisoning_imitated_address')
                .textContent,
        ).toBe(CONTACT)
        expect(notice.textContent).toContain(
            'send_funds.recipient_safety.look_alike_known_label_contact',
        )

        const from = await screen.findByTestId('transaction_detail_from')
        const sender = closestPressable(
            within(from).getByText(truncateAlgorandAddress(LOOK_ALIKE)),
        )
        if (!sender) throw new Error('Sender address is not copyable')
        await longPress(sender)

        await screen.findByTestId('suspected_address_reuse_warning')
        fireEvent.click(
            screen.getByTestId('suspected_address_reuse_warning_cancel'),
        )

        await waitFor(() =>
            expect(
                screen.queryByTestId('suspected_address_reuse_warning'),
            ).toBeNull(),
        )
        expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    })
})
