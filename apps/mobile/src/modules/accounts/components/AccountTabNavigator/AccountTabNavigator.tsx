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

import { useCallback, useMemo, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { PWPagerTabBar, PWView, type PWPagerTab } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { trackEvent, AccountDetailsEvent } from '@analytics'
import { AccountDrawerPager } from '@modules/accounts/components/AccountDrawer'

import { AccountOverview } from '../AccountOverview'
import { AccountNfts } from '../AccountNfts'
import { AccountHistory } from '../AccountHistory'
import { useStyles } from './styles'

export type AccountTabNavigatorProps = {
    account: WalletAccount
    chartVisible: boolean
}

const TAB_EVENTS = [
    AccountDetailsEvent.Assets,
    AccountDetailsEvent.Collectibles,
    AccountDetailsEvent.History,
]

/**
 * Overview / NFTs / History as a PWPager rather than a material-top-tabs
 * navigator, so the account drawer and the tabs share one horizontal pan — see
 * PWPager for why the two cannot otherwise coexist. Nothing navigated to these
 * tabs by route name, so dropping the navigator costs no navigation behaviour.
 */
export const AccountTabNavigator = ({
    account,
    chartVisible,
}: AccountTabNavigatorProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const [index, setIndex] = useState(0)
    const offset = useSharedValue(0)

    // Mounting the asset list, the NFT pipeline and the transaction list in one
    // frame is what `lazy` avoided on the navigator; a page stays unmounted
    // until first visited, and stays mounted after so returning is instant.
    const [visitedPages, setVisitedPages] = useState(() => new Set([0]))

    const tabs = useMemo<PWPagerTab[]>(
        () => [
            {
                key: 'Overview',
                title: t('account_details.main_screen.overview_tab'),
            },
            { key: 'Nfts', title: t('account_details.main_screen.nfts_tab') },
            {
                key: 'History',
                title: t('account_details.main_screen.history_tab'),
            },
        ],
        [t],
    )

    const handleIndexChange = useCallback((nextIndex: number) => {
        setIndex(nextIndex)
        setVisitedPages(previous =>
            previous.has(nextIndex)
                ? previous
                : new Set(previous).add(nextIndex),
        )
        trackEvent(TAB_EVENTS[nextIndex])
    }, [])

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
                    {visitedPages.has(1) && <AccountNfts />}
                </PWView>
                <PWView style={styles.page}>
                    {visitedPages.has(2) && <AccountHistory />}
                </PWView>
            </AccountDrawerPager>
        </PWView>
    )
}
