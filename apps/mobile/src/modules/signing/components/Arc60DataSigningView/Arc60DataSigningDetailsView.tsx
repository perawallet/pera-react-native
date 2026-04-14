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

import { PWText, PWView } from '@components/core'
import type { Arc60SignRequest, Siwa } from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { ScrollView } from 'react-native-gesture-handler'
import type { Arc60ParsedPayload } from './parseArc60ForDisplay'
import { useStyles } from './Arc60DataSigningDetailsView.style'

export type Arc60DataSigningDetailsViewProps = {
    request: Arc60SignRequest
    account: WalletAccount | undefined
    parsed: Arc60ParsedPayload
}

type SiwaField = {
    label: string
    value: string
}

const buildSiwaFields = (
    siwa: Siwa,
    t: (key: string) => string,
): SiwaField[] => {
    const fields: SiwaField[] = [
        { label: t('signing.arc60_view.siwa_uri'), value: siwa.uri },
        { label: t('signing.arc60_view.siwa_version'), value: siwa.version },
        { label: t('signing.arc60_view.siwa_chain_id'), value: siwa.chain_id },
    ]
    if (siwa.nonce) {
        fields.push({
            label: t('signing.arc60_view.siwa_nonce'),
            value: siwa.nonce,
        })
    }
    if (siwa['issued-at']) {
        fields.push({
            label: t('signing.arc60_view.siwa_issued_at'),
            value: siwa['issued-at'],
        })
    }
    if (siwa['expiration-time']) {
        fields.push({
            label: t('signing.arc60_view.siwa_expiration'),
            value: siwa['expiration-time'],
        })
    }
    if (siwa['not-before']) {
        fields.push({
            label: t('signing.arc60_view.siwa_not_before'),
            value: siwa['not-before'],
        })
    }
    return fields
}

export const Arc60DataSigningDetailsView = ({
    request,
    account,
    parsed,
}: Arc60DataSigningDetailsViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const siwa = parsed.type === 'siwa' ? parsed.siwa : undefined
    const parseError = parsed.type === 'error' ? parsed.message : undefined

    return (
        <PWView style={styles.container}>
            <PWView style={[styles.section, styles.titleSection]}>
                <PWText style={styles.description}>
                    {t('signing.arc60_view.details_description')}
                </PWText>
            </PWView>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
            >
                <PWView style={styles.section}>
                    <KeyValueRow title={t('signing.arc60_view.domain')}>
                        <PWText>{request.stdSigData.domain}</PWText>
                    </KeyValueRow>
                    <KeyValueRow title={t('signing.arc60_view.scope')}>
                        <PWText>{t('signing.arc60_view.scope_auth')}</PWText>
                    </KeyValueRow>
                    {!!request.stdSigData.requestId && (
                        <KeyValueRow title={t('signing.arc60_view.request_id')}>
                            <PWText>{request.stdSigData.requestId}</PWText>
                        </KeyValueRow>
                    )}
                    {!!account && (
                        <KeyValueRow
                            title={t('signing.arc60_view.on_behalf_of')}
                        >
                            <AccountDisplay
                                account={account}
                                showChevron={false}
                            />
                        </KeyValueRow>
                    )}
                </PWView>
                {!!siwa && (
                    <PWView style={styles.section}>
                        {!!siwa.statement && (
                            <KeyValueRow
                                title={t('signing.arc60_view.siwa_statement')}
                            >
                                <PWText>{siwa.statement}</PWText>
                            </KeyValueRow>
                        )}
                        {buildSiwaFields(siwa, t).map(field => (
                            <KeyValueRow
                                key={field.label}
                                title={field.label}
                            >
                                <PWText>{field.value}</PWText>
                            </KeyValueRow>
                        ))}
                        {!!siwa.resources?.length && (
                            <KeyValueRow
                                title={t('signing.arc60_view.siwa_resources')}
                            >
                                <PWView style={styles.resources}>
                                    {siwa.resources.map(resource => (
                                        <PWText key={resource}>
                                            {resource}
                                        </PWText>
                                    ))}
                                </PWView>
                            </KeyValueRow>
                        )}
                    </PWView>
                )}
                {!!parseError && (
                    <PWView style={styles.section}>
                        <PWText style={styles.errorText}>
                            {t('signing.arc60_view.siwa_invalid')}
                        </PWText>
                        <PWText style={styles.errorText}>{parseError}</PWText>
                    </PWView>
                )}
            </ScrollView>
        </PWView>
    )
}
