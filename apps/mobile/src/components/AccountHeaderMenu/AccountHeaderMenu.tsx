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

import { useMemo } from 'react'
import { PWDropdown, PWDropdownItem, PWIcon, PWView } from '@components/core'
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'

export type AccountHeaderMenuProps = {
    testID?: string
}

export const AccountHeaderMenu = ({
    testID = 'account_header_menu',
}: AccountHeaderMenuProps) => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { getPreference, setPreference } = usePreferences()
    const { privacyMode, setPrivacyMode } = useSettings()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)

    const items: PWDropdownItem[] = useMemo(
        () => [
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
        ],
        [
            chartVisible,
            privacyMode,
            t,
            setPreference,
            setPrivacyMode,
            navigation,
        ],
    )

    return (
        <PWView testID={testID}>
            <PWDropdown items={items}>
                <PWIcon name='ellipsis' />
            </PWDropdown>
        </PWView>
    )
}
