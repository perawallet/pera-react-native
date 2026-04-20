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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupSlotList } from '../../components/BackupSlotList'
import { BackupWordPool } from '../../components/BackupWordPool'
import { useBackupVerificationScreen } from './useBackupVerificationScreen'
import { useStyles } from './styles'

export const BackupVerificationScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        slots,
        poolWords,
        onTapPoolWord,
        onTapSlot,
        onFinish,
        onStartOver,
        isFilled,
        validationError,
    } = useBackupVerificationScreen()

    return (
        <PWView style={styles.container}>
            <PWText style={styles.title}>
                {t('backup.verification.title')}
            </PWText>
            <PWText style={styles.body}>{t('backup.verification.body')}</PWText>

            <BackupSlotList
                slots={slots}
                onTapSlot={onTapSlot}
                hasError={validationError}
            />

            <PWView style={styles.poolSection}>
                <BackupWordPool
                    words={poolWords}
                    onTapWord={onTapPoolWord}
                />
            </PWView>

            {validationError ? (
                <PWText style={styles.errorText}>
                    {t('backup.verification.error_message')}
                </PWText>
            ) : null}

            <PWView style={styles.ctaRow}>
                <PWButton
                    title={t('backup.verification.cta_finish')}
                    variant='primary'
                    isDisabled={!isFilled}
                    onPress={onFinish}
                    testID='backup_verification_finish'
                />
                <PWButton
                    title={t('backup.verification.cta_start_over')}
                    variant='secondary'
                    onPress={onStartOver}
                    testID='backup_verification_start_over'
                />
            </PWView>
        </PWView>
    )
}
