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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsHandlers } from '../useSettingsHandlers'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({ preferredCurrency: 'USD' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-id',
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({
        deviceInfo: {
            getAppName: () => 'Pera Wallet',
            getAppPackage: () => 'com.algorand.perarn',
            getAppVersion: () => '1.0.0',
            getDevicePlatform: () => 'ios',
            getDeviceOSVersion: () => '17.4',
            getDeviceModel: () => 'iPhone',
            getDeviceCountry: () => 'US',
            getDeviceLocale: () => 'en-US',
        },
    }),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(),
}))

const sentResult = (
    method: 'getSettings' | 'getPublicSettings',
): Record<string, unknown> => {
    const webview = createMockWebview()
    const { result } = renderHook(() => useSettingsHandlers(webview))
    result.current[method](bridgeMessage('5', method), TRUSTED)
    const injected = injectedScript(webview)
    const parsed = JSON.parse(
        injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
    )
    expect(parsed.id).toBe('5')
    return parsed.result
}

describe('useSettingsHandlers', () => {
    beforeEach(() => {
        vi.mocked(useIsDarkMode).mockReturnValue(false)
        vi.mocked(useLanguage).mockReturnValue(
            languageMockValue() as unknown as ReturnType<typeof useLanguage>,
        )
    })

    const setLanguage = (language: string | undefined) =>
        vi
            .mocked(useLanguage)
            .mockReturnValue(
                languageMockValue(language) as unknown as ReturnType<
                    typeof useLanguage
                >,
            )

    describe('getSettings', () => {
        it('answers with the app, device and preference payload', () => {
            expect(sentResult('getSettings')).toEqual({
                appName: 'Pera Wallet',
                appPackageName: 'com.algorand.perarn',
                appVersion: '1.0.0',
                clientType: 'ios',
                deviceId: 'device-id',
                deviceVersion: 'iPhone',
                // The OS version, not the platform: the SDK Settings contract
                // keeps clientType and deviceOSVersion distinct.
                deviceOSVersion: '17.4',
                deviceModel: 'iPhone',
                theme: 'light',
                network: 'mainnet',
                currency: 'USD',
                region: 'US',
                language: 'en-US',
                // The bridge's negotiation signal; see
                // docs/WEBVIEW_ARCHITECTURE.md.
                protocolVersion: '3',
            })
        })

        it('reports the app locale rather than the device locale, and region from the device', () => {
            setLanguage('pt-BR')

            expect(sentResult('getSettings')).toMatchObject({
                language: 'pt-BR',
                region: 'US',
            })
        })

        it('reports the dark theme when dark mode is active', () => {
            vi.mocked(useIsDarkMode).mockReturnValue(true)

            expect(sentResult('getSettings').theme).toBe('dark')
        })
    })

    describe('getPublicSettings', () => {
        it('answers with only the non-identifying preferences', () => {
            expect(sentResult('getPublicSettings')).toEqual({
                theme: 'light',
                network: 'mainnet',
                currency: 'USD',
                language: 'en-US',
            })
        })

        it('reports the app locale, not a hardcoded en-US', () => {
            setLanguage('tr')

            expect(sentResult('getPublicSettings').language).toBe('tr')
        })

        it('falls back to en-US when i18next has not resolved a locale yet', () => {
            // Reachable before bootstrap has called changeLanguage, so an
            // empty language must not reach the web app.
            setLanguage(undefined)

            expect(sentResult('getPublicSettings').language).toBe('en-US')
        })

        it('reports the dark theme when dark mode is active', () => {
            vi.mocked(useIsDarkMode).mockReturnValue(true)

            expect(sentResult('getPublicSettings').theme).toBe('dark')
        })
    })
})
