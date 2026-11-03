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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useNavigation,
    useRoute,
    type NavigationProp,
    type RouteProp,
} from '@react-navigation/native'
import {
    runOnJS,
    useAnimatedReaction,
    useSharedValue,
    type SharedValue,
} from 'react-native-reanimated'
import {
    useAccountChainId,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import type { PWPagerTab } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useNftHoldingSources } from '../../hooks/useNftHoldingSources'
import type { AccountStackParamsList, AccountTabKey } from '../../routes/types'
import {
    trackEvent,
    AccountDetailsEvent,
    AnalyticsMetadataKey,
} from '@analytics'

const TAB_EVENTS: Record<AccountTabKey, AccountDetailsEvent> = {
    Overview: AccountDetailsEvent.Assets,
    Nfts: AccountDetailsEvent.Collectibles,
    History: AccountDetailsEvent.History,
}

export type AccountTab = PWPagerTab & { key: AccountTabKey }

export type UseAccountTabNavigatorResult = {
    index: number
    offset: SharedValue<number>
    tabs: AccountTab[]
    isPageVisited: (pageIndex: number) => boolean
    handleIndexChange: (nextIndex: number) => void
}

export const useAccountTabNavigator = (
    account: WalletAccount,
): UseAccountTabNavigatorResult => {
    const { t } = useLanguage()
    const chainId = useAccountChainId(account, LEGACY_CHAIN_ID)
    const hasNfts = useNftHoldingSources(account).length > 0
    const hasHistory = useChainCapability(chainId, 'history')
    const offset = useSharedValue(0)

    const tabs = useMemo<AccountTab[]>(
        () => [
            {
                key: 'Overview',
                title: t('account_details.main_screen.overview_tab'),
            },
            ...(hasNfts
                ? [
                      {
                          key: 'Nfts' as const,
                          title: t('account_details.main_screen.nfts_tab'),
                      },
                  ]
                : []),
            ...(hasHistory
                ? [
                      {
                          key: 'History' as const,
                          title: t('account_details.main_screen.history_tab'),
                      },
                  ]
                : []),
        ],
        [t, hasNfts, hasHistory],
    )

    // Keyed rather than indexed: switching to an account whose chain has fewer
    // tabs shifts the indices, and a missing active tab falls back to Overview.
    const [activeKey, setActiveKey] = useState<AccountTabKey>('Overview')
    const index = Math.max(
        0,
        tabs.findIndex(tab => tab.key === activeKey),
    )

    // Mounting the asset list, the NFT pipeline and the transaction list in one
    // frame is what `lazy` avoided on the navigator it replaced. A page stays
    // unmounted until first visited, and mounted after, so returning is instant.
    const [visitedPages, setVisitedPages] = useState(
        () => new Set<AccountTabKey>(['Overview']),
    )

    const markVisited = useCallback(
        (pageIndex: number) => {
            const key = tabs[pageIndex]?.key
            if (!key) return
            setVisitedPages(previous =>
                previous.has(key) ? previous : new Set(previous).add(key),
            )
        },
        [tabs],
    )

    // A caller outside the screen asks for a tab through the route; the
    // param is cleared once read so asking again later applies again.
    const navigation =
        useNavigation<
            NavigationProp<AccountStackParamsList, 'AccountDetails'>
        >()
    const requestedTab =
        useRoute<RouteProp<AccountStackParamsList, 'AccountDetails'>>().params
            ?.tab
    useEffect(() => {
        if (!requestedTab) return
        const requestedIndex = tabs.findIndex(tab => tab.key === requestedTab)
        if (requestedIndex >= 0) {
            setActiveKey(requestedTab)
            markVisited(requestedIndex)
        }
        navigation.setParams({ tab: undefined })
    }, [requestedTab, tabs, markVisited, navigation])

    // Mount the incoming page as the drag passes halfway rather than when it
    // settles, so the mount lands while the finger is still moving instead of
    // inside the settle animation, where a dropped frame reads as a jolt.
    // `Math.round` only changes at that crossing, so this fires once per page.
    useAnimatedReaction(
        () => Math.round(offset.value),
        (nearest, previous) => {
            if (nearest !== previous) runOnJS(markVisited)(nearest)
        },
        [markVisited],
    )

    const handleIndexChange = useCallback(
        (nextIndex: number) => {
            const key = tabs[nextIndex]?.key
            if (!key) return
            setActiveKey(key)
            markVisited(nextIndex)
            trackEvent(TAB_EVENTS[key], {
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
        },
        [chainId, markVisited, tabs],
    )

    const isPageVisited = useCallback(
        (pageIndex: number) => {
            const key = tabs[pageIndex]?.key
            return key !== undefined && visitedPages.has(key)
        },
        [tabs, visitedPages],
    )

    return { index, offset, tabs, isPageVisited, handleIndexChange }
}
