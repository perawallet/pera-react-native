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

import {
    PWButton,
    PWInput,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useCustomNetworkSheet } from './useCustomNetworkSheet'

/**
 * Pure presentation over `useCustomNetworkSheet` — every field is a
 * controlled draft value, and Save/Cancel/Reset just forward to the sheet's
 * handlers. Mounted by the app's bottom-sheet manager
 * (`@modules/bottom-sheet`) rather than a directly-rendered `PWBottomSheet`,
 * so the manager's host supplies the sheet chrome (backdrop, dismiss,
 * hardware back) and this component only renders the content and
 * resolves/dismisses itself via `useBottomSheetResult`.
 */
export const CustomNetworkSheet = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const sheet = useCustomNetworkSheet()
    const { resolve, dismiss } = useBottomSheetResult<void>()

    const handleSaveAndClose = async () => {
        if (await sheet.handleSave()) {
            resolve()
        }
    }

    return (
        <PWScrollView
            inBottomSheet
            contentContainerStyle={styles.sheetContent}
            testID='custom_network_sheet'
        >
            <PWText variant='h3'>
                {t('settings.developer.node_settings.custom_sheet_title')}
            </PWText>

            <PWInput
                testID='custom_network_algod_url_input'
                label={t('settings.developer.node_settings.algod_url_label')}
                value={sheet.draft.algodUrl}
                onChangeText={text => sheet.handleFieldChange('algodUrl', text)}
                errorMessage={
                    sheet.errors.algodUrl
                        ? t('settings.developer.node_settings.invalid_url')
                        : undefined
                }
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='url'
            />
            <PWInput
                testID='custom_network_algod_token_input'
                label={t('settings.developer.node_settings.algod_token_label')}
                value={sheet.draft.algodToken}
                onChangeText={text =>
                    sheet.handleFieldChange('algodToken', text)
                }
                autoCapitalize='none'
                autoCorrect={false}
            />

            <PWButton
                testID='custom_network_fetch_button'
                variant='secondary'
                title={t('settings.developer.node_settings.fetch_from_node')}
                onPress={() => void sheet.handleFetchGenesis()}
                isLoading={sheet.isFetching}
                style={styles.fetchButton}
            />
            {sheet.errors.fetch && (
                <PWText
                    variant='caption'
                    style={styles.errorText}
                >
                    {t('settings.developer.node_settings.fetch_failed')}
                </PWText>
            )}

            <PWInput
                testID='custom_network_indexer_url_input'
                label={t('settings.developer.node_settings.indexer_url_label')}
                value={sheet.draft.indexerUrl}
                onChangeText={text =>
                    sheet.handleFieldChange('indexerUrl', text)
                }
                errorMessage={
                    sheet.errors.indexerUrl
                        ? t('settings.developer.node_settings.invalid_url')
                        : undefined
                }
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='url'
            />
            <PWInput
                testID='custom_network_indexer_token_input'
                label={t(
                    'settings.developer.node_settings.indexer_token_label',
                )}
                value={sheet.draft.indexerToken}
                onChangeText={text =>
                    sheet.handleFieldChange('indexerToken', text)
                }
                autoCapitalize='none'
                autoCorrect={false}
            />

            <PWInput
                testID='custom_network_genesis_hash_input'
                label={t('settings.developer.node_settings.genesis_hash_label')}
                value={sheet.draft.genesisHash}
                onChangeText={text =>
                    sheet.handleFieldChange('genesisHash', text)
                }
                errorMessage={
                    sheet.errors.genesisHash
                        ? t('settings.developer.node_settings.genesis_required')
                        : undefined
                }
                autoCapitalize='none'
                autoCorrect={false}
            />
            <PWInput
                testID='custom_network_genesis_id_input'
                label={t('settings.developer.node_settings.genesis_id_label')}
                value={sheet.draft.genesisId}
                onChangeText={text =>
                    sheet.handleFieldChange('genesisId', text)
                }
                errorMessage={
                    sheet.errors.genesisId
                        ? t(
                              'settings.developer.node_settings.genesis_id_required',
                          )
                        : undefined
                }
                autoCapitalize='none'
                autoCorrect={false}
            />

            <PWButton
                testID='custom_network_save_button'
                variant='primary'
                title={t('settings.developer.node_settings.save')}
                onPress={() => void handleSaveAndClose()}
            />
            <PWView style={styles.actionsRow}>
                <PWButton
                    testID='custom_network_cancel_button'
                    variant='linkNeutral'
                    title={t('settings.developer.node_settings.cancel')}
                    onPress={dismiss}
                />
                <PWButton
                    testID='custom_network_reset_button'
                    variant='linkNeutral'
                    title={t('settings.developer.node_settings.reset')}
                    onPress={sheet.handleReset}
                />
            </PWView>
        </PWScrollView>
    )
}
