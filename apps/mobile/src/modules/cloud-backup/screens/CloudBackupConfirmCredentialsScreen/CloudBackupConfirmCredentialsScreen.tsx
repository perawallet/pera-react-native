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

import { PWButton, PWInput, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { BackupQuizItem } from '@modules/backup'
import { useCloudBackupConfirmCredentialsScreen } from './useCloudBackupConfirmCredentialsScreen'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'cloud-backup-confirm-credentials'

export const CloudBackupConfirmCredentialsScreen = () => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG)
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        items,
        onSelect,
        encryptionKey,
        handleKeyChange,
        passphraseStatus,
        canConfirm,
        handleConfirm,
        wordsError,
        keyError,
        confirmHint,
    } = useCloudBackupConfirmCredentialsScreen()

    return (
        <PWScreen
            testID='cloud_backup_confirm_credentials_screen'
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('cloud_backup.confirm_credentials.confirm')}
                        isDisabled={!canConfirm}
                        onPress={handleConfirm}
                        testID='cloud_backup_confirm_credentials_button'
                    />
                    {confirmHint && (
                        <PWText
                            variant='caption'
                            style={styles.hint}
                            testID='cloud_backup_confirm_credentials_hint'
                        >
                            {confirmHint}
                        </PWText>
                    )}
                </PWView>
            }
        >
            <PWView style={styles.content}>
                <PWText variant='bodyLarge'>
                    {t('cloud_backup.confirm_credentials.description')}
                </PWText>

                {passphraseStatus === 'unavailable' && (
                    <PWText>
                        {t('cloud_backup.credentials.passphrase_missing')}
                    </PWText>
                )}
                {passphraseStatus === 'unreadable' && (
                    <PWText>
                        {t('cloud_backup.credentials.passphrase_unreadable')}
                    </PWText>
                )}
                {passphraseStatus === 'ready' && (
                    <PWView style={styles.quizSection}>
                        <PWView style={styles.quizList}>
                            {items.map((item, index) => (
                                <BackupQuizItem
                                    key={`${item.position}-${index}`}
                                    position={item.position}
                                    options={item.options}
                                    selectedWord={item.selectedWord}
                                    onSelect={word => onSelect(index, word)}
                                    testID={`cloud_backup_confirm_credentials_item_${index}`}
                                />
                            ))}
                        </PWView>
                        {wordsError && (
                            <PWText
                                variant='caption'
                                style={styles.errorText}
                                testID='cloud_backup_confirm_credentials_words_error'
                            >
                                {wordsError}
                            </PWText>
                        )}
                    </PWView>
                )}

                <PWView style={styles.keySection}>
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                    >
                        {t('cloud_backup.encryption_key_label')}
                    </PWText>
                    <PWInput
                        testID='cloud_backup_confirm_credentials_key_input'
                        inputContainerStyle={styles.inputContainer}
                        renderErrorMessage={false}
                        value={encryptionKey}
                        onChangeText={handleKeyChange}
                        placeholder={t(
                            'cloud_backup.restore.encryption_key_placeholder',
                        )}
                        isSensitive
                    />
                    {keyError && (
                        <PWText
                            variant='caption'
                            style={styles.errorText}
                            testID='cloud_backup_confirm_credentials_key_error'
                        >
                            {keyError}
                        </PWText>
                    )}
                </PWView>
            </PWView>
        </PWScreen>
    )
}
