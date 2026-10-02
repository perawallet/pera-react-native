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

import { useCallback, useMemo } from 'react'
import type { PWDropdownItem } from '@components/core'
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getSyncService } from '@perawallet/wallet-core-background'
import { UserPreferences } from '@constants/user-preferences'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { routeCapabilities } from '@routes/capabilities'
import { lockWallet } from './lockWallet'

export type UseAccountHeaderMenuOptions = {
    showChartToggle?: boolean
}

export type UseAccountHeaderMenuResult = {
    items: PWDropdownItem[]
}

export const useAccountHeaderMenu = ({
    showChartToggle = true,
}: UseAccountHeaderMenuOptions = {}): UseAccountHeaderMenuResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { getPreference, setPreference } = usePreferences()
    const { privacyMode, setPrivacyMode } = useSettings()
    const mode = useNetworkStore(state => state.mode)
    const setMode = useNetworkStore(state => state.setMode)
    const isDeveloperMode = mode === 'developer'

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const isDeveloperMenuEnabled = !!getPreference(
        UserPreferences.developerMenuEnabled,
    )

    const handleModeToggle = useCallback(() => {
        setMode(isDeveloperMode ? 'live' : 'developer')
        try {
            // Invalidation is owned by RootComponent's network effect;
            // calling it here too would double-refetch every mounted query.
            getSyncService().restart()
        } catch {
            // SyncService not yet initialized
        }
    }, [isDeveloperMode, setMode])

    const items = useMemo<PWDropdownItem[]>(() => {
        const baseItems: PWDropdownItem[] = [
            {
                label: privacyMode
                    ? t('common.exit_stealth_mode')
                    : t('common.enter_stealth_mode'),
                icon: 'eye',
                onPress: () => setPrivacyMode(!privacyMode),
            },
            {
                label: t('search.title'),
                icon: 'magnifying-glass',
                onPress: () =>
                    navigation.navigate('Search', { screen: 'SearchScreen' }),
            },
        ]

        if (showChartToggle) {
            baseItems.unshift({
                label: chartVisible
                    ? t('portfolio.hide_chart')
                    : t('portfolio.show_chart'),
                icon: chartVisible ? 'text-document' : 'chart',
                onPress: () =>
                    setPreference(UserPreferences.chartVisible, !chartVisible),
            })
        }

        if (lockWallet) {
            baseItems.push({
                label: t('vault.security.lock_now'),
                icon: 'locked',
                // VaultGate observes the lock and takes over the screen.
                onPress: () => void lockWallet?.(),
            })
        }

        if (isDeveloperMenuEnabled) {
            baseItems.push({
                label: isDeveloperMode
                    ? t(
                          'settings.developer.node_settings.disable_developer_mode',
                      )
                    : t(
                          'settings.developer.node_settings.enable_developer_mode',
                      ),
                icon: 'globe',
                onPress: handleModeToggle,
            })
        }

        if (isDeveloperMenuEnabled && routeCapabilities.developerGallery) {
            baseItems.push({
                label: 'Screen Gallery',
                icon: 'grid-view',
                onPress: () =>
                    navigation.navigate('Settings', {
                        screen: 'DeveloperSettings',
                        params: { screen: 'Gallery' },
                    }),
            })
        }

        return baseItems
    }, [
        showChartToggle,
        chartVisible,
        privacyMode,
        t,
        setPreference,
        setPrivacyMode,
        navigation,
        isDeveloperMenuEnabled,
        isDeveloperMode,
        handleModeToggle,
    ])

    return { items }
}
