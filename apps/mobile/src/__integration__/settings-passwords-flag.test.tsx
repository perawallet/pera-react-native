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

// Rollout-safety proof for `enable_password_manager`: the flag defaults to
// OFF, so Settings must hide the Passwords row unless Remote Config (or the
// developer Feature Flags override, which writes the same store) turns it on.
// The flag-on CRUD flow itself is covered by settings-passwords.test.tsx.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { SettingsScreen } from '@modules/settings/screens/SettingsScreen/SettingsScreen'

describe('password manager flag gating on the Settings screen', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(() => server.close())

    it('hides the Passwords row when the flag is unset (the default)', () => {
        renderWithNavigation(SettingsScreen, 'SettingsHome')

        // Positive control: a sibling row still renders so the absence
        // assertion below is meaningful.
        expect(screen.getByText('settings.main.security_title')).toBeTruthy()

        // i18n renders raw keys in this env, so match the key, not the label.
        expect(screen.queryByText('settings.passwords.title')).toBeNull()
    })

    it('shows the Passwords row when the flag is overridden on', async () => {
        // Rehydrate first or the persist middleware's async hydration lands
        // after the override and clobbers it (same as the quantum tests).
        await useRemoteConfigStore.persist.rehydrate()
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_password_manager', true)

        renderWithNavigation(SettingsScreen, 'SettingsHome')

        expect(screen.getByText('settings.passwords.title')).toBeTruthy()
    })
})
