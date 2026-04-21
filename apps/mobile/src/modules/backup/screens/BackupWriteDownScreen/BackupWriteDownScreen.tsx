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
import { useBackupWriteDownScreen } from './useBackupWriteDownScreen'
import { useStyles } from './styles'

export const BackupWriteDownScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isPinVisible, openPin, closePin, handlePinVerified } =
        useBackupWriteDownScreen()

    return (
        <PWView style={styles.container}>
            <PWIcon
                name='edit-pen'
                variant='link'
                size='xl'
            />
            <PWText variant='h1'>{t('backup.write_down.title')}</PWText>
            <PWText style={styles.body}>{t('backup.write_down.body')}</PWText>
            <PWText style={styles.warning}>
                {t('backup.write_down.warning')}
            </PWText>
            <PWView style={styles.ctaRow}>
                <PWButton
                    variant='primary'
                    title={t('backup.write_down.cta')}
                    onPress={openPin}
                    testID='backup_write_down_begin'
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
