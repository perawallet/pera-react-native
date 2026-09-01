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

import React from 'react'

import { PWButton, PWInput, PWLoadingOverlay, PWScreen } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'

import { useCloudBackupRestoreEncryptionKeyScreen } from './useCloudBackupRestoreEncryptionKeyScreen'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'cloud-backup-restore-key'

export const CloudBackupRestoreEncryptionKeyScreen = () => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG)
    const styles = useStyles()
    const {
        t,
        encryptionKey,
        isRestoring,
        canRestore,
        handleKeyChange,
        handleRestore,
    } = useCloudBackupRestoreEncryptionKeyScreen()

    return (
        <>
            <PWScreen
                footer={
                    <PWButton
                        testID='cloud_backup_restore_key_button'
                        variant='primary'
                        title={t('cloud_backup.restore.encryption_key_restore')}
                        onPress={handleRestore}
                        isDisabled={!canRestore}
                    />
                }
            >
                <ScreenHeader
                    title={t('cloud_backup.restore.encryption_key_title')}
                />
                <PWInput
                    testID='cloud_backup_restore_key_input'
                    inputContainerStyle={styles.inputContainer}
                    renderErrorMessage={false}
                    value={encryptionKey}
                    onChangeText={handleKeyChange}
                    placeholder={t(
                        'cloud_backup.restore.encryption_key_placeholder',
                    )}
                    autoCapitalize='none'
                    autoCorrect={false}
                />
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isRestoring}
                title={t('cloud_backup.restore.restoring')}
            />
        </>
    )
}
