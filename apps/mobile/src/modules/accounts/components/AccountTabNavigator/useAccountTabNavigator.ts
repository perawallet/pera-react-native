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
import {
    runOnJS,
    useAnimatedReaction,
    useSharedValue,
    type SharedValue,
} from 'react-native-reanimated'
import type { PWPagerTab } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { trackEvent, AccountDetailsEvent } from '@analytics'

const TAB_EVENTS = [
    AccountDetailsEvent.Assets,
    AccountDetailsEvent.Collectibles,
    AccountDetailsEvent.History,
]

export type UseAccountTabNavigatorResult = {
    index: number
    offset: SharedValue<number>
    tabs: PWPagerTab[]
    isPageVisited: (pageIndex: number) => boolean
    handleIndexChange: (nextIndex: number) => void
}

export const useAccountTabNavigator = (): UseAccountTabNavigatorResult => {
    const { t } = useLanguage()
    const [index, setIndex] = useState(0)
    const offset = useSharedValue(0)

    // Mounting the asset list, the NFT pipeline and the transaction list in one
    // frame is what `lazy` avoided on the navigator it replaced. A page stays
    // unmounted until first visited, and mounted after, so returning is instant.
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

    const markVisited = useCallback((pageIndex: number) => {
        setVisitedPages(previous =>
            previous.has(pageIndex)
                ? previous
                : new Set(previous).add(pageIndex),
        )
    }, [])

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
            setIndex(nextIndex)
            markVisited(nextIndex)
            trackEvent(TAB_EVENTS[nextIndex])
        },
        [markVisited],
    )

    const isPageVisited = useCallback(
        (pageIndex: number) => visitedPages.has(pageIndex),
        [visitedPages],
    )

    return { index, offset, tabs, isPageVisited, handleIndexChange }
}
