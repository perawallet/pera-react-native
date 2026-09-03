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

import { PWPagerTabBar, PWView } from '@components/core'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDrawerPager } from '@modules/accounts/components/AccountDrawer'

import { AccountOverview } from '../AccountOverview'
import { AccountNfts } from '../AccountNfts'
import { AccountHistory } from '../AccountHistory'
import { useStyles } from './styles'
import { useAccountTabNavigator } from './useAccountTabNavigator'

export type AccountTabNavigatorProps = {
    account: WalletAccount
    chartVisible: boolean
}

/**
 * Overview / NFTs / History as a PWPager rather than a material-top-tabs
 * navigator, so the account drawer and the tabs share one horizontal pan — see
 * PWPager for why the two cannot otherwise coexist.
 */
export const AccountTabNavigator = ({
    account,
    chartVisible,
}: AccountTabNavigatorProps) => {
    const styles = useStyles()
    const { index, offset, tabs, isPageVisited, handleIndexChange } =
        useAccountTabNavigator()

    return (
        <PWView style={styles.container}>
            <PWPagerTabBar
                tabs={tabs}
                onIndexChange={handleIndexChange}
                offset={offset}
            />
            <AccountDrawerPager
                index={index}
                onIndexChange={handleIndexChange}
                offset={offset}
            >
                <PWView style={styles.page}>
                    <AccountOverview
                        account={account}
                        chartVisible={chartVisible}
                    />
                </PWView>
                <PWView style={styles.page}>
                    {isPageVisited(1) && <AccountNfts />}
                </PWView>
                <PWView style={styles.page}>
                    {isPageVisited(2) && <AccountHistory />}
                </PWView>
            </AccountDrawerPager>
        </PWView>
    )
}
