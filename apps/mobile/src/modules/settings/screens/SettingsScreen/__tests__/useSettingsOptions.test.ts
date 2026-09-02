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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSettingsOptions } from '../useSettingsOptions'
import { useLanguage } from '@hooks/useLanguage'
import { useIsLanguageSelectionEnabled } from '@hooks/useIsLanguageSelectionEnabled'
import { useIsCloudBackupEnabled } from '@hooks/useIsCloudBackupEnabled'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(),
}))

vi.mock('@hooks/useIsLanguageSelectionEnabled', () => ({
    useIsLanguageSelectionEnabled: vi.fn(),
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: vi.fn(),
}))

// The hook reads the store through a selector, so the mock has to run the
// selector rather than return a value.
const { mockCloudBackupState } = vi.hoisted(() => ({
    mockCloudBackupState: { isConfigured: (): boolean => false },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupStore: (selector: (state: unknown) => unknown) =>
        selector(mockCloudBackupState),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        supportBaseUrl: 'https://support.example.com',
        termsOfServiceUrl: 'https://terms.example.com',
        privacyPolicyUrl: 'https://privacy.example.com',
    },
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
}))

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped and web-shaped `routeCapabilities` maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: {
        discoverTab: true,
        swapTab: true,
        fundTab: true,
        staking: true,
        peraCard: true,
        giftCards: true,
        inAppWebView: true,
        qrScanner: true,
        deepLinkPaste: false,
        pushNotificationSettings: true,
        walletConnectSettings: true,
        passkeysAutofillSettings: true,
        storeRating: true,
        developerSettings: true,
        vaultSecuritySettings: false,
        dappConnections: false,
        rekeyFlows: true,
        connectionsSettings: false,
    },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

describe('useSettingsOptions', () => {
    const mockT = vi.fn((key: string) => key)

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useLanguage as Mock).mockReturnValue({
            t: mockT,
        })
        ;(useIsLanguageSelectionEnabled as Mock).mockReturnValue(false)
        ;(useIsCloudBackupEnabled as Mock).mockReturnValue(false)
        mockCloudBackupState.isConfigured = () => false
        Object.assign(mockCapabilities, {
            discoverTab: true,
            swapTab: true,
            fundTab: true,
            staking: true,
            peraCard: true,
            giftCards: true,
            inAppWebView: true,
            qrScanner: true,
            deepLinkPaste: false,
            pushNotificationSettings: true,
            walletConnectSettings: true,
            passkeysAutofillSettings: true,
            storeRating: true,
            developerSettings: true,
            vaultSecuritySettings: false,
            dappConnections: false,
            rekeyFlows: true,
            connectionsSettings: false,
        })
    })

    it('should return the correctly structured settings options', () => {
        const { result } = renderHook(() => useSettingsOptions())

        const { settingsOptions } = result.current

        expect(settingsOptions).toHaveLength(3)

        // Account Section
        expect(settingsOptions[0].title).toBe('settings.main.account_section')
        expect(settingsOptions[0].items).toHaveLength(5)
        expect(settingsOptions[0].items[0]).toEqual({
            route: 'SecuritySettings',
            icon: 'shield-check',
            title: 'settings.main.security_title',
        })
        // The wallet-wide rekeyed-account sweep is an action, not a
        // settings sub-route.
        expect(settingsOptions[0].items[4]).toEqual({
            action: 'scanRekeyed',
            icon: 'magnifying-glass',
            title: 'settings.main.scan_rekeyed_title',
        })

        // App Preferences Section
        expect(settingsOptions[1].title).toBe(
            'settings.main.app_preferences_section',
        )
        expect(settingsOptions[1].items).toHaveLength(3)
        expect(settingsOptions[1].items[0]).toEqual({
            route: 'CurrencySettings',
            icon: 'dollar',
            title: 'settings.main.currency_title',
        })
        expect(settingsOptions[1].items[2]).toEqual({
            route: 'AdvancedSettings',
            icon: 'gear',
            title: 'settings.main.advanced_title',
        })

        // Support Section
        expect(settingsOptions[2].title).toBe('settings.main.support_section')
        expect(settingsOptions[2].items).toHaveLength(4)

        // Check external links in Support
        expect(settingsOptions[2].items[1]).toEqual({
            icon: 'text-document',
            title: 'settings.main.terms_title',
            url: 'https://terms.example.com',
        })
        expect(settingsOptions[2].items[2]).toEqual({
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

    describe('language selection gating', () => {
        it('omits the Language item when the flag is off', () => {
            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            const appPreferences = settingsOptions.find(
                section =>
                    section.title === 'settings.main.app_preferences_section',
            )
            expect(appPreferences?.items.map(item => item.route)).toEqual([
                'CurrencySettings',
                'ThemeSettings',
                'AdvancedSettings',
            ])
        })

        it('inserts the Language item before Advanced when the flag is on', () => {
            ;(useIsLanguageSelectionEnabled as Mock).mockReturnValue(true)

            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            const appPreferences = settingsOptions.find(
                section =>
                    section.title === 'settings.main.app_preferences_section',
            )
            expect(appPreferences?.items.map(item => item.route)).toEqual([
                'CurrencySettings',
                'ThemeSettings',
                'LanguageSettings',
                'AdvancedSettings',
            ])
            expect(appPreferences?.items[2]).toEqual({
                route: 'LanguageSettings',
                icon: 'globe',
                title: 'settings.main.language_title',
            })
        })
    })

    describe('capability gating', () => {
        it('includes every capability-gated item when capabilities are native-shaped (all on)', () => {
            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(settingsOptions).toHaveLength(3)
            expect(settingsOptions[0].items.map(item => item.route)).toEqual([
                'SecuritySettings',
                'NotificationsSettings',
                'WalletConnectSettings',
                'PasskeysSettings',
                undefined,
            ])
            expect(settingsOptions[2].items).toHaveLength(4)
            expect(settingsOptions[2].items[0]).toEqual({
                icon: 'star',
                title: 'settings.main.rate_title',
            })
            expect(settingsOptions[2].items[3]).toEqual({
                route: 'DeveloperSettings',
                icon: 'code',
                title: 'settings.main.developer_title',
            })
        })

        it('omits capability-gated items and empty sections when capabilities are web-shaped (v1 off)', () => {
            Object.assign(mockCapabilities, {
                pushNotificationSettings: false,
                walletConnectSettings: false,
                passkeysAutofillSettings: false,
                storeRating: false,
                developerSettings: false,
                rekeyFlows: false,
            })

            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            // Account section keeps only the (still-registered) Security
            // item — the rekeyed-account sweep is gated off on web (its
            // stacks aren't registered in WebMainRoutes).
            expect(settingsOptions[0].items).toEqual([
                {
                    route: 'SecuritySettings',
                    icon: 'shield-check',
                    title: 'settings.main.security_title',
                },
            ])

            // Support section drops Rate + Developer, keeps Terms/Privacy webview links.
            const supportSection = settingsOptions.find(
                section => section.title === 'settings.main.support_section',
            )
            expect(supportSection?.items).toEqual([
                {
                    icon: 'text-document',
                    title: 'settings.main.terms_title',
                    url: 'https://terms.example.com',
                },
                {
                    icon: 'text-document',
                    title: 'settings.main.privacy_title',
                    url: 'https://privacy.example.com',
                },
            ])

            // No section is left empty.
            expect(
                settingsOptions.every(section => section.items.length > 0),
            ).toBe(true)
        })

        it('routes the security item to VaultSecuritySettings when the capability is on', () => {
            Object.assign(mockCapabilities, { vaultSecuritySettings: true })

            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(settingsOptions[0].items[0]).toEqual({
                route: 'VaultSecuritySettings',
                icon: 'shield-check',
                title: 'settings.main.security_title',
            })
        })

        it('omits the Connected Sites item when dappConnections is off (native)', () => {
            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(
                settingsOptions[0].items.some(
                    item => item.route === 'ConnectedSites',
                ),
            ).toBe(false)
        })

        it('includes the Connected Sites item when dappConnections is on (web)', () => {
            Object.assign(mockCapabilities, { dappConnections: true })

            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(settingsOptions[0].items).toContainEqual({
                route: 'ConnectedSites',
                icon: 'globe',
                title: 'settings.main.connected_sites_title',
            })
        })

        it('omits the scan-rekeyed action when rekeyFlows is off (web)', () => {
            Object.assign(mockCapabilities, { rekeyFlows: false })

            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(
                settingsOptions[0].items.some(
                    item => 'action' in item && item.action === 'scanRekeyed',
                ),
            ).toBe(false)
        })

        it('includes the scan-rekeyed action when rekeyFlows is on (native)', () => {
            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(settingsOptions[0].items).toContainEqual({
                action: 'scanRekeyed',
                icon: 'magnifying-glass',
                title: 'settings.main.scan_rekeyed_title',
            })
        })

        it('shows the two separate WalletConnect/Connected Sites items — not the unified one — when connectionsSettings is off (native, always today)', () => {
            Object.assign(mockCapabilities, { dappConnections: true })

            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(settingsOptions[0].items.map(item => item.route)).toEqual([
                'SecuritySettings',
                'NotificationsSettings',
                'WalletConnectSettings',
                'PasskeysSettings',
                'ConnectedSites',
                undefined,
            ])
        })

        it('shows a single unified Connections item instead of the two separate items when connectionsSettings is on (web)', () => {
            Object.assign(mockCapabilities, {
                walletConnectSettings: true,
                dappConnections: true,
                connectionsSettings: true,
            })

            const { result } = renderHook(() => useSettingsOptions())
            const { settingsOptions } = result.current

            expect(settingsOptions[0].items.map(item => item.route)).toEqual([
                'SecuritySettings',
                'NotificationsSettings',
                'ConnectionsSettings',
                'PasskeysSettings',
                undefined,
            ])
            expect(settingsOptions[0].items).toContainEqual({
                route: 'ConnectionsSettings',
                icon: 'globe',
                title: 'settings.main.connections_title',
            })
        })
    })

    it('hides the cloud backup row when the feature flag is off', () => {
        const { result } = renderHook(() => useSettingsOptions())
        const accountItems = result.current.settingsOptions[0].items

        expect(
            accountItems.some(item => item.route === 'CloudBackupSettings'),
        ).toBe(false)
    })

    it('shows the cloud backup row first, marked off until it is configured', () => {
        ;(useIsCloudBackupEnabled as Mock).mockReturnValue(true)

        const { result } = renderHook(() => useSettingsOptions())
        const accountItems = result.current.settingsOptions[0].items

        expect(accountItems[0]).toEqual({
            route: 'CloudBackupSettings',
            icon: 'cloud-check',
            title: 'settings.main.cloud_backup_title',
            value: 'settings.main.cloud_backup_off',
        })
    })

    it('marks the cloud backup row on once a backup is configured', () => {
        ;(useIsCloudBackupEnabled as Mock).mockReturnValue(true)
        mockCloudBackupState.isConfigured = () => true

        const { result } = renderHook(() => useSettingsOptions())

        expect(result.current.settingsOptions[0].items[0].value).toBe(
            'settings.main.cloud_backup_on',
        )
    })
})
