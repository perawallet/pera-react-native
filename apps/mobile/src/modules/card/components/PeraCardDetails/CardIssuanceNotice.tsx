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

import { CardIssuanceState } from '@perawallet/wallet-core-card'
import { PWButton, PWView } from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type CardIssuanceNoticeProps = {
    state: CardIssuanceState
    /** Fires a fresh order attempt (rendered for ORDER_FAILED only). */
    onRetryOrder: () => void
    /** Opens support (rendered for the terminal VERIFICATION_REJECTED only). */
    onContactSupport: () => void
}

/**
 * Replaces the reveal pill while the Baanx card doesn't exist yet: says why
 * (KYC in review / provisioning / KYC rejected / order failed) and carries
 * the state's one action when there is one. Renders nothing once the card is
 * READY (or while the state is still loading, so card-holders never see it
 * flash on entry).
 */
export const CardIssuanceNotice = ({
    state,
    onRetryOrder,
    onContactSupport,
}: CardIssuanceNoticeProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    if (
        state === CardIssuanceState.Ready ||
        state === CardIssuanceState.Loading
    ) {
        return null
    }

    if (state === CardIssuanceState.VerificationRejected) {
        return (
            <PWView style={styles.issuanceNotice}>
                <InfoCallout
                    iconVariant='error'
                    title={t('peraCard.account.issuance_rejected_title')}
                    body={t('peraCard.account.issuance_rejected_body')}
                    testID='pera_card_issuance_rejected_notice'
                />
                <PWButton
                    variant='secondary'
                    title={t('peraCard.account.issuance_rejected_support')}
                    onPress={onContactSupport}
                    testID='pera_card_issuance_support_button'
                />
            </PWView>
        )
    }

    if (state === CardIssuanceState.OrderFailed) {
        return (
            <PWView style={styles.issuanceNotice}>
                <InfoCallout
                    iconVariant='error'
                    title={t('peraCard.account.issuance_failed_title')}
                    body={t('peraCard.account.issuance_failed_body')}
                    testID='pera_card_issuance_failed_notice'
                />
                <PWButton
                    variant='secondary'
                    title={t('peraCard.account.issuance_retry')}
                    onPress={onRetryOrder}
                    testID='pera_card_issuance_retry_button'
                />
            </PWView>
        )
    }

    const isIssuing = state === CardIssuanceState.Issuing
    return (
        <PWView style={styles.issuanceNotice}>
            <InfoCallout
                title={t(
                    isIssuing
                        ? 'peraCard.account.issuance_issuing_title'
                        : 'peraCard.account.issuance_pending_title',
                )}
                body={t(
                    isIssuing
                        ? 'peraCard.account.issuance_issuing_body'
                        : 'peraCard.account.issuance_pending_body',
                )}
                testID={
                    isIssuing
                        ? 'pera_card_issuance_issuing_notice'
                        : 'pera_card_issuance_pending_notice'
                }
            />
        </PWView>
    )
}
