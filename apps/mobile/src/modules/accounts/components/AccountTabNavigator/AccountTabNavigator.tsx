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

import { createPWTabNavigator } from '@components/core/PWTabView/PWTabView'
import { useLanguage } from '@hooks/useLanguage'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountOverview } from '../AccountOverview'
import { AccountNfts } from '../AccountNfts'
import { AccountHistory } from '../AccountHistory'

export type AccountTabNavigatorProps = {
    account: WalletAccount
    chartVisible: boolean
}

export type AccountTabsParamsList = {
    Overview: undefined
    Nfts: undefined
    History: undefined
}

const Tab = createPWTabNavigator<AccountTabsParamsList>()

export const AccountTabNavigator = ({
    account,
    chartVisible,
}: AccountTabNavigatorProps) => {
    const { t } = useLanguage()

    return (
        <Tab.Navigator>
            <Tab.Screen
                name='Overview'
                options={{
                    title: t('account_details.main_screen.overview_tab'),
                }}
            >
                {() => (
                    <AccountOverview
                        account={account}
                        chartVisible={chartVisible}
                    />
                )}
            </Tab.Screen>

            <Tab.Screen
                name='Nfts'
                options={{ title: t('account_details.main_screen.nfts_tab') }}
                component={AccountNfts}
            />

            <Tab.Screen
                name='History'
                options={{
                    title: t('account_details.main_screen.history_tab'),
                }}
                component={AccountHistory}
            />
        </Tab.Navigator>
    )
}
