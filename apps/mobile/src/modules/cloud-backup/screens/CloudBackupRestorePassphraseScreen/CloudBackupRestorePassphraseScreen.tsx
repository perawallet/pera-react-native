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

import { PWButton, PWScreen, PWView } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { MnemonicSuggestionBar } from '@modules/onboarding/components/MnemonicSuggestionBar'

import { PassphraseColumn } from './PassphraseColumn'
import { useCloudBackupRestorePassphraseScreen } from './useCloudBackupRestorePassphraseScreen'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'cloud-backup-restore-passphrase'
const COLUMN_COUNT = 2

export const CloudBackupRestorePassphraseScreen = () => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG)
    const styles = useStyles()
    const {
        words,
        mnemonicLength,
        canContinue,
        focused,
        suggestions,
        refCallbacks,
        handleWordChange,
        handleFocus,
        handleSubmitEditing,
        handleSelectSuggestion,
        handleContinue,
        t,
    } = useCloudBackupRestorePassphraseScreen()

    const wordsPerColumn = Math.ceil(mnemonicLength / COLUMN_COUNT)

    return (
        <PWScreen
            footer={
                <>
                    <MnemonicSuggestionBar
                        suggestions={suggestions}
                        onSelectSuggestion={handleSelectSuggestion}
                        testIDPrefix='cloud_backup_restore_suggestion'
                    />
                    <PWButton
                        testID='cloud_backup_restore_passphrase_continue'
                        variant='primary'
                        title={t('cloud_backup.restore.passphrase_continue')}
                        onPress={handleContinue}
                        isDisabled={!canContinue}
                    />
                </>
            }
        >
            <ScreenHeader title={t('cloud_backup.restore.passphrase_title')} />
            <PWView style={styles.wordContainer}>
                {Array.from({ length: COLUMN_COUNT }, (_, column) => {
                    const startIndex = wordsPerColumn * column
                    return (
                        <PassphraseColumn
                            key={startIndex}
                            words={words.slice(
                                startIndex,
                                startIndex + wordsPerColumn,
                            )}
                            startIndex={startIndex}
                            lastIndex={mnemonicLength - 1}
                            focused={focused}
                            onChangeWord={handleWordChange}
                            onFocusWord={handleFocus}
                            onSubmitWord={handleSubmitEditing}
                            refCallbacks={refCallbacks}
                        />
                    )
                })}
            </PWView>
        </PWScreen>
    )
}
