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

import { useCallback } from 'react'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useAnalyticsConsent } from '@perawallet/wallet-core-settings'
import { useStyles } from './styles'

export const ANALYTICS_CONSENT_PROMPT_ID = 'analytics-consent-prompt'

/**
 * Asks once whether usage analytics may be collected; nothing is sent until it
 * is answered. Like the biometrics notice, the stored answer is the whole
 * lifetime, so neither `onHide` nor `onDismiss` is used: answering is what
 * takes it out of the queue, and Settings can change the answer later.
 */
export const AnalyticsConsentPrompt = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { setConsent } = useAnalyticsConsent()

    const handleAllow = useCallback(() => setConsent('granted'), [setConsent])
    const handleDecline = useCallback(() => setConsent('denied'), [setConsent])

    return (
        <PWView
            style={styles.container}
            testID='analytics_consent_prompt'
        >
            <PWText variant='h3'>{t('analytics_consent.prompt.title')}</PWText>
            <PWText
                variant='bodyLarge'
                style={styles.body}
            >
                {t('analytics_consent.prompt.body')}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={t('analytics_consent.prompt.allow')}
                    onPress={handleAllow}
                    testID='analytics_consent_prompt_allow_button'
                />
                <PWButton
                    variant='secondary'
                    title={t('analytics_consent.prompt.decline')}
                    onPress={handleDecline}
                    testID='analytics_consent_prompt_decline_button'
                />
            </PWView>
        </PWView>
    )
}
