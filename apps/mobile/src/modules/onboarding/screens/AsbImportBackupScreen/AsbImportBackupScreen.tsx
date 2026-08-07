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

import {
    PWButton,
    PWIcon,
    PWRoundIcon,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAsbImportBackupScreen } from './useAsbImportBackupScreen'

export const AsbImportBackupScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        loadedFile,
        canContinue,
        isPickFileHandoff,
        handlePickFile,
        handlePasteFromClipboard,
        handleClearFile,
        handleContinue,
    } = useAsbImportBackupScreen()

    return (
        <PWScreen
            scroll='never'
            footer={
                <PWButton
                    variant='primary'
                    title={t('onboarding.asb_import.backup.continue')}
                    onPress={handleContinue}
                    isDisabled={!canContinue}
                    testID='asb_import_backup_continue_button'
                />
            }
        >
            <PWView style={styles.content}>
                <ScreenHeader
                    title={t('onboarding.asb_import.backup.title')}
                    description={t('onboarding.asb_import.backup.body')}
                />

                <PWView style={styles.dropZoneWrap}>
                    {loadedFile ? (
                        <PWView style={styles.fileRow}>
                            <PWIcon
                                name='text-document'
                                size='md'
                            />
                            <PWText
                                variant='h4'
                                style={styles.fileName}
                                truncate
                            >
                                {loadedFile.name}
                            </PWText>
                            <PWTouchableOpacity
                                onPress={handleClearFile}
                                testID='asb_import_backup_clear_button'
                            >
                                <PWIcon
                                    name='cross'
                                    size='md'
                                />
                            </PWTouchableOpacity>
                        </PWView>
                    ) : (
                        <PWTouchableOpacity
                            style={styles.dropZone}
                            onPress={() => void handlePickFile()}
                            testID='asb_import_backup_pick_file_button'
                        >
                            <PWRoundIcon
                                icon='arrow-up'
                                size='xl'
                                variant='secondary'
                            />
                            <PWText
                                variant='body'
                                style={styles.dropZoneLabel}
                                numberOfLines={2}
                                ellipsizeMode='tail'
                            >
                                {t(
                                    isPickFileHandoff
                                        ? 'onboarding.asb_import.backup.pick_file_button_new_tab'
                                        : 'onboarding.asb_import.backup.pick_file_button',
                                )}
                            </PWText>
                        </PWTouchableOpacity>
                    )}

                    <PWTouchableOpacity
                        style={styles.pasteRow}
                        onPress={() => void handlePasteFromClipboard()}
                        testID='asb_import_backup_paste_button'
                    >
                        <PWIcon
                            name='copy'
                            size='md'
                            variant='link'
                        />
                        <PWText
                            variant='link'
                            style={styles.pasteLabel}
                            numberOfLines={2}
                            ellipsizeMode='tail'
                        >
                            {t('onboarding.asb_import.backup.paste_button')}
                        </PWText>
                    </PWTouchableOpacity>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
