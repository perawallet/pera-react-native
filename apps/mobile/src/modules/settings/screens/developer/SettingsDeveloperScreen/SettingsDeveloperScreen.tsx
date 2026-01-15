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
import { PWListItem } from '@components/core/PWListItem'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { Networks } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/language'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

export const SettingsDeveloperScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { network } = useNetwork()
    const styles = useStyles()
    const { t } = useLanguage()
    const { getPreference } = usePreferences()

    const handleTapEvent = (page: string) => {
        navigation.push(page)
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
                    onPress={() => handleTapEvent('DispenserSettings')}
                    icon='algo'
                    title={t('settings.developer.dispenser_title')}
                />
            )}
            {getPreference(UserPreferences.developerMenuEnabled) && (
                <PWListItem
                    onPress={() => handleTapEvent('DevMenu')}
                    icon='globe'
                    title={t('screens.developer_menu')}
                />
            )}
        </PWView>
    )
}
