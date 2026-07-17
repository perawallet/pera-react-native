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
    PWImage,
    PWInput,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { formatTime } from '@perawallet/wallet-core-shared'
import { useUnlockScreen } from './useUnlockScreen'
import { useStyles } from './styles'

import welcomeBackground from '@assets/images/welcome-background.webp'

export const UnlockScreen = (): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        password,
        isSubmitting,
        hasError,
        hasCorruptedVaultError,
        hasPasskeyError,
        canUsePasskey,
        lockoutSeconds,
        setPassword,
        handleUnlock,
        handlePasskeyUnlock,
    } = useUnlockScreen()

    return (
        <>
            <PWView style={styles.imageContainer}>
                <PWImage
                    source={welcomeBackground}
                    style={styles.headerImage}
                />
            </PWView>
            <PWScreen scroll='auto'>
                <PWView style={styles.container}>
                    <PWText
                        variant='h2'
                        style={styles.title}
                    >
                        {t('vault.unlock.title')}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.description}
                    >
                        {t('vault.unlock.description')}
                    </PWText>
                    <PWInput
                        testID='unlock-password-input'
                        placeholder={t('vault.unlock.password_placeholder')}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        showVisibilityToggle
                        autoCapitalize='none'
                        autoComplete='current-password'
                        autoFocus
                        blurOnSubmit={false}
                        onSubmitEditing={() => void handleUnlock()}
                    />
                    {hasError && (
                        <PWText
                            testID='unlock-error'
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('vault.unlock.error_invalid_password')}
                        </PWText>
                    )}
                    {hasCorruptedVaultError && (
                        <PWText
                            testID='unlock-corrupted-error'
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('vault.unlock.corrupted_error')}
                        </PWText>
                    )}
                    {hasPasskeyError && (
                        <PWText
                            testID='unlock-passkey-error'
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('vault.unlock.passkey_error')}
                        </PWText>
                    )}
                    {lockoutSeconds > 0 && (
                        <PWText
                            testID='unlock-lockout'
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('vault.unlock.lockout_countdown', {
                                time: formatTime(lockoutSeconds),
                            })}
                        </PWText>
                    )}
                    <PWButton
                        testID='unlock-submit'
                        variant='primary'
                        title={t('vault.unlock.submit_button')}
                        style={styles.unlockButton}
                        isDisabled={
                            password.length === 0 ||
                            isSubmitting ||
                            lockoutSeconds > 0
                        }
                        isLoading={isSubmitting}
                        onPress={() => void handleUnlock()}
                    />
                    {canUsePasskey && (
                        <PWButton
                            testID='unlock-passkey'
                            variant='secondary'
                            title={t('vault.unlock.use_passkey')}
                            isDisabled={isSubmitting || lockoutSeconds > 0}
                            onPress={() => void handlePasskeyUnlock()}
                        />
                    )}
                </PWView>
            </PWScreen>
        </>
    )
}
