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

import { useTheme } from '@rneui/themed'
import EditPenImage from '@assets/icons/edit-pen.svg'
import { PWIcon, PWInfoView, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ILLUSTRATION_SIZE } from '../../constants'
import { useBackupReminderWriteDownScreen } from './useBackupReminderWriteDownScreen'
import { useStyles } from './styles'

export const BackupReminderWriteDownScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { onContinue } = useBackupReminderWriteDownScreen()

    return (
        <PWInfoView
            illustration={
                <EditPenImage
                    width={ILLUSTRATION_SIZE}
                    height={ILLUSTRATION_SIZE}
                    color={theme.colors.linkPrimary}
                />
            }
            title={t('backup.write_down.title')}
            body={t('backup.write_down.body')}
            footerExtras={
                <PWView style={styles.warningRow}>
                    <PWIcon
                        name='warning'
                        variant='error'
                    />
                    <PWText
                        variant='body'
                        style={styles.warning}
                    >
                        {t('backup.write_down.warning')}
                    </PWText>
                </PWView>
            }
            primaryAction={{
                label: t('backup.write_down.cta'),
                onPress: onContinue,
                testID: 'backup_write_down_begin',
            }}
        />
    )
}
