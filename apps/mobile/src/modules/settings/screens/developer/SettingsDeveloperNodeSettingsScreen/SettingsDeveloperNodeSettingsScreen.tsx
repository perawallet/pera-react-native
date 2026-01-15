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

import { useStyles } from './styles'
import { PWView } from '@components/core'
import { RadioButton } from '@components/RadioButton'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { Networks } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

export const SettingsDeveloperNodeSettingsScreen = () => {
    const styles = useStyles()
    const { network, setNetwork } = useNetwork()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <RadioButton
                title={t('settings.developer.node_settings.mainnet_label')}
                onPress={() => setNetwork(Networks.mainnet)}
                isSelected={network === Networks.mainnet}
            />
            <RadioButton
                title={t('settings.developer.node_settings.testnet_label')}
                onPress={() => setNetwork(Networks.testnet)}
                isSelected={network === Networks.testnet}
            />
        </PWView>
    )
}
