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

import { PWScreen, PWSwitch, PWText, PWView } from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { useLanguage } from '@hooks/useLanguage'
import { NodeSettingsChainNetworks } from './NodeSettingsChainNetworks'
import { useSettingsDeveloperNodeSettingsScreen } from './useSettingsDeveloperNodeSettingsScreen'
import { useStyles } from './styles'

export const SettingsDeveloperNodeSettingsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isDeveloperMode, setDeveloperMode, chainSections, selectNetwork } =
        useSettingsDeveloperNodeSettingsScreen()

    return (
        <PWScreen>
            <PWView
                style={styles.container}
                testID='node_settings_screen'
            >
                <PWView
                    style={styles.modeRow}
                    testID='node_settings_developer_mode_row'
                >
                    <PWView style={styles.modeText}>
                        <PWText variant='body'>
                            {t(
                                'settings.developer.node_settings.developer_mode_title',
                            )}
                        </PWText>
                        <PWText variant='caption'>
                            {t(
                                'settings.developer.node_settings.developer_mode_body',
                            )}
                        </PWText>
                    </PWView>
                    <PWSwitch
                        value={isDeveloperMode}
                        onValueChange={setDeveloperMode}
                        testID='node_settings_developer_mode_switch'
                    />
                </PWView>
            </PWView>
            {isDeveloperMode && (
                <>
                    <NodeSettingsChainNetworks
                        chainSections={chainSections}
                        onSelect={(chainId, networkId) =>
                            void selectNetwork(chainId, networkId)
                        }
                    />
                    <InfoCallout
                        title={t(
                            'settings.developer.node_settings.non_mainnet_warning_title',
                        )}
                        body={t(
                            'settings.developer.node_settings.non_mainnet_warning_body',
                        )}
                        style={styles.notice}
                        testID='node_settings_non_mainnet_notice'
                    />
                </>
            )}
        </PWScreen>
    )
}
