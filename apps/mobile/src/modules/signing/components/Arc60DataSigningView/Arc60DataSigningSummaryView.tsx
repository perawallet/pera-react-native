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

import { PWButton, PWText, PWView } from '@components/core'
import type { Arc60SignRequest } from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import type { Arc60ParsedPayload } from './parseArc60ForDisplay'
import { useStyles } from './Arc60DataSigningSummaryView.style'

export type Arc60DataSigningSummaryViewProps = {
    request: Arc60SignRequest
    account: WalletAccount | undefined
    parsed: Arc60ParsedPayload
    onDetailsPress: () => void
}

export const Arc60DataSigningSummaryView = ({
    request,
    account,
    parsed,
    onDetailsPress,
}: Arc60DataSigningSummaryViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const siwa = parsed.type === 'siwa' ? parsed.siwa : undefined

    return (
        <PWView style={styles.container}>
            <PWView style={styles.messageContainer}>
                <PWText
                    variant='h2'
                    style={styles.title}
                >
                    {t('signing.arc60_view.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('signing.arc60_view.description', {
                        domain: request.stdSigData.domain,
                    })}
                </PWText>
                {!!siwa?.statement && (
                    <PWView style={styles.statementContainer}>
                        <PWText
                            variant='caption'
                            style={styles.statementLabel}
                        >
                            {t('signing.arc60_view.siwa_statement')}
                        </PWText>
                        <PWText variant='body'>{siwa.statement}</PWText>
                    </PWView>
                )}
                {!!account && (
                    <PWView style={styles.accountContainer}>
                        <PWText style={styles.onBehalfOf}>
                            {t('signing.arc60_view.on_behalf_of')}
                        </PWText>
                        <AccountDisplay
                            account={account}
                            showChevron={false}
                        />
                    </PWView>
                )}
            </PWView>
            <PWView style={styles.detailsContainer}>
                <PWButton
                    title={t('signing.arc60_view.show_details')}
                    variant='link'
                    paddingStyle='dense'
                    onPress={onDetailsPress}
                />
            </PWView>
        </PWView>
    )
}
