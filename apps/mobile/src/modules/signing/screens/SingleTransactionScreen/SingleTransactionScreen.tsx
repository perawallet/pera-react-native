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

import { PWDivider, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { ScrollView } from 'react-native-gesture-handler'
import { TransactionSummaryHeader } from '@modules/signing/components/TransactionSummaryHeader'
import { FeeDisplay } from '@modules/signing/components/FeeDisplay'
import { SigningWarnings } from '@modules/signing/components/SigningWarnings'
import {
    useSigningRequest,
    useSigningRequestAnalysis,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { useStyles } from './styles'
import Decimal from 'decimal.js'
import { SigningActionButtons } from '@modules/signing/components/SigningActionButtons'
import { SigningAccountDisplay } from '@modules/signing/components/SigningAccountDisplay/SigningAccountDisplay'

export const SingleTransactionScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { currentRequest } = useSigningRequest()
    const request = currentRequest as TransactionSignRequest
    const { allTransactions, totalFee } = useSigningRequestAnalysis(request)

    const transaction = allTransactions[0]

    if (!transaction) {
        return (
            <EmptyView
                title={t('signing.transaction_view.invalid_title')}
                body={t('signing.transaction_view.invalid_body')}
            />
        )
    }

    return (
        <ScrollView contentContainerStyle={styles.contentContainer}>
            <PWView style={styles.container}>
                <TransactionSummaryHeader transaction={transaction} />

                <SigningWarnings />

                <PWDivider
                    color={theme.colors.layerGray}
                    style={styles.paddedDivider}
                />

                <SigningAccountDisplay transaction={transaction} />

                <FeeDisplay
                    fee={new Decimal(totalFee)}
                    transaction={transaction}
                />

                <SigningActionButtons />
            </PWView>
        </ScrollView>
    )
}
