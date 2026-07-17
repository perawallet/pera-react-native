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

import { Networks } from '@perawallet/wallet-core-shared'

import { PWScreen, PWView } from '@components/core'
import { PWRadioButton } from '@components/core/PWRadioButton'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsDeveloperNodeSettingsScreen } from './useSettingsDeveloperNodeSettingsScreen.web'
import { useStyles } from './styles'

export const SettingsDeveloperNodeSettingsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isMainnet, isTestnet, isSwitching, switchTo } =
        useSettingsDeveloperNodeSettingsScreen()

    return (
        <PWScreen>
            <PWView
                style={styles.container}
                testID='node_settings_screen'
            >
                <PWRadioButton
                    testID='node_settings_mainnet_radio'
                    title={t('settings.developer.node_settings.mainnet_label')}
                    onPress={() => void switchTo(Networks.mainnet)}
                    isSelected={isMainnet}
                    isDisabled={isSwitching}
                />
                <PWRadioButton
                    testID='node_settings_testnet_radio'
                    title={t('settings.developer.node_settings.testnet_label')}
                    onPress={() => void switchTo(Networks.testnet)}
                    isSelected={isTestnet}
                    isDisabled={isSwitching}
                />
            </PWView>
        </PWScreen>
    )
}
