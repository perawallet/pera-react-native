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
import { useBackupInfoScreen } from './useBackupInfoScreen'
import { useStyles } from './styles'

export const BackupInfoScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { onContinue } = useBackupInfoScreen()

    return (
        <PWView style={styles.container}>
            <PWIcon
                name='shield-check'
                variant='link'
                size='xl'
            />
            <PWText variant='h1'>{t('backup.info.title')}</PWText>
            <PWText style={styles.body}>{t('backup.info.body')}</PWText>
            <PWView style={styles.ctaRow}>
                <PWButton
                    variant='primary'
                    title={t('backup.info.cta')}
                    onPress={onContinue}
                    testID='backup_info_continue'
                />
            </PWView>
        </PWView>
    )
}
