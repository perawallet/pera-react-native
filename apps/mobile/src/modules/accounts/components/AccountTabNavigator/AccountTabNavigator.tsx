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

import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountOverview } from '../AccountOverview'
import { AccountNfts } from '../AccountNfts'
import { AccountHistory } from '../AccountHistory'
import { getTypography } from '@theme/typography'

export type AccountTabsParamsList = {
    Overview: undefined
    NFTs: undefined
    History: undefined
}

const Tab = createMaterialTopTabNavigator<AccountTabsParamsList>()

export type AccountTabNavigatorProps = {
    account: WalletAccount
}

export const AccountTabNavigator = ({ account }: AccountTabNavigatorProps) => {
    const { theme } = useTheme()
    const { t } = useLanguage()
    const bodyTypography = getTypography(theme, 'body')

    return (
        // TODO: refactor that into the PWTab/PWTabView component so it can be reused generically
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: theme.colors.textMain,
                tabBarInactiveTintColor: theme.colors.textGray,
                tabBarIndicatorStyle: {
                    backgroundColor: theme.colors.textMain,
                    height: 2,
                },
                tabBarStyle: {
                    backgroundColor: theme.colors.background,
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.layerGrayLight,
                },
                tabBarLabelStyle: {
                    fontFamily: bodyTypography.fontFamily,
                    fontSize: bodyTypography.fontSize,
                    textTransform: 'none',
                },
                tabBarPressColor: theme.colors.layerGrayLighter,
            }}
        >
            <Tab.Screen
                name='Overview'
                options={{
                    tabBarLabel: t('account_details.main_screen.overview_tab'),
                }}
            >
                {() => <AccountOverview account={account} />}
            </Tab.Screen>
            <Tab.Screen
                name='NFTs'
                component={AccountNfts}
                options={{
                    tabBarLabel: t('account_details.main_screen.nfts_tab'),
                }}
            />
            <Tab.Screen
                name='History'
                component={AccountHistory}
                options={{
                    tabBarLabel: t('account_details.main_screen.history_tab'),
                }}
            />
        </Tab.Navigator>
    )
}
