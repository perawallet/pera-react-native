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

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWButton, PWScrollView, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupQuizItem } from '../../components/BackupQuizItem'
import { useBackupVerificationScreen } from './useBackupVerificationScreen'
import { useStyles } from './styles'

export const BackupVerificationScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const { items, onSelect, onSubmit, isFilled } =
        useBackupVerificationScreen()

    return (
        <PWView style={styles.root}>
            <PWScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
            >
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('backup.verification.title')}
                </PWText>
                <PWView style={styles.quizList}>
                    {items.map((item, i) => (
                        <BackupQuizItem
                            key={`${item.position}-${i}`}
                            position={item.position}
                            options={item.options}
                            selectedWord={item.selectedWord}
                            onSelect={word => onSelect(i, word)}
                            testID={`backup_verification_item_${i}`}
                        />
                    ))}
                </PWView>
            </PWScrollView>

            <PWView style={styles.footer}>
                <PWButton
                    title={t('backup.verification.cta_next')}
                    variant='primary'
                    isDisabled={!isFilled}
                    onPress={onSubmit}
                    testID='backup_verification_next'
                />
            </PWView>
        </PWView>
    )
}
