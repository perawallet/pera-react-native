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
    PWBadge,
    PWButton,
    PWText,
    PWView,
    type PWBadgeProps,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsDeveloperAppIntegrity } from './useSettingsDeveloperAppIntegrity'
import { useStyles } from './styles'

type BadgeVariant = NonNullable<PWBadgeProps['variant']>

const STATUS_VARIANT: Record<string, BadgeVariant> = {
    success: 'positive',
    error: 'alert',
    registering: 'primary',
    skipped: 'testnet',
    idle: 'secondary',
}

const statusVariant = (status: string): BadgeVariant =>
    STATUS_VARIANT[status] ?? 'secondary'

export const SettingsDeveloperAppIntegrityScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        status,
        integrityToken,
        expiresAt,
        lastError,
        appEnvironment,
        platform,
        isSupported,
        isBusy,
        verifyResult,
        verifyError,
        onRunHandshake,
        onVerifyToken,
        onClear,
    } = useSettingsDeveloperAppIntegrity()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.row}>
                <PWText variant='caption'>
                    {t('settings.developer.app_integrity_environment', {
                        value: appEnvironment,
                    })}
                </PWText>
                <PWText variant='caption'>
                    {t('settings.developer.app_integrity_platform', {
                        value: platform,
                    })}
                </PWText>
                <PWView style={styles.statusRow}>
                    <PWText variant='caption'>
                        {t('settings.developer.app_integrity_supported')}
                    </PWText>
                    <PWBadge
                        variant={isSupported ? 'positive' : 'secondary'}
                        value={String(isSupported)}
                    />
                </PWView>
                <PWView style={styles.statusRow}>
                    <PWText variant='caption'>
                        {t('settings.developer.app_integrity_status')}
                    </PWText>
                    <PWBadge
                        variant={statusVariant(status)}
                        value={status}
                    />
                </PWView>
                <PWText variant='caption'>
                    {t('settings.developer.app_integrity_token', {
                        value: integrityToken
                            ? `${integrityToken.slice(0, 12)}…`
                            : t('settings.developer.app_integrity_none'),
                    })}
                </PWText>
                <PWText variant='caption'>
                    {t('settings.developer.app_integrity_expiry', {
                        value:
                            expiresAt ??
                            t('settings.developer.app_integrity_none'),
                    })}
                </PWText>
                {!!lastError && (
                    <PWText variant='caption'>
                        {t('settings.developer.app_integrity_error', {
                            value: lastError,
                        })}
                    </PWText>
                )}
                {!!verifyResult && (
                    <PWView style={styles.statusRow}>
                        <PWText variant='caption'>
                            {t('settings.developer.app_integrity_verify_label')}
                        </PWText>
                        <PWBadge
                            variant={verifyResult.ok ? 'positive' : 'alert'}
                            value={
                                verifyResult.ok
                                    ? `${t('settings.developer.app_integrity_verify_ok')} · ${verifyResult.platform}`
                                    : t(
                                          'settings.developer.app_integrity_verify_failed',
                                      )
                            }
                        />
                    </PWView>
                )}
                {!!verifyError && (
                    <PWText variant='caption'>
                        {t('settings.developer.app_integrity_verify_error', {
                            value: verifyError,
                        })}
                    </PWText>
                )}
            </PWView>
            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={t('settings.developer.app_integrity_run')}
                    onPress={onRunHandshake}
                    isDisabled={isBusy}
                />
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.app_integrity_verify')}
                    onPress={onVerifyToken}
                    isDisabled={isBusy}
                />
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.app_integrity_clear')}
                    onPress={onClear}
                    isDisabled={isBusy}
                />
            </PWView>
        </PWView>
    )
}
