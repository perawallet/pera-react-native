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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { PeraCardOverview } from '@modules/card/components/PeraCardOverview'
import { CardTransactionsScreen } from '@modules/card/screens/CardTransactionsScreen'
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

const activeCardStatus = http.get('*/v1/card/status', () =>
    HttpResponse.json(
        { id: 'card_1', panLast4: '4242', status: 'ACTIVE', type: 'VIRTUAL' },
        { status: 200 },
    ),
)

describe('Flow: Card transactions list', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('renders fetched transactions grouped across months on the full screen', async () => {
        server.use(transactionsHandler(buildMockCardTransactions()))

        renderWithNavigation(CardTransactionsScreen, 'CardTransactions')

        // A current-month payment and a previous-month payment both render,
        // proving fetch → parse → transform → month grouping → row rendering.
        expect(await screen.findByText('Sesame Street Cafe')).toBeTruthy()
        expect(screen.getByText('Moretti Restaurant')).toBeTruthy()
        expect(screen.getByText('Blue Bottle Coffee')).toBeTruthy()
        expect(screen.getByTestId('card_transactions_screen')).toBeTruthy()
    })

    it('shows the empty state when there are no transactions', async () => {
        server.use(transactionsHandler([]))

        renderWithNavigation(CardTransactionsScreen, 'CardTransactions')

        // The harness returns the i18n key verbatim, so assert on the key.
        expect(
            await screen.findByText('peraCard.account.transactions_empty'),
        ).toBeTruthy()
        expect(screen.queryByText('Sesame Street Cafe')).toBeNull()
    })

    it('shows an error state with a retry action when the request fails', async () => {
        server.use(
            http.get('*/v1/card/transactions', () =>
                HttpResponse.json({ message: 'boom' }, { status: 500 }),
            ),
        )

        renderWithNavigation(CardTransactionsScreen, 'CardTransactions')

        expect(
            await screen.findByTestId('card_transactions_retry'),
        ).toBeTruthy()
    })

    it('navigates from the overview "Show all" link to the transactions screen', async () => {
        server.use(
            activeCardStatus,
            transactionsHandler(buildMockCardTransactions()),
        )

        renderWithNavigation(PeraCardOverview, 'Overview', {
            additionalScreens: [
                { name: 'CardTransactions', component: CardTransactionsScreen },
            ],
        })

        fireEvent.click(
            await screen.findByTestId('pera_card_show_all_transactions'),
        )

        expect(
            await screen.findByTestId('card_transactions_screen'),
        ).toBeTruthy()
    })
})
