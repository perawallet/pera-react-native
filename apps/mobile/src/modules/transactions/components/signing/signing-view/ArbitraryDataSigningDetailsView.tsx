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

import { Image, Text } from '@rneui/themed'
import {
    ArbitraryDataSignRequest,
    PeraArbitraryDataMessage,
} from '@perawallet/wallet-core-blockchain'
import PWView from '@components/view/PWView'
import { useLanguage } from '@hooks/language'
import PWHeader from '@components/header/PWHeader'
import RowTitledItem from '@components/row-titled-item/RowTitledItem'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import AccountDisplay from '@modules/accounts/components/account-display/AccountDisplay'
import { useStyles } from './ArbitraryDataSigningDetailsView.style'
import CurrencyDisplay from '@components/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import PWIcon from '@components/icons/PWIcon'
import { ScrollView } from 'react-native-gesture-handler'

type ArbitraryDataSigningDetailsViewProps = {
    request: ArbitraryDataSignRequest
    dataMessage: PeraArbitraryDataMessage
    onBack: () => void
}

const ArbitraryDataSigningDetailsView = ({
    request,
    dataMessage,
    onBack,
}: ArbitraryDataSigningDetailsViewProps) => {
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const account = accounts.find(
        account => account.address === dataMessage.signer,
    )
    const styles = useStyles()
    const preferredIcon =
        request.sourceMetadata?.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? request.sourceMetadata?.icons?.at(0)
    const unnamedSource = t('signing.arbitrary_data_details.unnamed')

    return (
        <PWView style={styles.container}>
            <PWHeader
                title={t('signing.arbitrary_data_view.details_title')}
                leftIcon='chevron-left'
                onLeftPress={onBack}
            />
            <PWView style={[styles.section, styles.titleSection]}>
                {preferredIcon ? (
                    <Image
                        source={{ uri: preferredIcon }}
                        style={styles.metadataIcon}
                    />
                ) : (
                    <PWView style={styles.metadataIconContainer}>
                        <PWIcon
                            name='wallet-connect'
                            variant='secondary'
                            size='lg'
                        />
                    </PWView>
                )}
                <Text
                    h3
                    style={styles.title}
                >
                    {t('signing.arbitrary_data_details.title', {
                        name: request?.sourceMetadata?.name ?? unnamedSource,
                    })}
                </Text>
                <Text style={styles.description}>
                    {t('signing.arbitrary_data_details.description')}
                </Text>
            </PWView>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
            >
                <PWView style={styles.section}>
                    <RowTitledItem
                        title={t('signing.arbitrary_data_details.from')}
                    >
                        <AccountDisplay
                            account={account}
                            showChevron={false}
                        />
                    </RowTitledItem>
                    <RowTitledItem
                        title={t('signing.arbitrary_data_details.to')}
                    >
                        <Text>
                            {request?.sourceMetadata?.name ??
                                t('signing.arbitrary_data_details.unnamed')}
                        </Text>
                    </RowTitledItem>
                </PWView>
                <PWView style={styles.section}>
                    <RowTitledItem
                        title={t('signing.arbitrary_data_details.amount')}
                    >
                        <CurrencyDisplay
                            currency='ALGO'
                            value={Decimal(0)}
                            showSymbol
                            precision={2}
                            minPrecision={2}
                        />
                    </RowTitledItem>
                    <RowTitledItem
                        title={t('signing.arbitrary_data_details.fee')}
                    >
                        <CurrencyDisplay
                            currency='ALGO'
                            value={Decimal(0)}
                            showSymbol
                            precision={2}
                            minPrecision={2}
                        />
                    </RowTitledItem>
                </PWView>
                <PWView style={styles.section}>
                    <RowTitledItem
                        title={t('signing.arbitrary_data_details.message')}
                    >
                        <Text>{dataMessage.message}</Text>
                    </RowTitledItem>
                    <RowTitledItem
                        title={t('signing.arbitrary_data_details.data')}
                    >
                        <Text style={styles.data}>
                            {Buffer.from(dataMessage.data, 'base64').toString(
                                'utf-8',
                            )}
                        </Text>
                    </RowTitledItem>
                </PWView>
            </ScrollView>
        </PWView>
    )
}

export default ArbitraryDataSigningDetailsView
