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
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { PeraCardDetails } from '@modules/card/components/PeraCardDetails'
import { PeraCardOverview } from '@modules/card/components/PeraCardOverview'

// The brand wallet icons in CardOptionsSection are multi-color SVGs that jsdom
// can't render; stub them (matches the per-SVG mocking other integration tests use).
vi.mock('@assets/icons/apple-wallet.svg', () => ({ default: () => null }))
vi.mock('@assets/icons/google-pay.svg', () => ({ default: () => null }))

const cardStatus = (status: string) => ({
    id: 'card_1',
    panLast4: '8533',
    status,
    type: 'VIRTUAL',
    orderedAt: '2026-06-23T09:39:30.771Z',
})

// GET /v1/card/status backed by mutable state so a freeze/unfreeze POST flips
// what the subsequent refetch returns — mirroring the real backend transition.
const statefulStatus = (initial: string) => {
    const ref = { status: initial }
    return {
        ref,
        handler: http.get('*/v1/card/status', () =>
            HttpResponse.json(cardStatus(ref.status), { status: 200 }),
        ),
    }
}

const renderDetails = () => renderWithNavigation(PeraCardDetails, 'CardDetails')

describe('Flow: Card frozen state', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => vi.mocked(Notifier.showNotification).mockClear())
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('shows the Card Frozen banner on the Card Details tab when the card is frozen', async () => {
        server.use(
            http.get('*/v1/card/status', () =>
                HttpResponse.json(cardStatus('FROZEN'), { status: 200 }),
            ),
        )

        renderDetails()

        expect(await screen.findByTestId('card_frozen_banner')).toBeTruthy()
        expect(screen.getByTestId('pera_card_reactivate_button')).toBeTruthy()
    })

    it('shows the Card Frozen banner on the Overview tab when the card is frozen', async () => {
        server.use(
            http.get('*/v1/card/status', () =>
                HttpResponse.json(cardStatus('FROZEN'), { status: 200 }),
            ),
            http.get('*/v1/card/transactions', () =>
                HttpResponse.json([], { status: 200 }),
            ),
        )

        renderWithNavigation(PeraCardOverview, 'Overview')

        expect(await screen.findByTestId('card_frozen_banner')).toBeTruthy()
    })

    it('keeps the banner hidden when the card is active', async () => {
        const status = vi.fn(() =>
            HttpResponse.json(cardStatus('ACTIVE'), { status: 200 }),
        )
        server.use(http.get('*/v1/card/status', status))

        renderDetails()

        await waitFor(() => expect(status).toHaveBeenCalled())
        expect(screen.queryByTestId('card_frozen_banner')).toBeNull()
    })

    it('reactivates a frozen card from the banner and hides it', async () => {
        const { ref, handler } = statefulStatus('FROZEN')
        const unfreeze = vi.fn(() => {
            ref.status = 'ACTIVE'
            return HttpResponse.json({ success: true }, { status: 200 })
        })
        server.use(handler, http.post('*/v1/card/unfreeze', unfreeze))

        renderDetails()

        fireEvent.click(
            await screen.findByTestId('pera_card_reactivate_button'),
        )

        await waitFor(() => expect(unfreeze).toHaveBeenCalled())
        await waitFor(() =>
            expect(screen.queryByTestId('card_frozen_banner')).toBeNull(),
        )
    })

    it('freezes an active card via the confirmation sheet and shows the banner', async () => {
        const { ref, handler } = statefulStatus('ACTIVE')
        const freeze = vi.fn(() => {
            ref.status = 'FROZEN'
            return HttpResponse.json({ success: true }, { status: 200 })
        })
        server.use(handler, http.post('*/v1/card/freeze', freeze))

        renderDetails()

        // Tapping the Freeze option opens the confirmation sheet — it does not
        // freeze immediately.
        fireEvent.click(await screen.findByTestId('pera_card_freeze_row'))
        const confirm = await screen.findByTestId('freeze_confirm_button')
        expect(
            screen.getByTestId('freeze_card_confirmation_sheet'),
        ).toBeTruthy()
        expect(freeze).not.toHaveBeenCalled()

        // Confirming runs the freeze, closes the sheet, and reveals the banner.
        fireEvent.click(confirm)

        await waitFor(() => expect(freeze).toHaveBeenCalled())
        await waitFor(() =>
            expect(
                screen.queryByTestId('freeze_card_confirmation_sheet'),
            ).toBeNull(),
        )
        expect(await screen.findByTestId('card_frozen_banner')).toBeTruthy()
    })
})
