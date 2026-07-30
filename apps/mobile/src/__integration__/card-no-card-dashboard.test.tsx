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

import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { PeraCardDetails } from '@modules/card/components/PeraCardDetails'

// The brand wallet icons in CardOptionsSection are multi-color SVGs that jsdom
// can't render; stub them (matches the per-SVG mocking other integration tests use).
vi.mock('@assets/icons/apple-wallet.svg', () => ({ default: () => null }))
vi.mock('@assets/icons/google-pay.svg', () => ({ default: () => null }))

const activeCard = {
    id: 'card_1',
    panLast4: '8533',
    status: 'ACTIVE',
    type: 'VIRTUAL',
    orderedAt: '2026-06-23T09:39:30.771Z',
}

const baanxUser = (verificationState: string) => ({
    id: 'baanx-user-1',
    email: 'user@example.com',
    verificationState,
})

// Baanx's real no-card response: GET /v1/card/status 404s until ordered.
const noCardResponse = () =>
    HttpResponse.json({ message: "User doesn't have a card" }, { status: 404 })

// NOTE: whenever the status handler 404s, the issuance flow polls
// GET /v1/user — register a user handler too, or MSW warns on it.
describe('Flow: Card dashboard without a Baanx card', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('waits on PENDING verification: dimmed-state notice, no card actions, no order request', async () => {
        const order = vi.fn(() =>
            HttpResponse.json({ success: true }, { status: 200 }),
        )
        server.use(
            http.get('*/v1/card/status', noCardResponse),
            http.get('*/v1/user', () =>
                HttpResponse.json(baanxUser('PENDING'), { status: 200 }),
            ),
            http.post('*/v1/card/order', order),
        )

        renderWithNavigation(PeraCardDetails, 'CardDetails')

        expect(
            await screen.findByTestId('pera_card_issuance_pending_notice'),
        ).toBeTruthy()
        // The reveal pill and every card-only action row stay hidden.
        expect(screen.queryByTestId('pera_card_reveal_button')).toBeNull()
        expect(screen.queryByTestId('pera_card_set_pin_row')).toBeNull()
        expect(screen.queryByTestId('pera_card_freeze_row')).toBeNull()
        expect(screen.queryByTestId('pera_card_report_lost_row')).toBeNull()
        expect(
            screen.queryByTestId('pera_card_report_suspicious_row'),
        ).toBeNull()
        expect(screen.queryByTestId('pera_card_apple_wallet_row')).toBeNull()
        expect(screen.queryByTestId('pera_card_google_pay_row')).toBeNull()
        // Accounts Details is user-profile data and survives without a card.
        expect(
            screen.getByTestId('pera_card_accounts_details_row'),
        ).toBeTruthy()
        expect(order).not.toHaveBeenCalled()
    })

    it('REJECTED verification shows the terminal notice with support and never orders', async () => {
        const order = vi.fn(() =>
            HttpResponse.json({ success: true }, { status: 200 }),
        )
        server.use(
            http.get('*/v1/card/status', noCardResponse),
            http.get('*/v1/user', () =>
                HttpResponse.json(baanxUser('REJECTED'), { status: 200 }),
            ),
            http.post('*/v1/card/order', order),
        )

        renderWithNavigation(PeraCardDetails, 'CardDetails')

        expect(
            await screen.findByTestId('pera_card_issuance_rejected_notice'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('pera_card_issuance_support_button'),
        ).toBeTruthy()
        expect(screen.queryByTestId('pera_card_reveal_button')).toBeNull()
        expect(order).not.toHaveBeenCalled()
    })

    it('VERIFIED with no card: orders exactly once, then unlocks the full card UI', async () => {
        // Stateful backend: the order flips what the status refetch returns,
        // mirroring the real create-then-poll transition.
        const state = { isOrdered: false }
        const order = vi.fn(() => {
            state.isOrdered = true
            return HttpResponse.json({ success: true }, { status: 200 })
        })
        server.use(
            http.get('*/v1/card/status', () =>
                state.isOrdered
                    ? HttpResponse.json(activeCard, { status: 200 })
                    : noCardResponse(),
            ),
            http.get('*/v1/user', () =>
                HttpResponse.json(baanxUser('VERIFIED'), { status: 200 }),
            ),
            http.post('*/v1/card/order', order),
        )

        renderWithNavigation(PeraCardDetails, 'CardDetails')

        // The dashboard notices the VERIFIED + no-card state and orders.
        await waitFor(() => expect(order).toHaveBeenCalledTimes(1))

        // The invalidated status query now sees the card: full UI unlocks.
        expect(
            await screen.findByTestId('pera_card_reveal_button'),
        ).toBeTruthy()
        expect(screen.getByTestId('pera_card_set_pin_row')).toBeTruthy()
        expect(screen.getByTestId('pera_card_freeze_row')).toBeTruthy()
        expect(screen.getByTestId('pera_card_report_lost_row')).toBeTruthy()
        expect(
            screen.queryByTestId('pera_card_issuance_pending_notice'),
        ).toBeNull()
        expect(
            screen.queryByTestId('pera_card_issuance_issuing_notice'),
        ).toBeNull()
        // Still exactly one order across the whole transition.
        expect(order).toHaveBeenCalledTimes(1)
    })
})
