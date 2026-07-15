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

import { Linking } from 'react-native'
import { config } from '@perawallet/wallet-core-config'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type OnrampContactProviderCardProps = {
    /** Display name of the provider (e.g. "XO Swap"). */
    providerName: string
    /** Order id used to prefill the support email subject. */
    orderId: string
}

// Mirrors the web app: open the provider support inbox prefilled with the
// order id as the subject (mailto:support@xoswap.com?subject=...).
const buildSupportMailto = (orderId: string): string => {
    const subject = encodeURIComponent(`Order Support Request - ${orderId}`)
    return `mailto:${config.onrampSupportEmail}?subject=${subject}`
}

export const OnrampContactProviderCard = ({
    providerName,
    orderId,
}: OnrampContactProviderCardProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.helpCard}>
            <PWText
                variant='footnoteMedium'
                style={styles.helpText}
            >
                {t('onramp.order_review.need_help')}
            </PWText>
            <PWButton
                variant='link'
                icon='feedback'
                title={t('onramp.order_review.contact_provider', {
                    name: providerName,
                })}
                onPress={() => {
                    void Linking.openURL(buildSupportMailto(orderId))
                }}
                testID='onramp-contact-provider'
            />
        </PWView>
    )
}
