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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardTransactionsScreen } from '@modules/card/screens/CardTransactionsScreen'
import { CardTransactionDetailScreen } from '@modules/card/screens/CardTransactionDetailScreen'
import { buildMockCardTransactions } from '@modules/card/devMocks'

// Page-aware: page 0 returns the fixture, later pages are empty so the
// infinite query terminates (the bare-array `hasMore = items.length > 0`).
const transactionsHandler = (rows: unknown[]) =>
    http.get('*/v1/card/transactions', ({ request }) => {
        const page = Number(
            new URL(request.url).searchParams.get('page') ?? '0',
        )
        return HttpResponse.json(page === 0 ? rows : [], { status: 200 })
    })

const renderListWithDetail = () =>
    renderWithNavigation(CardTransactionsScreen, 'CardTransactions', {
        additionalScreens: [
            {
                name: 'CardTransactionDetail',
                component: CardTransactionDetailScreen,
            },
        ],
    })

describe('Flow: Card transaction detail', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('opens a payment detail from the list with both tabs and all rows', async () => {
        server.use(transactionsHandler(buildMockCardTransactions()))

        renderListWithDetail()

        fireEvent.click(
            await screen.findByTestId(
                'card_transaction_item_tx_payment_sesame',
            ),
        )

        expect(
            await screen.findByTestId('card_transaction_detail_screen'),
        ).toBeTruthy()
        // Data-derived values (i18n renders keys verbatim in this harness).
        expect(screen.getByText('*4242')).toBeTruthy()
        expect(screen.getByText('auth_1001')).toBeTruthy()
        // Both tab titles render (mocked top-tabs shows every scene + title).
        expect(
            screen.getByText('peraCard.transactions.detail_tab_transaction'),
        ).toBeTruthy()
        expect(
            screen.getByText('peraCard.transactions.detail_tab_merchant'),
        ).toBeTruthy()
        // Merchant tab: the raw wire category ("FOOD") maps to a label key,
        // proving the friendly-label mapping ran (i18n renders keys verbatim).
        expect(
            screen.getByText('peraCard.transactions.mcc_category_food'),
        ).toBeTruthy()
        expect(
            screen.getByText('peraCard.transactions.merchant_type_in_store'),
        ).toBeTruthy()
        expect(screen.queryByText('FOOD')).toBeNull()
        // The confirmed payment carries a funding-source hash → actions render.
        expect(
            screen.getByTestId('card_transaction_detail_copy_hash'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('card_transaction_detail_report'),
        ).toBeTruthy()
    })

    it('opens a deposit detail without the merchant tab bar', async () => {
        server.use(transactionsHandler(buildMockCardTransactions()))

        renderListWithDetail()

        fireEvent.click(
            await screen.findByTestId('card_transaction_item_tx_deposit_1'),
        )

        expect(
            await screen.findByTestId('card_transaction_detail_screen'),
        ).toBeTruthy()
        // No merchant → tabs are skipped entirely.
        expect(
            screen.queryByText('peraCard.transactions.detail_tab_transaction'),
        ).toBeNull()
        expect(
            screen.queryByText('peraCard.transactions.detail_tab_merchant'),
        ).toBeNull()
        // The funding-source hash still renders (middle-truncated).
        expect(screen.getByText('M7PWT2...ECZ4LH')).toBeTruthy()
        expect(
            screen.getByTestId('card_transaction_detail_copy_hash'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('card_transaction_detail_open_explorer'),
        ).toBeTruthy()
    })

    it('hides the hash row for a payment without a funding-source hash', async () => {
        server.use(transactionsHandler(buildMockCardTransactions()))

        renderListWithDetail()

        fireEvent.click(
            await screen.findByTestId(
                'card_transaction_item_tx_payment_bluebottle',
            ),
        )

        expect(
            await screen.findByTestId('card_transaction_detail_screen'),
        ).toBeTruthy()
        expect(screen.getByText('auth_1004')).toBeTruthy()
        expect(
            screen.queryByTestId('card_transaction_detail_copy_hash'),
        ).toBeNull()
        expect(
            screen.queryByTestId('card_transaction_detail_open_explorer'),
        ).toBeNull()
    })

    it('shows the not-found state with retry for an unknown transaction id', async () => {
        server.use(transactionsHandler(buildMockCardTransactions()))

        renderWithNavigation(
            CardTransactionDetailScreen,
            'CardTransactionDetail',
            { initialParams: { id: 'nope' } },
        )

        // The hook auto-paginates to exhaustion before declaring not-found.
        expect(
            await screen.findByText(
                'peraCard.transactions.detail_not_found_title',
            ),
        ).toBeTruthy()
        expect(screen.getByTestId('card_transaction_detail_retry')).toBeTruthy()
        expect(
            screen.queryByTestId('card_transaction_detail_report'),
        ).toBeNull()
    })

    it('shows the error state (not "not found") when the fetch fails', async () => {
        server.use(
            http.get('*/v1/card/transactions', () =>
                HttpResponse.json({ message: 'boom' }, { status: 500 }),
            ),
        )

        renderWithNavigation(
            CardTransactionDetailScreen,
            'CardTransactionDetail',
            { initialParams: { id: 'tx_payment_sesame' } },
        )

        expect(
            await screen.findByText('peraCard.transactions.error_title'),
        ).toBeTruthy()
        expect(
            screen.queryByText('peraCard.transactions.detail_not_found_title'),
        ).toBeNull()
        expect(screen.getByTestId('card_transaction_detail_retry')).toBeTruthy()
    })
})
