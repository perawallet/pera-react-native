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

import { ParamListBase, useNavigation } from '@react-navigation/native'
import { PWListItem, PWView } from '@components/core'
import { useStyles } from './styles'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { Networks } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { v4 as uuid } from 'uuid'

export const SettingsDeveloperScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { network } = useNetwork()
    const styles = useStyles()
    const { t } = useLanguage()
    const { getPreference } = usePreferences()
    const { pushWebView } = useWebView()

    const handleTapEvent = (page: string) => {
        navigation.push(page)
    }

    const openDispenser = () => {
        pushWebView({
            url: config.dispenserUrl,
            id: uuid(),
            enablePeraConnect: true,
        })
    }

    return (
        <PWView style={styles.container}>
            <PWListItem
                onPress={() => handleTapEvent('NodeSettings')}
                icon='tree'
                title={t('settings.developer.node_settings_title')}
            />
            {network === Networks.testnet && (
                <PWListItem
                    onPress={openDispenser}
                    icon='algo'
                    title={t('settings.developer.dispenser_title')}
                />
            )}
            {getPreference(UserPreferences.developerMenuEnabled) && (
                <PWListItem
                    onPress={() => handleTapEvent('DevMenu')}
                    icon='sliders'
                    title={t('screens.developer_menu')}
                />
            )}
        </PWView>
    )
}
