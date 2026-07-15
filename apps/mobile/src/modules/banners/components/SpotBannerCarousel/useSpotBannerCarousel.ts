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

import { useState } from 'react'

import type { SpotBanner } from '@perawallet/wallet-core-banners'
import type { PagerViewOnPageSelectedEvent } from 'react-native-pager-view'

type UseSpotBannerCarouselResult = {
    /**
     * Stable key for the current banner set. Keying `PagerView` to it remounts
     * the pager whenever the set changes — see the consuming component for why.
     */
    pagerKey: string
    activeIndex: number
    handlePageSelected: (event: PagerViewOnPageSelectedEvent) => void
}

export const useSpotBannerCarousel = (
    banners: SpotBanner[],
): UseSpotBannerCarouselResult => {
    const [activeIndex, setActiveIndex] = useState(0)

    // react-native-pager-view (Android) does not reliably re-attach touch
    // handling to its pages when the children array changes (e.g. a banner is
    // dismissed): the page left at the front becomes unresponsive until a swipe
    // forces ViewPager2 to re-layout. Keying the pager to the banner set
    // remounts it on every change, so each dismissal yields a fresh, fully
    // interactive pager. Reset the active dot in the same render so it tracks
    // the pager's reset to page 0.
    const pagerKey = banners.map(banner => banner.id).join('-')
    const [renderedKey, setRenderedKey] = useState(pagerKey)
    if (renderedKey !== pagerKey) {
        setRenderedKey(pagerKey)
        setActiveIndex(0)
    }

    const handlePageSelected = (event: PagerViewOnPageSelectedEvent) => {
        setActiveIndex(event.nativeEvent.position)
    }

    return { pagerKey, activeIndex, handlePageSelected }
}
