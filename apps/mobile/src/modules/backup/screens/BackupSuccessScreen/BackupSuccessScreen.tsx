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
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export const BackupSuccessScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation() as unknown as {
        popToTop?: () => void
        getParent?: () => { goBack: () => void } | undefined
    }

    const onDone = useCallback(() => {
        const parent = navigation.getParent?.()
        if (parent && typeof parent.goBack === 'function') {
            parent.goBack()
            return
        }
        if (typeof navigation.popToTop === 'function') {
            navigation.popToTop()
        }
    }, [navigation])

    return (
        <PWView style={styles.container}>
            <PWIcon name='check' />
            <PWText style={styles.title}>{t('backup.success.title')}</PWText>
            <PWText style={styles.body}>{t('backup.success.body')}</PWText>
            <PWView style={styles.ctaRow}>
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
