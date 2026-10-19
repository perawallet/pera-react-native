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

import { PWButton, PWRadioButton, PWText, PWView } from '@components/core'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'
import type { NodeSettingsNetworkRow } from './useSettingsDeveloperNodeSettingsScreen'
import { useStyles } from './styles'

export type NodeSettingsRowProps = {
    chainId: ChainId
    row: NodeSettingsNetworkRow
    onSelect: () => void
    onOverrideEndpoint: () => void
}

export const NodeSettingsRow = ({
    chainId,
    row,
    onSelect,
    onOverrideEndpoint,
}: NodeSettingsRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const testIdPrefix = `node_settings_${chainId}_${row.networkId}`

    // The `_row` testID is for on-device automation, distinct from the
    // radio's own `_radio` testID.
    return (
        <PWView testID={`${testIdPrefix}_row`}>
            <PWRadioButton
                testID={`${testIdPrefix}_radio`}
                onPress={onSelect}
                isSelected={row.isSelected}
            >
                <PWText>{row.label}</PWText>
                {row.endpointHost !== undefined && (
                    <PWText
                        variant='caption'
                        testID={`${testIdPrefix}_endpoint`}
                    >
                        {row.isEndpointOverridden
                            ? t(
                                  'settings.developer.node_settings.endpoint_overridden',
                                  { host: row.endpointHost },
                              )
                            : row.endpointHost}
                    </PWText>
                )}
            </PWRadioButton>
            {row.canOverrideEndpoint && (
                <PWButton
                    testID={`${testIdPrefix}_override_button`}
                    variant='linkNeutral'
                    title={t('settings.developer.node_settings.override_endpoint')}
                    onPress={onOverrideEndpoint}
                    style={styles.overrideButton}
                />
            )}
        </PWView>
    )
}
