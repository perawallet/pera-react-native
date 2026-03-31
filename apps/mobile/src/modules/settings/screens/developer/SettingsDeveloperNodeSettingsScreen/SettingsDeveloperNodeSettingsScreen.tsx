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
import { PWRadioButton } from '@components/core/PWRadioButton'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-shared'
import { useSwitchNetwork } from '@perawallet/wallet-core-device'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { getSyncService } from '@perawallet/wallet-core-sync'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export const SettingsDeveloperNodeSettingsScreen = () => {
    const styles = useStyles()
    const { isMainnet, isTestnet } = useNetwork()
    const { switchNetwork, isSwitching } = useSwitchNetwork()
    const accounts = useAllAccounts()
    const { t } = useLanguage()
    const { showToast } = useToast()

    const handleNetworkSwitch = async (
        network: typeof Networks.mainnet | typeof Networks.testnet,
    ) => {
        const addresses = accounts?.map(account => account.address) ?? []
        try {
            await switchNetwork(network, addresses)
            try {
                const syncService = getSyncService()
                syncService.invalidateQueries()
                syncService.restart()
            } catch {
                // SyncService not yet initialized
            }
        } catch {
            showToast({
                title: t('settings.developer.node_settings.switch_error_title'),
                body: t('settings.developer.node_settings.switch_error_body'),
                type: 'error',
            })
        }
    }

    return (
        <PWView style={styles.container}>
            <PWRadioButton
                testID='node_settings_mainnet_radio'
                title={t('settings.developer.node_settings.mainnet_label')}
                onPress={() => handleNetworkSwitch(Networks.mainnet)}
                isSelected={isMainnet}
                isDisabled={isSwitching}
            />
            <PWRadioButton
                testID='node_settings_testnet_radio'
                title={t('settings.developer.node_settings.testnet_label')}
                onPress={() => handleNetworkSwitch(Networks.testnet)}
                isSelected={isTestnet}
                isDisabled={isSwitching}
            />
        </PWView>
    )
}
