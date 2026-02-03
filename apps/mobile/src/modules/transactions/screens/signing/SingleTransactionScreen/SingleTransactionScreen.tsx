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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ScrollView } from 'react-native-gesture-handler'
import { TransactionSummaryHeader } from '@modules/transactions/components/signing/TransactionSummaryHeader'
import { ViewDetailsButton } from '@modules/transactions/components/signing/ViewDetailsButton'
import { FeeDisplay } from '@modules/transactions/components/signing/FeeDisplay'
import { SigningWarnings } from '@modules/transactions/components/signing/SigningWarnings'
import type { SigningStackParamList } from '@modules/transactions/routes/signing/types'
import { useStyles } from './styles'
import { useTransactionSigningContext } from '@modules/transactions/hooks/signing/useTransactionSigning'
import Decimal from 'decimal.js'

type NavigationProp = NativeStackNavigationProp<SigningStackParamList>

export const SingleTransactionScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const { groups, totalFee } = useTransactionSigningContext()

    const transaction = groups[0]?.[0]

    if (!transaction) {
        return (
            <EmptyView
                title={t('signing.transaction_view.invalid_title')}
                body={t('signing.transaction_view.invalid_body')}
            />
        )
    }

    const handleViewDetails = () => {
        navigation.navigate('TransactionDetails', { transaction })
    }

    return (
        <ScrollView contentContainerStyle={styles.contentContainer}>
            <PWView style={styles.container}>
                <TransactionSummaryHeader transaction={transaction} />

                <PWDivider color={theme.colors.layerGray} />

                <ViewDetailsButton onPress={handleViewDetails} />

                <PWDivider color={theme.colors.layerGray} />

                <FeeDisplay fee={new Decimal(totalFee)} />

                <SigningWarnings />
            </PWView>
        </ScrollView>
    )
}
