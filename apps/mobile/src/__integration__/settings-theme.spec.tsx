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

import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { SettingsThemeScreen } from '@modules/settings/screens/SettingsThemeScreen/SettingsThemeScreen'

const THEME_RADIOS = {
    system: 'settings_theme_system_radio',
    light: 'settings_theme_light_radio',
    dark: 'settings_theme_dark_radio',
} as const

// The radio draws its dot as the only child of its `-radio` circle.
const checkedThemes = () =>
    Object.entries(THEME_RADIOS)
        .filter(
            ([, testID]) =>
                screen.getByTestId(`${testID}-radio`).childElementCount > 0,
        )
        .map(([theme]) => theme)

describe('Flow: Settings → Theme', () => {
    beforeEach(() => {
        useSettingsStore.getState().setTheme('system')
    })

    it('Given no theme was chosen, when the screen mounts, then System is the selected option', () => {
        renderWithNavigation(SettingsThemeScreen, 'SettingsTheme')

        expect(checkedThemes()).toEqual(['system'])
    })

    it.each(['light', 'dark'] as const)(
        'Given the System theme, when the user picks %s, then the store holds it and only its radio is selected',
        async theme => {
            renderWithNavigation(SettingsThemeScreen, 'SettingsTheme')

            fireEvent.click(screen.getByTestId(THEME_RADIOS[theme]))

            await waitFor(() => {
                expect(checkedThemes()).toEqual([theme])
            })
            expect(useSettingsStore.getState().theme).toBe(theme)
        },
    )

    it('Given the Dark theme, when the user picks System, then the store returns to system', async () => {
        useSettingsStore.getState().setTheme('dark')
        renderWithNavigation(SettingsThemeScreen, 'SettingsTheme')
        expect(checkedThemes()).toEqual(['dark'])

        fireEvent.click(screen.getByTestId(THEME_RADIOS.system))

        await waitFor(() => {
            expect(checkedThemes()).toEqual(['system'])
        })
        expect(useSettingsStore.getState().theme).toBe('system')
    })
})
