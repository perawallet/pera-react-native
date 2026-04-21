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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import EditPenImage from '@assets/icons/edit-pen.svg'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBackupWriteDownScreen } from './useBackupWriteDownScreen'
import { useStyles } from './styles'

export const BackupWriteDownScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { onContinue } = useBackupWriteDownScreen()

    return (
        <PWView style={styles.root}>
            <PWView style={styles.content}>
                <EditPenImage
                    style={styles.image}
                    width={160}
                    height={160}
                    color={theme.colors.linkPrimary}
                />
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('backup.write_down.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('backup.write_down.body')}
                </PWText>
            </PWView>

            <PWView style={styles.footer}>
                <PWView style={styles.warningRow}>
                    <PWIcon
                        name='info'
                        variant='error'
                    />
                    <PWText
                        variant='body'
                        style={styles.warning}
                    >
                        {t('backup.write_down.warning')}
                    </PWText>
                </PWView>
                <PWButton
                    variant='primary'
                    title={t('backup.write_down.cta')}
                    onPress={onContinue}
                    testID='backup_write_down_begin'
                />
            </PWView>
        </PWView>
    )
}
