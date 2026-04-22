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
import ShieldCheckImage from '@assets/icons/shield-check.svg'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ILLUSTRATION_SIZE } from '../../constants'
import { useBackupInfoScreen } from './useBackupInfoScreen'
import { useStyles } from './styles'

export const BackupInfoScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { onContinue } = useBackupInfoScreen()

    return (
        <PWView style={styles.root}>
            <PWView style={styles.content}>
                <ShieldCheckImage
                    style={styles.image}
                    width={ILLUSTRATION_SIZE}
                    height={ILLUSTRATION_SIZE}
                    color={theme.colors.linkPrimary}
                />
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('backup.info.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('backup.info.body')}
                </PWText>
            </PWView>

            <PWView style={styles.footer}>
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
