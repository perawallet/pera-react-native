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

import { ActivityIndicator } from 'react-native'
import { useTheme } from '@rneui/themed'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type LiquidAuthConnectingContentProps = {
    host: string
    /** Omitted while finalizing (post-confirm), where cancelling is not allowed. */
    onCancel?: () => void
}

export const LiquidAuthConnectingContent = ({
    host,
    onCancel,
}: LiquidAuthConnectingContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { theme } = useTheme()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.center}>
                <ActivityIndicator
                    size='large'
                    color={theme.colors.buttonPrimaryBg}
                    style={styles.spinner}
                />
                <PWText
                    variant='h3'
                    style={styles.message}
                >
                    {t('liquidauth.request.connecting_title')}
                </PWText>
                <PWText style={styles.message}>
                    {t('liquidauth.request.connecting_body', { host })}
                </PWText>
            </PWView>
            {onCancel ? (
                <PWButton
                    variant='linkNeutral'
                    title={t('common.cancel.label')}
                    onPress={onCancel}
                    style={styles.cancelButton}
                />
            ) : null}
        </PWView>
    )
}
