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

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTheme } from '@rneui/themed'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ShieldCheckImage from '@assets/icons/shield-check.svg'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBackupFlowWords } from '../../context'
import type { BackupStackParamList } from '../../routes/types'
import { useStyles } from './styles'

export const BackupSuccessScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()
    const navigation =
        useNavigation<
            NativeStackNavigationProp<BackupStackParamList, 'BackupSuccess'>
        >()
    const { clearWords } = useBackupFlowWords()

    const onDone = useCallback(() => {
        clearWords()
        const parent = navigation.getParent()
        if (parent) {
            parent.goBack()
            return
        }
        navigation.popToTop()
    }, [navigation, clearWords])

    return (
        <PWView style={styles.root}>
            <PWView style={styles.content}>
                <ShieldCheckImage
                    style={styles.image}
                    width={160}
                    height={160}
                    color={theme.colors.linkPrimary}
                />
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('backup.success.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('backup.success.body')}
                </PWText>
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    title={t('backup.success.cta_done')}
                    variant='primary'
                    onPress={onDone}
                    testID='backup_success_done'
                />
            </PWView>
        </PWView>
    )
}
