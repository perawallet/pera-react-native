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

// Rollout-safety proof for `enable_gift_cards`: the flag defaults to OFF
// (Bidali availability switch), so the Menu must hide the "Buy Gift Card"
// row unless Remote Config turns it on. The flag-on flow itself is covered
// by gift-card.test.tsx.

import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { screen } from '@testing-library/react'

// MenuScreen reaches PWWebView through the @modules/webview barrel; the real
// component drags in the native provider chain, which doesn't resolve under
// vitest (same workaround as discover.test.tsx).
vi.mock('@modules/webview/components/PWWebView', () => ({
    PWWebView: () => null,
}))

import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { MenuScreen } from '@modules/menu/screens/MenuScreen/MenuScreen'

describe('gift-card flag gating on the Menu screen', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(() => server.close())

    it('hides the Buy Gift Card row when the flag is unset (the default)', () => {
        renderWithNavigation(MenuScreen, 'Menu')

        // Positive control: a sibling row still renders so the absence
        // assertion below is meaningful (the screen isn't just empty/broken).
        expect(screen.getByTestId('menu_contacts_button')).toBeTruthy()

        // i18n renders raw keys in this env, so match the key, not the label.
        expect(screen.queryByText('menu.buy_gift_card')).toBeNull()
    })

    it('shows the Buy Gift Card row when the flag is overridden on', async () => {
        // Rehydrate first or the persist middleware's async hydration lands
        // after the override and clobbers it (same as the quantum tests).
        await useRemoteConfigStore.persist.rehydrate()
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_gift_cards', true)

        renderWithNavigation(MenuScreen, 'Menu')

        expect(screen.getByText('menu.buy_gift_card')).toBeTruthy()
    })
})
