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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useIntegrityAccessDiagnostics } from './useIntegrityAccessDiagnostics.web'
import { useStyles } from './styles'

export const IntegrityAccessDiagnostics = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { accessState, cause, nextAttempt, onForceEnrol, onClearBackoff } =
        useIntegrityAccessDiagnostics()
    const none = t('settings.developer.app_integrity_none')

    return (
        <PWView style={styles.row}>
            <PWText variant='caption'>
                {t('settings.developer.app_integrity_access_state', {
                    value: accessState,
                })}
            </PWText>
            <PWText variant='caption'>
                {t('settings.developer.app_integrity_cause', {
                    value: cause ?? none,
                })}
            </PWText>
            <PWText variant='caption'>
                {t('settings.developer.app_integrity_next_attempt', {
                    value: nextAttempt ?? none,
                })}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.app_integrity_force_enrol')}
                    onPress={onForceEnrol}
                />
                <PWButton
                    variant='secondary'
                    title={t('settings.developer.app_integrity_clear_backoff')}
                    onPress={onClearBackoff}
                />
            </PWView>
        </PWView>
    )
}
