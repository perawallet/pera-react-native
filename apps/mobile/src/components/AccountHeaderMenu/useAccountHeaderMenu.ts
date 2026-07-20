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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-shared'
import { useSwitchNetwork } from '@perawallet/wallet-core-device'
import { getSyncService } from '@perawallet/wallet-core-background'
import { UserPreferences } from '@constants/user-preferences'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'

export type UseAccountHeaderMenuResult = {
    items: PWDropdownItem[]
}

export const useAccountHeaderMenu = (): UseAccountHeaderMenuResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { getPreference, setPreference } = usePreferences()
    const { privacyMode, setPrivacyMode } = useSettings()
    const { isMainnet } = useNetwork()
    const { switchNetwork } = useSwitchNetwork()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const isDeveloperMenuEnabled = !!getPreference(
        UserPreferences.developerMenuEnabled,
    )

    const handleNetworkSwitch = useCallback(async () => {
        const target = isMainnet ? Networks.testnet : Networks.mainnet
        // Offline-safe local write; registration is deferred (see
        // useSwitchNetwork). No failure to toast about.
        await switchNetwork(target)
        try {
            const syncService = getSyncService()
            syncService.invalidateQueries()
            syncService.restart()
        } catch {
            // SyncService not yet initialized
        }
    }, [isMainnet, switchNetwork])

    const items = useMemo<PWDropdownItem[]>(() => {
        const baseItems: PWDropdownItem[] = [
            {
                label: chartVisible
                    ? t('portfolio.hide_chart')
                    : t('portfolio.show_chart'),
                icon: chartVisible ? 'text-document' : 'chart',
                onPress: () =>
                    setPreference(UserPreferences.chartVisible, !chartVisible),
            },
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

        if (isDeveloperMenuEnabled) {
            baseItems.push({
                label: isMainnet
                    ? t('settings.developer.node_settings.enable_testnet')
                    : t('settings.developer.node_settings.enable_mainnet'),
                icon: 'globe',
                onPress: () => void handleNetworkSwitch(),
            })

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
        chartVisible,
        privacyMode,
        t,
        setPreference,
        setPrivacyMode,
        navigation,
        isDeveloperMenuEnabled,
        isMainnet,
        handleNetworkSwitch,
    ])

    return { items }
}
