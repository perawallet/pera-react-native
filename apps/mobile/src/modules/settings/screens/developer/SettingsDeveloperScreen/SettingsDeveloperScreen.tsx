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

import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { generateUniqueId } from '@perawallet/wallet-core-shared'

import { PWListItem, PWScreen } from '@components/core'
import { UserPreferences } from '@constants/user-preferences'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'

export const SettingsDeveloperScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const { getPreference } = usePreferences()
    const { pushWebView } = useWebView()
    const { isMainnet, network } = useNetwork()
    const { dispenserUrl } = getNetworkConfig(network)

    const handleTapEvent = (page: string) => {
        navigation.push(page)
    }

    const openDispenser = () => {
        pushWebView({
            url: dispenserUrl,
            id: generateUniqueId(),
            enablePeraConnect: true,
        })
    }

    return (
        <PWScreen testID='developer_settings_screen'>
            <PWListItem
                onPress={() => handleTapEvent('NodeSettings')}
                icon='tree'
                title={t('settings.developer.node_settings_title')}
                testID='developer_settings_node_item'
            />

            {!isMainnet && dispenserUrl.length > 0 && (
                <PWListItem
                    onPress={openDispenser}
                    icon='algo'
                    title={t('settings.developer.dispenser_title')}
                    testID='developer_settings_dispenser_item'
                />
            )}

            {getPreference(UserPreferences.developerMenuEnabled) && (
                <PWListItem
                    onPress={() => handleTapEvent('DevMenu')}
                    icon='sliders'
                    title={t('screens.developer_menu')}
                    testID='developer_settings_menu_item'
                />
            )}
        </PWScreen>
    )
}
