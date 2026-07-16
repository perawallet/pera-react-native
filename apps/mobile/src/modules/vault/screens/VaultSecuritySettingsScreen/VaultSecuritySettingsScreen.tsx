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

import {
    PWButton,
    PWDropdown,
    PWIcon,
    PWInput,
    PWScreen,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useVaultSecuritySettingsScreen } from './useVaultSecuritySettingsScreen'
import { useStyles } from './styles'

export const VaultSecuritySettingsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        autoLockMinutes,
        autoLockOptions,
        selectMinutes,
        handleLockNow,
        passkeyState,
        passkeyPassword,
        setPasskeyPassword,
        handleEnablePasskey,
        handleDisablePasskey,
        isEnablingPasskey,
        hasPasskeyError,
        hasPasskeyEnableError,
        currentPassword,
        newPassword,
        confirmNewPassword,
        setCurrentPassword,
        setNewPassword,
        setConfirmNewPassword,
        isChangingPassword,
        changePasswordValidationError,
        changePasswordError,
        changePasswordSuccess,
        canSubmitChangePassword,
        handleChangePassword,
    } = useVaultSecuritySettingsScreen()

    const newPasswordError =
        changePasswordValidationError === 'too_short'
            ? t('vault.security.change_password_error_too_short')
            : undefined

    const confirmNewPasswordError =
        changePasswordValidationError === 'mismatch'
            ? t('vault.security.change_password_error_mismatch')
            : undefined

    const changePasswordErrorMessage =
        changePasswordError === 'invalid_current'
            ? t('vault.security.change_password_error_invalid_current')
            : changePasswordError === 'corrupted'
              ? t('vault.security.change_password_error_corrupted')
              : changePasswordError === 'unexpected'
                ? t('vault.security.change_password_error_unexpected')
                : undefined

    return (
        <PWScreen testID='vault-security-screen'>
            <PWView style={styles.container}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    style={styles.sectionTitle}
                >
                    {t('vault.security.autolock_title')}
                </PWText>
                {autoLockMinutes === null ? (
                    <PWSkeleton
                        height={44}
                        style={styles.autolockTrigger}
                    />
                ) : (
                    <PWDropdown
                        items={autoLockOptions.map(minutes => ({
                            label: t('vault.security.autolock_minutes', {
                                minutes,
                            }),
                            onPress: () => void selectMinutes(minutes),
                            isSelected: autoLockMinutes === minutes,
                        }))}
                    >
                        <PWView
                            testID='vault-security-autolock-trigger'
                            style={styles.autolockTrigger}
                        >
                            <PWText variant='body'>
                                {t('vault.security.autolock_minutes', {
                                    minutes: autoLockMinutes,
                                })}
                            </PWText>
                            <PWIcon
                                name='chevron-down'
                                size='md'
                                variant='secondary'
                            />
                        </PWView>
                    </PWDropdown>
                )}
                <PWButton
                    testID='vault-security-lock-now'
                    variant='destructive'
                    title={t('vault.security.lock_now')}
                    style={styles.lockButton}
                    onPress={() => void handleLockNow()}
                />
                <PWView
                    testID='vault-security-change-password-section'
                    style={styles.passkeySection}
                >
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        style={styles.sectionTitle}
                    >
                        {t('vault.security.change_password_title')}
                    </PWText>
                    <PWInput
                        testID='vault-security-current-password'
                        placeholder={t(
                            'vault.security.change_password_current_placeholder',
                        )}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        autoCapitalize='none'
                        autoComplete='current-password'
                    />
                    <PWInput
                        testID='vault-security-new-password'
                        placeholder={t(
                            'vault.security.change_password_new_placeholder',
                        )}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        autoCapitalize='none'
                        autoComplete='new-password'
                        errorMessage={newPasswordError}
                        renderErrorMessage={
                            changePasswordValidationError === 'too_short'
                        }
                    />
                    <PWInput
                        testID='vault-security-confirm-new-password'
                        placeholder={t(
                            'vault.security.change_password_confirm_placeholder',
                        )}
                        value={confirmNewPassword}
                        onChangeText={setConfirmNewPassword}
                        secureTextEntry
                        autoCapitalize='none'
                        autoComplete='new-password'
                        errorMessage={confirmNewPasswordError}
                        renderErrorMessage={
                            changePasswordValidationError === 'mismatch'
                        }
                    />
                    {changePasswordErrorMessage && (
                        <PWText
                            testID='vault-security-change-password-error'
                            variant='body'
                            style={styles.errorText}
                        >
                            {changePasswordErrorMessage}
                        </PWText>
                    )}
                    {changePasswordSuccess && (
                        <PWText
                            testID='vault-security-change-password-success'
                            variant='body'
                            style={styles.successText}
                        >
                            {t('vault.security.change_password_success')}
                        </PWText>
                    )}
                    <PWButton
                        testID='vault-security-change-password-submit'
                        variant='secondary'
                        title={t('vault.security.change_password_submit')}
                        isDisabled={!canSubmitChangePassword}
                        isLoading={isChangingPassword}
                        onPress={() => void handleChangePassword()}
                    />
                </PWView>
                {passkeyState !== null && (
                    <PWView style={styles.passkeySection}>
                        <PWText
                            variant='bodyLarge'
                            weight={500}
                            style={styles.sectionTitle}
                        >
                            {t('vault.security.passkey_title')}
                        </PWText>
                        {passkeyState === 'disabled' && (
                            <PWInput
                                testID='vault-security-passkey-password'
                                placeholder={t(
                                    'vault.security.passkey_password_placeholder',
                                )}
                                value={passkeyPassword}
                                onChangeText={setPasskeyPassword}
                                secureTextEntry
                                autoCapitalize='none'
                                autoComplete='current-password'
                            />
                        )}
                        {hasPasskeyError && (
                            <PWText
                                testID='vault-security-passkey-error'
                                variant='body'
                                style={styles.errorText}
                            >
                                {t('vault.security.passkey_error')}
                            </PWText>
                        )}
                        {hasPasskeyEnableError && (
                            <PWText
                                testID='passkey-enable-error'
                                variant='body'
                                style={styles.errorText}
                            >
                                {t('vault.security.passkey_enable_error')}
                            </PWText>
                        )}
                        <PWButton
                            testID='vault-security-passkey-toggle'
                            variant={
                                passkeyState === 'enabled'
                                    ? 'destructive'
                                    : 'secondary'
                            }
                            title={t(
                                passkeyState === 'enabled'
                                    ? 'vault.security.passkey_disable'
                                    : 'vault.security.passkey_enable',
                            )}
                            isDisabled={
                                (passkeyState === 'disabled' &&
                                    passkeyPassword.length === 0) ||
                                isEnablingPasskey
                            }
                            isLoading={isEnablingPasskey}
                            onPress={() =>
                                void (passkeyState === 'enabled'
                                    ? handleDisablePasskey()
                                    : handleEnablePasskey())
                            }
                        />
                    </PWView>
                )}
            </PWView>
        </PWScreen>
    )
}
