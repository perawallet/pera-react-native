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

import { PWBadge, PWButton, PWText, PWView } from '@components/core'
import type { PWBadgeProps } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsDeveloperAppIntegrity } from './useSettingsDeveloperAppIntegrity'
import { useStyles } from './styles'

type BadgeVariant = NonNullable<PWBadgeProps['variant']>

const STATUS_VARIANT: Record<string, BadgeVariant> = {
    success: 'positive',
    error: 'alert',
    registering: 'primary',
    skipped: 'secondary',
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
                <PWText variant='caption'>{`Environment: ${appEnvironment}`}</PWText>
                <PWText variant='caption'>{`Platform: ${platform}`}</PWText>
                <PWView style={styles.statusRow}>
                    <PWText variant='caption'>Supported:</PWText>
                    <PWBadge
                        variant={isSupported ? 'positive' : 'secondary'}
                        value={String(isSupported)}
                    />
                </PWView>
                <PWView style={styles.statusRow}>
                    <PWText variant='caption'>Status:</PWText>
                    <PWBadge
                        variant={statusVariant(status)}
                        value={status}
                    />
                </PWView>
                <PWText variant='caption'>{`Token: ${integrityToken ? `${integrityToken.slice(0, 12)}…` : 'none'}`}</PWText>
                <PWText variant='caption'>{`Expiry: ${expiresAt ?? 'none'}`}</PWText>
                {!!lastError && (
                    <PWText variant='caption'>{`Error: ${lastError}`}</PWText>
                )}
                {!!verifyResult && (
                    <PWView style={styles.statusRow}>
                        <PWText variant='caption'>Verify:</PWText>
                        <PWBadge
                            variant={verifyResult.ok ? 'positive' : 'alert'}
                            value={
                                verifyResult.ok
                                    ? `ok · ${verifyResult.platform}`
                                    : 'failed'
                            }
                        />
                    </PWView>
                )}
                {!!verifyError && (
                    <PWText variant='caption'>{`Verify error: ${verifyError}`}</PWText>
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
