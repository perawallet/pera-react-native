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

import { useEffect } from 'react'
import { ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    preventScreenCaptureAsync,
    allowScreenCaptureAsync,
} from 'expo-screen-capture'
import { logger } from '@perawallet/wallet-core-shared'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { PinEditView } from '@modules/security/components/PinEditView'
import { useBackupMnemonicScreen } from './useBackupMnemonicScreen'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'backup-mnemonic'

export const BackupMnemonicScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const {
        words,
        isLoading,
        error,
        isPinVisible,
        isPinGateResolved,
        handlePinVerified,
        handlePinClose,
        onContinue,
    } = useBackupMnemonicScreen()

    // Block screenshots and screen recordings while the mnemonic is on screen.
    // Fails open (permission denied) rather than bricking the flow — logged so
    // we notice in crash reports.
    useEffect(() => {
        void preventScreenCaptureAsync(SCREEN_CAPTURE_TAG).catch(err => {
            logger.error('BackupMnemonic: failed to prevent screen capture', {
                error: err instanceof Error ? err.message : String(err),
            })
        })
        return () => {
            void allowScreenCaptureAsync(SCREEN_CAPTURE_TAG).catch(err => {
                logger.error(
                    'BackupMnemonic: failed to re-allow screen capture',
                    {
                        error: err instanceof Error ? err.message : String(err),
                    },
                )
            })
        }
    }, [])

    if (!isPinGateResolved) {
        return (
            <PWView style={styles.root}>
                <PinEditView
                    mode={isPinVisible ? 'verify' : null}
                    onSuccess={handlePinVerified}
                    onClose={handlePinClose}
                />
            </PWView>
        )
    }

    if (isLoading) {
        return (
            <PWView style={styles.root}>
                <PWView style={styles.loading}>
                    <ActivityIndicator />
                </PWView>
            </PWView>
        )
    }

    if (error) {
        return (
            <PWView style={styles.root}>
                <PWView style={styles.errorBox}>
                    <PWText variant='h1'>
                        {t('backup.mnemonic.error_title')}
                    </PWText>
                    <PWText>{t('backup.mnemonic.error_body')}</PWText>
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView style={styles.root}>
            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('backup.mnemonic.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('backup.mnemonic.body')}
                </PWText>
                <PWView style={styles.grid}>
                    {words.map((word, i) => (
                        <PWView
                            key={`${i}-${word}`}
                            style={styles.wordCell}
                        >
                            <PWText style={styles.wordIndex}>
                                {String(i + 1)}
                            </PWText>
                            <PWText style={styles.wordText}>{word}</PWText>
                        </PWView>
                    ))}
                </PWView>
            </PWView>

            <PWView style={styles.footer}>
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
