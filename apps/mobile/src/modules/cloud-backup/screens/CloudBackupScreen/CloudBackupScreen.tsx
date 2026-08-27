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

import { PWScreen, PWText, PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { useCloudBackupScreen } from './useCloudBackupScreen'
import { useStyles } from './styles'

export const CloudBackupScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { handleSetUpBackup, handleRestoreBackup } = useCloudBackupScreen()

    return (
        <PWScreen testID='cloud_backup_screen'>
            <PWView style={styles.header}>
                <PWText variant='h1'>{t('cloud_backup.main.title')}</PWText>
                <PWText variant='bodyLarge'>
                    {t('cloud_backup.main.subtitle')}
                </PWText>
            </PWView>

            <PWView style={styles.options}>
                <PanelButton
                    leftIcon='cloud-upload'
                    titleWeight='h3'
                    title={t('cloud_backup.main.setup_title')}
                    description={t('cloud_backup.main.setup_description')}
                    onPress={handleSetUpBackup}
                    testID='cloud_backup_setup_option'
                />
                <PanelButton
                    leftIcon='cloud-download'
                    titleWeight='h3'
                    title={t('cloud_backup.main.restore_title')}
                    description={t('cloud_backup.main.restore_description')}
                    onPress={handleRestoreBackup}
                    testID='cloud_backup_restore_option'
                />
            </PWView>
        </PWScreen>
    )
}
