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

import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    PWButton,
    PWIcon,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAsbImportBackupScreen } from './useAsbImportBackupScreen'

export const AsbImportBackupScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const {
        loadedFile,
        canContinue,
        handlePickFile,
        handlePasteFromClipboard,
        handleClearFile,
        handleContinue,
    } = useAsbImportBackupScreen()

    return (
        <PWView style={styles.root}>
            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('onboarding.asb_import.backup.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('onboarding.asb_import.backup.body')}
                </PWText>

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
                                numberOfLines={1}
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
                            onPress={handlePickFile}
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
                            >
                                {t(
                                    'onboarding.asb_import.backup.pick_file_button',
                                )}
                            </PWText>
                        </PWTouchableOpacity>
                    )}

                    <PWTouchableOpacity
                        style={styles.pasteRow}
                        onPress={handlePasteFromClipboard}
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
                        >
                            {t('onboarding.asb_import.backup.paste_button')}
                        </PWText>
                    </PWTouchableOpacity>
                </PWView>
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    variant='primary'
                    title={t('onboarding.asb_import.backup.continue')}
                    onPress={handleContinue}
                    isDisabled={!canContinue}
                    testID='asb_import_backup_continue_button'
                />
            </PWView>
        </PWView>
    )
}
