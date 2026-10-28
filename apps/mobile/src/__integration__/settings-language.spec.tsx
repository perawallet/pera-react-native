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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { getActiveLocale } from '@perawallet/wallet-core-shared'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { SettingsLanguageScreen } from '@modules/settings/screens/SettingsLanguageScreen/SettingsLanguageScreen'
import { i18n } from '../i18n'

// The radio draws its dot as the only child of its `-radio` circle.
const isRadioSelected = (testID: string): boolean =>
    screen.getByTestId(`${testID}-radio`).childElementCount > 0

const renderScreen = () =>
    renderWithNavigation(SettingsLanguageScreen, 'SettingsLanguage')

describe('Flow: Settings → Language', () => {
    beforeEach(async () => {
        // Rehydrate first or the persist middleware's async hydration lands
        // after the overrides and clobbers them.
        await useRemoteConfigStore.persist.rehydrate()
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_language_selection', true)
        useRemoteConfigStore
            .getState()
            .setConfigOverride('active_locales', 'de,fr')
        useSettingsStore.getState().setLanguage('system')
    })

    afterEach(async () => {
        useRemoteConfigStore.getState().resetState()
        await act(() => i18n.changeLanguage('en'))
    })

    it('Given German is an active locale, when the user picks it, then the preference persists and the app switches to German', async () => {
        renderScreen()
        expect(isRadioSelected('settings_language_system_radio')).toBe(true)

        fireEvent.click(screen.getByTestId('settings_language_de_radio'))

        await waitFor(() => {
            expect(i18n.language).toBe('de')
        })
        expect(useSettingsStore.getState().language).toBe('de')
        expect(getActiveLocale()).toBe('de')
        expect(isRadioSelected('settings_language_de_radio')).toBe(true)
        expect(isRadioSelected('settings_language_system_radio')).toBe(false)
    })

    it('Given French is chosen, when the user picks System, then the preference resets and the app follows the en-US device locale', async () => {
        useSettingsStore.getState().setLanguage('fr')
        await act(() => i18n.changeLanguage('fr'))
        renderScreen()
        expect(isRadioSelected('settings_language_fr_radio')).toBe(true)

        fireEvent.click(screen.getByTestId('settings_language_system_radio'))

        await waitFor(() => {
            expect(i18n.language).toBe('en')
        })
        expect(useSettingsStore.getState().language).toBe('system')
        expect(isRadioSelected('settings_language_system_radio')).toBe(true)
    })

    it('Given the remote allowlist names only German and French, when the screen mounts, then bundled locales outside it are not offered', () => {
        renderScreen()

        expect(screen.getByTestId('settings_language_en_radio')).toBeTruthy()
        expect(screen.getByTestId('settings_language_fr_radio')).toBeTruthy()
        expect(screen.queryByTestId('settings_language_es_radio')).toBeNull()
        expect(screen.queryByTestId('settings_language_tr_radio')).toBeNull()
    })
})
