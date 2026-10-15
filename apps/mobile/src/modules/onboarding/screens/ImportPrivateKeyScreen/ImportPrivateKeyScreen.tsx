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
import {
    PWButton,
    PWInput,
    PWLoadingOverlay,
    PWScreen,
    PWText,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { useImportPrivateKeyScreen } from './useImportPrivateKeyScreen'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'import-private-key'

export const ImportPrivateKeyScreen = () => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG, true)
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        chainName,
        hasInput,
        isValidInput,
        isImporting,
        isIncludedInCloudBackup,
        handleChangeText,
        handleImport,
    } = useImportPrivateKeyScreen()

    return (
        <>
            <PWScreen
                footer={
                    <PWButton
                        testID='import_private_key_submit_button'
                        variant='primary'
                        title={t('onboarding.import_private_key.submit')}
                        onPress={handleImport}
                        isDisabled={!isValidInput || isImporting}
                    />
                }
            >
                <ScreenHeader
                    title={t('onboarding.import_private_key.title')}
                    description={t('onboarding.import_private_key.body', {
                        chain: chainName,
                    })}
                />

                {/* Uncontrolled: no `value`, so the key never round-trips through state. */}
                <PWInput
                    testID='import_private_key_input'
                    label={t('onboarding.import_private_key.input_label')}
                    onChangeText={handleChangeText}
                    secureTextEntry
                    isSensitive
                    autoCorrect={false}
                    spellCheck={false}
                    autoCapitalize='none'
                    autoComplete='off'
                    errorMessage={
                        hasInput && !isValidInput
                            ? t('onboarding.import_private_key.invalid')
                            : undefined
                    }
                />

                <PWText
                    variant='caption'
                    style={styles.notice}
                    testID='import_private_key_backup_notice'
                >
                    {t(
                        isIncludedInCloudBackup
                            ? 'onboarding.import_private_key.backup_included'
                            : 'onboarding.import_private_key.backup_not_included',
                    )}
                </PWText>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isImporting}
                title={t('onboarding.create_account.processing')}
            />
        </>
    )
}
