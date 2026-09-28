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
    PWLoadingOverlay,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { OptionList } from '@components/OptionList'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { ConfirmationCheckbox } from '../../components/ConfirmationCheckbox'
import { EncryptionKeyField } from '../../components/EncryptionKeyField'
import { StoreCredentialsWarning } from '../../components/StoreCredentialsWarning'
import { useCloudBackupStoreEncryptionKeyScreen } from './useCloudBackupStoreEncryptionKeyScreen'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'cloud-backup-store-encryption-key'

export const CloudBackupStoreEncryptionKeyScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        encryptionKey,
        destinations,
        isConfirmed,
        toggleConfirmed,
        handleEnable,
        isEnabling,
        isSaving,
    } = useCloudBackupStoreEncryptionKeyScreen()

    usePreventScreenCapture(SCREEN_CAPTURE_TAG, true)

    return (
        <>
            <PWScreen
                testID='cloud_backup_store_encryption_key_screen'
                footer={
                    <PWButton
                        variant='primary'
                        title={t(
                            'cloud_backup.store_encryption_key.enable_button',
                        )}
                        isDisabled={!isConfirmed}
                        isLoading={isEnabling}
                        onPress={handleEnable}
                        testID='cloud_backup_store_encryption_key_enable_button'
                    />
                }
            >
                <PWView style={styles.container}>
                    <PWText variant='bodyLarge'>
                        {t('cloud_backup.store_encryption_key.description')}
                    </PWText>

                    <EncryptionKeyField encryptionKey={encryptionKey} />

                    <StoreCredentialsWarning />

                    <OptionList options={destinations} />

                    <ConfirmationCheckbox
                        label={t(
                            'cloud_backup.store_encryption_key.checkbox_label',
                        )}
                        isConfirmed={isConfirmed}
                        onToggle={toggleConfirmed}
                        testID='cloud_backup_store_encryption_key_checkbox'
                    />
                </PWView>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isSaving}
                title={t('cloud_backup.store_credentials.storing')}
            />
        </>
    )
}
