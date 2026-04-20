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

import { ActivityIndicator } from 'react-native'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBackupMnemonicScreen } from './useBackupMnemonicScreen'
import { useStyles } from './styles'

export const BackupMnemonicScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { words, isLoading, error, onContinue } = useBackupMnemonicScreen()

    if (isLoading) {
        return (
            <PWView style={styles.container}>
                <ActivityIndicator />
            </PWView>
        )
    }

    if (error) {
        return (
            <PWView style={styles.errorBox}>
                <PWText variant='h1'>{t('backup.mnemonic.error_title')}</PWText>
                <PWText>{t('backup.mnemonic.error_body')}</PWText>
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWText variant='h1'>{t('backup.mnemonic.title')}</PWText>
            <PWText style={styles.body}>{t('backup.mnemonic.body')}</PWText>
            <PWView style={styles.grid}>
                {words.map((word, i) => (
                    <PWView
                        key={`${i}-${word}`}
                        style={styles.wordCell}
                    >
                        <PWText style={styles.wordIndex}>
                            {String(i + 1)}
                        </PWText>
                        <PWText>{word}</PWText>
                    </PWView>
                ))}
            </PWView>
            <PWView style={styles.ctaRow}>
                <PWButton
                    title={t('backup.mnemonic.cta_continue')}
                    variant='primary'
                    onPress={onContinue}
                    testID='backup_mnemonic_continue'
                />
            </PWView>
        </PWView>
    )
}
