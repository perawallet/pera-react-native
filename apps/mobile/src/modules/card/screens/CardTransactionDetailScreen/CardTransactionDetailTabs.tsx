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

import type { CardTransaction } from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { createPWTabNavigator } from '@components/core/PWTabView/PWTabView'
import { useLanguage } from '@hooks/useLanguage'
import {
    CardTransactionKind,
    getCardTransactionKind,
} from '../../utils/cardTransactions'
import { TransactionInfoTab } from './TransactionInfoTab'
import { MerchantInfoTab } from './MerchantInfoTab'

type DetailTabsParamList = {
    TransactionInfo: undefined
    MerchantInfo: undefined
}

const Tab = createPWTabNavigator<DetailTabsParamList>()

type CardTransactionDetailTabsProps = {
    transaction: CardTransaction
}

export const CardTransactionDetailTabs = ({
    transaction,
}: CardTransactionDetailTabsProps) => {
    const { t } = useLanguage()

    // Deposits have no merchant, so there's nothing to tab between.
    if (getCardTransactionKind(transaction) === CardTransactionKind.Deposit) {
        return <TransactionInfoTab transaction={transaction} />
    }

    return (
        <Tab.Navigator
            screenListeners={({ route, navigation }) => ({
                tabPress: () => {
                    // Re-tapping the focused tab is not a switch.
                    if (navigation.isFocused()) return
                    trackEvent(
                        route.name === 'MerchantInfo'
                            ? CardEvent.TransactionsMerchantTab
                            : CardEvent.TransactionsTransactionTab,
                    )
                },
            })}
        >
            <Tab.Screen
                name='TransactionInfo'
                options={{
                    title: t('peraCard.transactions.detail_tab_transaction'),
                }}
            >
                {() => <TransactionInfoTab transaction={transaction} />}
            </Tab.Screen>
            <Tab.Screen
                name='MerchantInfo'
                options={{
                    title: t('peraCard.transactions.detail_tab_merchant'),
                }}
            >
                {() => <MerchantInfoTab transaction={transaction} />}
            </Tab.Screen>
        </Tab.Navigator>
    )
}
