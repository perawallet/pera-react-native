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

import { type NodeEndpointOverride } from '@perawallet/wallet-core-blockchain'

import {
    PWButton,
    PWInput,
    PWRadioButton,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useNodeSettingsRow } from './useNodeSettingsRow'
import { useStyles } from './styles'
import type { NetworkRow } from './useSettingsDeveloperNodeSettingsScreen'

export type NodeSettingsRowProps = {
    row: NetworkRow
    label: string
    /** Disables the radio while a network switch is already in flight (web). */
    isDisabled?: boolean
    onSelect: () => void
    onSave: (endpoints: NodeEndpointOverride) => void
    onReset: () => void
}

export const NodeSettingsRow = ({
    row,
    label,
    isDisabled = false,
    onSelect,
    onSave,
    onReset,
}: NodeSettingsRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        algodUrlInput,
        indexerUrlInput,
        algodUrlError,
        indexerUrlError,
        handleAlgodUrlChange,
        handleIndexerUrlChange,
        handleSave,
        handleReset,
    } = useNodeSettingsRow({ row, onSave, onReset })

    return (
        <PWView
            style={styles.rowContainer}
            testID={`node_settings_${row.network}_row`}
        >
            <PWRadioButton
                testID={`node_settings_${row.network}_radio`}
                title={label}
                onPress={onSelect}
                isSelected={row.isSelected}
                isDisabled={isDisabled}
            />
            {row.isOverridden && (
                <PWText
                    variant='caption'
                    style={styles.overriddenHint}
                >
                    {t('settings.developer.node_settings.overridden_hint')}
                </PWText>
            )}
            <PWText
                variant='caption'
                style={styles.sectionTitle}
            >
                {t('settings.developer.node_settings.custom_endpoints_title')}
            </PWText>
            <PWInput
                testID={`node_settings_${row.network}_algod_url_input`}
                label={t('settings.developer.node_settings.algod_url_label')}
                value={algodUrlInput}
                onChangeText={handleAlgodUrlChange}
                errorMessage={
                    algodUrlError
                        ? t('settings.developer.node_settings.invalid_url')
                        : undefined
                }
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='url'
            />
            <PWInput
                testID={`node_settings_${row.network}_indexer_url_input`}
                label={t('settings.developer.node_settings.indexer_url_label')}
                value={indexerUrlInput}
                onChangeText={handleIndexerUrlChange}
                errorMessage={
                    indexerUrlError
                        ? t('settings.developer.node_settings.invalid_url')
                        : undefined
                }
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='url'
            />
            <PWView style={styles.actionsRow}>
                <PWButton
                    testID={`node_settings_${row.network}_save_button`}
                    variant='secondary'
                    title={t('settings.developer.node_settings.save_endpoints')}
                    onPress={handleSave}
                />
                {row.isOverridden && (
                    <PWButton
                        testID={`node_settings_${row.network}_reset_button`}
                        variant='linkNeutral'
                        title={t(
                            'settings.developer.node_settings.reset_endpoints',
                        )}
                        onPress={handleReset}
                    />
                )}
            </PWView>
        </PWView>
    )
}
