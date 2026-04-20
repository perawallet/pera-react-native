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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PinEditView } from '@modules/security/components/PinEditView'
import { useBackupInstructionsScreen } from './useBackupInstructionsScreen'
import { useStyles } from './styles'

export const BackupInstructionsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isPinVisible, openPin, closePin, handlePinVerified } =
        useBackupInstructionsScreen()

    return (
        <PWView style={styles.container}>
            <PWText variant='h1'>{t('backup.instructions.title')}</PWText>
            <PWText style={styles.body}>{t('backup.instructions.body')}</PWText>
            <PWView style={styles.warningRow}>
                <PWIcon name='cross' />
                <PWText>
                    {t('backup.instructions.warning_no_screenshot')}
                </PWText>
            </PWView>
            <PWView style={styles.warningRow}>
                <PWIcon name='cross' />
                <PWText>{t('backup.instructions.warning_no_share')}</PWText>
            </PWView>
            <PWView style={styles.warningRow}>
                <PWIcon name='check' />
                <PWText>{t('backup.instructions.warning_offline')}</PWText>
            </PWView>
            <PWView style={styles.ctaRow}>
                <PWButton
                    variant='primary'
                    title={t('backup.instructions.cta_reveal')}
                    onPress={openPin}
                    testID='backup_instructions_reveal'
                />
            </PWView>
            <PinEditView
                mode={isPinVisible ? 'verify' : null}
                onSuccess={handlePinVerified}
                onClose={closePin}
            />
        </PWView>
    )
}
