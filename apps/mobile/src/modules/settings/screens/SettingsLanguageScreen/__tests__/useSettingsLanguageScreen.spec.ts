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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettingsLanguageScreen } from '../useSettingsLanguageScreen'

const mocks = vi.hoisted(() => ({
    // Stands in for the real effective set when a test needs more than one
    // locale in it: only `en` has a shipped bundle today, so ordering can't
    // be exercised through the real intersection. Null = use the real one.
    effectiveLocalesOverride: null as ReadonlySet<string> | null,
    language: 'system' as string,
    setLanguage: vi.fn((lang: string) => {
        mocks.language = lang
    }),
    changeLanguage: vi.fn(),
    getDeviceLocales: vi.fn(() => ['de-DE']),
    getBooleanValue: vi.fn(
        (_key: string, fallback?: boolean) => fallback ?? false,
    ),
    getStringValue: vi.fn((_key: string, fallback?: string) => fallback ?? ''),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: () => ({
        language: mocks.language,
        setLanguage: mocks.setLanguage,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        changeLanguage: mocks.changeLanguage,
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: { getDeviceLocales: mocks.getDeviceLocales },
    }),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: () => ({
        getBooleanValue: mocks.getBooleanValue,
        getStringValue: mocks.getStringValue,
    }),
    RemoteConfigKeys: {
        enable_language_selection: 'enable_language_selection',
        active_locales: 'active_locales',
    },
}))

vi.mock('../../../../../i18n/effectiveLocales', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('../../../../../i18n/effectiveLocales')
        >()
    return {
        getEffectiveSupportedLocales: (
            ...args: Parameters<typeof actual.getEffectiveSupportedLocales>
        ) =>
            mocks.effectiveLocalesOverride ??
            actual.getEffectiveSupportedLocales(...args),
    }
})

describe('useSettingsLanguageScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.effectiveLocalesOverride = null
        mocks.language = 'system'
        mocks.getBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        mocks.getStringValue.mockImplementation(
            (_key: string, fallback?: string) => fallback ?? '',
        )
    })

    it('offers only en when active_locales is empty, even with the flag on', () => {
        mocks.getBooleanValue.mockReturnValue(true)
        const { result } = renderHook(() => useSettingsLanguageScreen())
        expect(result.current.supportedLocales).toEqual(['en'])
    })

    it('lists en first, then the rest alphabetically, whatever the Set order', () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.effectiveLocalesOverride = new Set(['fr', 'de', 'en'])
        const { result } = renderHook(() => useSettingsLanguageScreen())
        expect(result.current.supportedLocales).toEqual(['en', 'de', 'fr'])
    })

    it('persists a specific selection and switches i18next to it directly', () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getStringValue.mockReturnValue('en')
        const { result } = renderHook(() => useSettingsLanguageScreen())

        act(() => {
            result.current.selectLanguage('en')
        })

        expect(mocks.setLanguage).toHaveBeenCalledWith('en')
        expect(mocks.changeLanguage).toHaveBeenCalledWith('en')
    })

    it('resolves "system" through the device locale list, within the effective set', () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getStringValue.mockReturnValue('en')
        mocks.getDeviceLocales.mockReturnValue(['de-DE'])
        const { result } = renderHook(() => useSettingsLanguageScreen())

        act(() => {
            result.current.selectLanguage('system')
        })

        expect(mocks.setLanguage).toHaveBeenCalledWith('system')
        // Only `en` is ever in the effective set here (no de bundle ships),
        // so device resolution still lands on `en` regardless of the
        // device reporting `de-DE`.
        expect(mocks.changeLanguage).toHaveBeenCalledWith('en')
    })
})
