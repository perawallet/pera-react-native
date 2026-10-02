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

import { PWText, PWView } from '@components/core'
import type {
    AuthDataSignRequest,
    ParsedAuthData,
    SiwxMessage,
} from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { AccountDisplay } from '@components/AccountDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './Arc60DataSigningDetailsView.style'

export type Arc60DataSigningDetailsViewProps = {
    request: AuthDataSignRequest
    account: Optional<WalletAccount>
    parsed: ParsedAuthData
}

type SiwxField = {
    label: string
    value: string
}

const buildSiwxFields = (
    siwx: SiwxMessage,
    t: (key: string) => string,
): SiwxField[] => {
    const fields: SiwxField[] = [
        { label: t('signing.arc60_view.siwa_uri'), value: siwx.uri },
        { label: t('signing.arc60_view.siwa_version'), value: siwx.version },
        { label: t('signing.arc60_view.siwa_chain_id'), value: siwx.chainId },
    ]
    if (siwx.nonce) {
        fields.push({
            label: t('signing.arc60_view.siwa_nonce'),
            value: siwx.nonce,
        })
    }
    if (siwx.issuedAt) {
        fields.push({
            label: t('signing.arc60_view.siwa_issued_at'),
            value: siwx.issuedAt,
        })
    }
    if (siwx.expirationTime) {
        fields.push({
            label: t('signing.arc60_view.siwa_expiration'),
            value: siwx.expirationTime,
        })
    }
    if (siwx.notBefore) {
        fields.push({
            label: t('signing.arc60_view.siwa_not_before'),
            value: siwx.notBefore,
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

    const siwx = parsed.type === 'siwx' ? parsed.siwx : undefined
    const parseError = parsed.type === 'error' ? parsed.message : undefined

    return (
        <PWView>
            <PWView style={[styles.section, styles.titleSection]}>
                <PWText style={styles.description}>
                    {t('signing.arc60_view.details_description')}
                </PWText>
            </PWView>
            <PWView style={styles.section}>
                <KeyValueRow title={t('signing.arc60_view.domain')}>
                    <PWText>{request.authData.domain}</PWText>
                </KeyValueRow>
                <KeyValueRow title={t('signing.arc60_view.scope')}>
                    <PWText>{t('signing.arc60_view.scope_auth')}</PWText>
                </KeyValueRow>
                {!!request.authData.requestId && (
                    <KeyValueRow title={t('signing.arc60_view.request_id')}>
                        <PWText>{request.authData.requestId}</PWText>
                    </KeyValueRow>
                )}
                {!!account && (
                    <KeyValueRow title={t('signing.arc60_view.on_behalf_of')}>
                        <AccountDisplay
                            account={account}
                            showChevron={false}
                        />
                    </KeyValueRow>
                )}
            </PWView>
            {!!siwx && (
                <PWView style={styles.section}>
                    {!!siwx.statement && (
                        <KeyValueRow
                            title={t('signing.arc60_view.siwa_statement')}
                        >
                            <PWText>{siwx.statement}</PWText>
                        </KeyValueRow>
                    )}
                    {buildSiwxFields(siwx, t).map(field => (
                        <KeyValueRow
                            key={field.label}
                            title={field.label}
                        >
                            <PWText>{field.value}</PWText>
                        </KeyValueRow>
                    ))}
                    {!!siwx.resources?.length && (
                        <KeyValueRow
                            title={t('signing.arc60_view.siwa_resources')}
                        >
                            <PWView style={styles.resources}>
                                {siwx.resources.map(resource => (
                                    <PWText key={resource}>{resource}</PWText>
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
        </PWView>
    )
}
