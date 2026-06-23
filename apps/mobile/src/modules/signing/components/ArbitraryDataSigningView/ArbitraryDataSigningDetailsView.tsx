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
import {
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
} from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { KeyValueRow } from '@components/KeyValueRow'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useStyles } from './ArbitraryDataSigningDetailsView.style'
import { AssetAmount } from '@components/AssetAmount'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { Decimal } from 'decimal.js'

export type ArbitraryDataSigningDetailsViewProps = {
    request: ArbitraryDataSignRequest
    dataMessage: PeraArbitraryDataMessage
}

export const ArbitraryDataSigningDetailsView = ({
    request,
    dataMessage,
}: ArbitraryDataSigningDetailsViewProps) => {
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const account = accounts.find(
        account => account.address === dataMessage.signer,
    )
    const styles = useStyles()

    return (
        <PWView>
            <PWView style={[styles.section, styles.titleSection]}>
                <PWText style={styles.description}>
                    {t('signing.arbitrary_data_details.description')}
                </PWText>
            </PWView>
            <PWView style={styles.section}>
                <KeyValueRow title={t('signing.arbitrary_data_details.from')}>
                    <AccountDisplay
                        account={account}
                        showChevron={false}
                    />
                </KeyValueRow>
                <KeyValueRow title={t('signing.arbitrary_data_details.to')}>
                    <PWText>
                        {request?.sourceMetadata?.name ??
                            t('signing.arbitrary_data_details.unnamed')}
                    </PWText>
                </KeyValueRow>
            </PWView>
            <PWView style={styles.section}>
                <KeyValueRow title={t('signing.arbitrary_data_details.amount')}>
                    <AssetAmount
                        asset={ALGO_ASSET}
                        value={Decimal(0)}
                        showSymbol
                        density='compact'
                        ignorePrivacyMode
                    />
                </KeyValueRow>
                <KeyValueRow title={t('signing.arbitrary_data_details.fee')}>
                    <AssetAmount
                        asset={ALGO_ASSET}
                        value={Decimal(0)}
                        showSymbol
                        density='compact'
                        ignorePrivacyMode
                    />
                </KeyValueRow>
            </PWView>
            <PWView style={styles.section}>
                <KeyValueRow
                    title={t('signing.arbitrary_data_details.message')}
                    verticalAlignment='top'
                >
                    <PWView style={styles.messageValue}>
                        <PWText>{dataMessage.message}</PWText>
                        <PWText
                            variant='captionMedium'
                            style={styles.untrustedNote}
                        >
                            {t(
                                'signing.arbitrary_data_details.message_untrusted_note',
                            )}
                        </PWText>
                    </PWView>
                </KeyValueRow>
                <KeyValueRow
                    title={t('signing.arbitrary_data_details.data')}
                    verticalAlignment='top'
                >
                    <PWText style={styles.data}>
                        {Buffer.from(dataMessage.data, 'base64').toString(
                            'utf-8',
                        )}
                    </PWText>
                </KeyValueRow>
            </PWView>
        </PWView>
    )
}
