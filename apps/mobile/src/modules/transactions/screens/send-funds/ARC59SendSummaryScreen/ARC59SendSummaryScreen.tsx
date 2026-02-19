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
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ARC59WarningBottomSheet } from '@modules/transactions/components/send-funds/ARC59WarningBottomSheet'
import { useStyles } from './styles'
import { useARC59SendSummaryScreen } from './useARC59SendSummaryScreen'

export const ARC59SendSummaryScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        isLoading,
        isWarningVisible,
        formattedAmount,
        formattedFee,
        assetUnitName,
        handleSend,
        handleClose,
        handleReadMore,
        handleWarningConfirm,
        handleWarningClose,
    } = useARC59SendSummaryScreen()

    if (isLoading) {
        return (
            <PWView style={styles.loadingContainer}>
                <ActivityIndicator />
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('send_funds.arc59_summary.title')}
                </PWText>

                <PWIcon
                    name='inbox'
                    size='xxl'
                    style={styles.inboxIcon}
                />

                <PWText style={styles.description}>
                    {t('send_funds.arc59_summary.description')}{' '}
                    <PWText
                        style={styles.readMoreText}
                        onPress={handleReadMore}
                    >
                        {t('send_funds.arc59_summary.read_more')}
                    </PWText>
                </PWText>

                <PWView style={styles.row}>
                    <PWText style={styles.rowLabel}>{assetUnitName}</PWText>
                    <PWText
                        variant='h4'
                        style={styles.rowValue}
                    >
                        {formattedAmount}
                    </PWText>
                </PWView>

                <PWView style={styles.divider} />

                <PWView style={styles.row}>
                    <PWText style={styles.rowLabel}>
                        {t('send_funds.arc59_summary.fees_label')}
                    </PWText>
                    <PWText style={styles.rowValue}>{formattedFee}</PWText>
                </PWView>

                <PWView style={styles.divider} />

                <PWText style={styles.disclaimer}>
                    {t('send_funds.arc59_summary.disclaimer')}
                </PWText>
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    title={t('send_funds.arc59_summary.send_button')}
                    variant='primary'
                    onPress={handleSend}
                />
                <PWButton
                    title={t('send_funds.arc59_summary.close_button')}
                    variant='secondary'
                    onPress={handleClose}
                />
            </PWView>

            <ARC59WarningBottomSheet
                isVisible={isWarningVisible}
                onClose={handleWarningClose}
                onConfirm={handleWarningConfirm}
            />
        </PWView>
    )
}
