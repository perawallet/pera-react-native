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

// Re-authentication sheet for an already-unlocked user, shown before a
// high-consequence action. Resolves the sheet with `true` once the password
// verifies and `false` when dismissed, mirroring PinEditContent's contract so
// callers can `await requestBottomSheet<boolean>(...)`.
import React from 'react'
import { formatTime } from '@perawallet/wallet-core-shared'
import { PWButton, PWInput, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useVaultPasswordPrompt } from './useVaultPasswordPrompt'
import { useStyles } from './styles'

type VaultPasswordPromptProps = {
    /** Explains which action is being confirmed. */
    description: string
}

export const VaultPasswordPrompt = ({
    description,
}: VaultPasswordPromptProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve, dismiss } = useBottomSheetResult<boolean>()
    const {
        password,
        setPassword,
        isSubmitting,
        hasError,
        lockoutSeconds,
        canSubmit,
        handleSubmit,
    } = useVaultPasswordPrompt({ onVerified: () => resolve(true) })

    return (
        <PWView style={styles.container}>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('vault.reauth.title')}
            </PWText>
            <PWText
                variant='body'
                style={styles.description}
            >
                {description}
            </PWText>
            <PWInput
                testID='vault-reauth-password-input'
                placeholder={t('vault.unlock.password_placeholder')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                showVisibilityToggle
                autoCapitalize='none'
                autoComplete='current-password'
                autoFocus
                blurOnSubmit={false}
                onSubmitEditing={() => void handleSubmit()}
            />
            {hasError && (
                <PWText
                    testID='vault-reauth-error'
                    variant='body'
                    style={styles.errorText}
                >
                    {t('vault.unlock.error_invalid_password')}
                </PWText>
            )}
            {lockoutSeconds > 0 && (
                <PWText
                    testID='vault-reauth-lockout'
                    variant='body'
                    style={styles.errorText}
                >
                    {t('vault.unlock.lockout_countdown', {
                        time: formatTime(lockoutSeconds),
                    })}
                </PWText>
            )}
            <PWView style={styles.buttonRow}>
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={dismiss}
                    style={styles.button}
                    testID='vault-reauth-cancel'
                />
                <PWButton
                    variant='primary'
                    title={t('vault.reauth.confirm_button')}
                    onPress={() => void handleSubmit()}
                    style={styles.button}
                    isDisabled={!canSubmit}
                    isLoading={isSubmitting}
                    testID='vault-reauth-confirm'
                />
            </PWView>
        </PWView>
    )
}
