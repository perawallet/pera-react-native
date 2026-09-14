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
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { PassphraseGrid } from '@components/PassphraseGrid'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { getTestProps } from '@utils/test-id-helper'

import { useCloudBackupSetupScreen } from './useCloudBackupSetupScreen'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'cloud-backup-setup'

export const CloudBackupSetupScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        mnemonicIndices,
        saltB64,
        handleCopyPassphrase,
        handleCopyEncryptionKey,
        handleProceed,
    } = useCloudBackupSetupScreen()

    usePreventScreenCapture(SCREEN_CAPTURE_TAG, true)

    return (
        <PWScreen
            testID='cloud_backup_setup_screen'
            footer={
                <PWButton
                    variant='primary'
                    title={t('cloud_backup.setup.proceed')}
                    onPress={handleProceed}
                    testID='cloud_backup_setup_proceed_button'
                />
            }
        >
            <PWView style={styles.container}>
                <PWText variant='bodyLarge'>
                    {t('cloud_backup.setup.description')}
                </PWText>

                <PWView style={styles.section}>
                    <PWText
                        variant='body'
                        style={styles.label}
                    >
                        {t('cloud_backup.setup.passphrase_label')}
                    </PWText>
                    <PassphraseGrid wordIndices={mnemonicIndices} />
                    <PWTouchableOpacity
                        style={styles.copyLink}
                        onPress={handleCopyPassphrase}
                        {...getTestProps('cloud_backup_setup_copy_passphrase')}
                    >
                        <PWIcon
                            name='copy'
                            variant='positive'
                        />
                        <PWText
                            variant='bodyLarge'
                            weight={500}
                            style={styles.copyLinkText}
                        >
                            {t('cloud_backup.setup.copy_passphrase')}
                        </PWText>
                    </PWTouchableOpacity>
                </PWView>

                <PWView style={styles.section}>
                    <PWText
                        variant='body'
                        style={styles.label}
                    >
                        {t('cloud_backup.setup.encryption_key_label')}
                    </PWText>
                    <PWView style={styles.keyField}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.keyText}
                            truncate
                        >
                            {saltB64}
                        </PWText>
                        <PWTouchableOpacity
                            onPress={handleCopyEncryptionKey}
                            {...getTestProps(
                                'cloud_backup_setup_copy_encryption_key',
                            )}
                        >
                            <PWIcon
                                name='copy'
                                variant='positive'
                            />
                        </PWTouchableOpacity>
                    </PWView>
                </PWView>

                <PWView style={styles.infoCard}>
                    <PWView style={styles.infoHeader}>
                        <PWIcon name='info' />
                        <PWText
                            variant='bodyLarge'
                            weight={500}
                        >
                            {t('cloud_backup.setup.info_title')}
                        </PWText>
                    </PWView>
                    <PWText
                        variant='bodyLarge'
                        style={styles.infoBody}
                    >
                        {t('cloud_backup.setup.info_body')}
                    </PWText>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
