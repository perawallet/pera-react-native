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

import { renderHook } from '@testing-library/react-native'
import { useSettingsOptions } from '../settings-options'
import { useLanguage } from '@hooks/language'

jest.mock('@hooks/language', () => ({
    useLanguage: jest.fn(),
}))

jest.mock('@perawallet/wallet-core-config', () => ({
    config: {
        supportBaseUrl: 'https://support.example.com',
        termsOfServiceUrl: 'https://terms.example.com',
        privacyPolicyUrl: 'https://privacy.example.com',
    },
}))

describe('useSettingsOptions', () => {
    const mockT = jest.fn((key: string) => key)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useLanguage as jest.Mock).mockReturnValue({
            t: mockT,
        })
    })

    it('should return the correctly structured settings options', () => {
        const { result } = renderHook(() => useSettingsOptions())

        const { settingsOptions } = result.current

        expect(settingsOptions).toHaveLength(3)

        // Account Section
        expect(settingsOptions[0].title).toBe('settings.main.account_section')
        expect(settingsOptions[0].items).toHaveLength(4)
        expect(settingsOptions[0].items[0]).toEqual({
            route: 'SecuritySettings',
            icon: 'shield-check',
            title: 'settings.main.security_title',
        })

        // App Preferences Section
        expect(settingsOptions[1].title).toBe(
            'settings.main.app_preferences_section',
        )
        expect(settingsOptions[1].items).toHaveLength(2)
        expect(settingsOptions[1].items[0]).toEqual({
            route: 'CurrencySettings',
            icon: 'dollar',
            title: 'settings.main.currency_title',
        })

        // Support Section
        expect(settingsOptions[2].title).toBe('settings.main.support_section')
        expect(settingsOptions[2].items).toHaveLength(5)

        // Check external links in Support
        expect(settingsOptions[2].items[0]).toEqual({
            icon: 'feedback',
            title: 'settings.main.get_help_title',
            url: 'https://support.example.com',
        })
        expect(settingsOptions[2].items[2]).toEqual({
            icon: 'text-document',
            title: 'settings.main.terms_title',
            url: 'https://terms.example.com',
        })
        expect(settingsOptions[2].items[3]).toEqual({
            icon: 'text-document',
            title: 'settings.main.privacy_title',
            url: 'https://privacy.example.com',
        })
    })

    it('should use the translation function for titles', () => {
        renderHook(() => useSettingsOptions())
        expect(mockT).toHaveBeenCalledWith('settings.main.account_section')
        expect(mockT).toHaveBeenCalledWith('settings.main.security_title')
    })
})
