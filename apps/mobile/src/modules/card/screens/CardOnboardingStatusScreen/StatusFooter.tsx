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
import { Trans } from 'react-i18next'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type StatusFooterProps = {
    isFundsConnected: boolean
    onCreatePeraCard: () => void
    onLogout: () => void
    onOpenSupport: () => void
}

/** Footer: the "Create Pera Card" CTA once connected, otherwise logout + support. */
export const StatusFooter = ({
    isFundsConnected,
    onCreatePeraCard,
    onLogout,
    onOpenSupport,
}: StatusFooterProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    if (isFundsConnected) {
        return (
            <PWButton
                variant='primary'
                title={t('peraCard.setup_status.funding_type_button')}
                onPress={onCreatePeraCard}
                testID='card-onboarding-status-create-card'
            />
        )
    }

    return (
        <PWView style={styles.footer}>
            <PWButton
                variant='secondary'
                title={t('peraCard.verification.logout_button')}
                onPress={onLogout}
                testID='card-onboarding-status-logout'
            />
            <PWText
                variant='footnoteMedium'
                weight={400}
                style={styles.contactText}
            >
                <Trans
                    i18nKey='peraCard.verification.contact_us'
                    components={[
                        <PWText
                            key='link'
                            variant='linkPositive'
                            onPress={onOpenSupport}
                            testID='card-onboarding-status-contact-link'
                        />,
                    ]}
                />
            </PWText>
        </PWView>
    )
}
