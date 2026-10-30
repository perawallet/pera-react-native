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
import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { INVALID_ENDPOINT_MESSAGE_KEY } from './isValidEndpoint'
import { useStyles } from './styles'
import {
    useEndpointOverrideSheet,
    type EndpointOverrideSheetError,
} from './useEndpointOverrideSheet'

export type EndpointOverrideSheetProps = {
    chainId: ChainId
    networkId: NetworkId
}

export const EndpointOverrideSheet = ({
    chainId,
    networkId,
}: EndpointOverrideSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const sheet = useEndpointOverrideSheet({ chainId, networkId })
    const { resolve, dismiss } = useBottomSheetResult<void>()

    const errorMessage = (error: Optional<EndpointOverrideSheetError>) => {
        if (error === 'invalid-url') {
            return t(INVALID_ENDPOINT_MESSAGE_KEY)
        }
        if (error === 'wrong-network') {
            return t(
                'settings.developer.node_settings.endpoint_wrong_network',
                { network: sheet.networkName },
            )
        }
        if (error === 'unreachable') {
            return t('settings.developer.node_settings.endpoint_unreachable')
        }
        return undefined
    }

    const handleSaveAndClose = async () => {
        if (await sheet.handleSave()) {
            resolve()
        }
    }

    const handleResetAndClose = () => {
        sheet.handleReset()
        resolve()
    }

    return (
        <PWScrollView
            inBottomSheet
            contentContainerStyle={styles.sheetContent}
            testID='endpoint_override_sheet'
        >
            <PWText variant='h3'>
                {t('settings.developer.node_settings.endpoint_sheet_title', {
                    network: sheet.networkName,
                })}
            </PWText>
            {sheet.currentHost !== undefined && (
                <PWText variant='caption'>
                    {t('settings.developer.node_settings.endpoint_current', {
                        host: sheet.currentHost,
                    })}
                </PWText>
            )}

            <PWInput
                testID='endpoint_override_url_input'
                label={t('settings.developer.node_settings.endpoint_url_label')}
                value={sheet.url}
                onChangeText={sheet.handleUrlChange}
                errorMessage={errorMessage(sheet.error)}
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='url'
            />

            <PWButton
                testID='endpoint_override_save_button'
                variant='primary'
                title={t('settings.developer.node_settings.endpoint_save')}
                onPress={() => void handleSaveAndClose()}
                isLoading={sheet.isChecking}
            />
            <PWView style={styles.actionsRow}>
                <PWButton
                    testID='endpoint_override_cancel_button'
                    variant='linkNeutral'
                    title={t('settings.developer.node_settings.cancel')}
                    onPress={dismiss}
                />
                {sheet.hasOverride && (
                    <PWButton
                        testID='endpoint_override_reset_button'
                        variant='linkNeutral'
                        title={t(
                            'settings.developer.node_settings.endpoint_reset',
                        )}
                        onPress={handleResetAndClose}
                    />
                )}
            </PWView>
        </PWScrollView>
    )
}
