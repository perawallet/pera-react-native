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

import { useMemo } from 'react'
import { PWLoadingOverlay, PWScreen, PWText, PWView } from '@components/core'
import { OptionList, type OptionListOption } from '@components/OptionList'
import { useLanguage } from '@hooks/useLanguage'
import { useCloudBackupScreen } from './useCloudBackupScreen'
import { useStyles } from './styles'

export const CloudBackupScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { handleSetUpBackup, handleRestoreBackup, isReadingCredentials } =
        useCloudBackupScreen()

    const options = useMemo<OptionListOption[]>(
        () => [
            {
                key: 'setup',
                leftIcon: 'cloud-upload',
                title: t('cloud_backup.main.setup_title'),
                description: t('cloud_backup.main.setup_description'),
                onPress: handleSetUpBackup,
                testID: 'cloud_backup_setup_option',
            },
            {
                key: 'restore',
                leftIcon: 'cloud-download',
                title: t('cloud_backup.main.restore_title'),
                description: t('cloud_backup.main.restore_description'),
                onPress: () => void handleRestoreBackup(),
                testID: 'cloud_backup_restore_option',
            },
        ],
        [handleSetUpBackup, handleRestoreBackup, t],
    )

    return (
        <>
            <PWScreen
                testID='cloud_backup_screen'
                footer={
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.note}
                    >
                        {t('cloud_backup.main.storage_note')}
                    </PWText>
                }
            >
                <PWView style={styles.header}>
                    <PWText variant='h1'>{t('cloud_backup.main.title')}</PWText>
                    <PWText variant='bodyLarge'>
                        {t('cloud_backup.main.subtitle')}
                    </PWText>
                </PWView>

                <OptionList options={options} />
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isReadingCredentials}
                title={t('cloud_backup.restore.import_reading')}
            />
        </>
    )
}
