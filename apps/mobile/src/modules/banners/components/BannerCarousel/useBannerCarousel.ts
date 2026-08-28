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

import { useCallback, useState } from 'react'
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native'

type UseBannerCarouselParams = {
    initialIndex: number
    /** Banner count, so a dismissal can't leave the active index past the end. */
    count: number
}

type PageSize = {
    width: number
    height: number
}

type UseBannerCarouselResult = {
    activeIndex: number
    /** Zeroed until the pager area is measured; pages mount only once it is known. */
    pageSize: PageSize
    handleLayout: (event: LayoutChangeEvent) => void
    handleMomentumScrollEnd: (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => void
}

export const useBannerCarousel = ({
    initialIndex,
    count,
}: UseBannerCarouselParams): UseBannerCarouselResult => {
    const [pageSize, setPageSize] = useState<PageSize>({ width: 0, height: 0 })
    const [activeIndex, setActiveIndex] = useState(initialIndex)

    // Both dimensions, not just the width: a page nested in the list has no
    // parent with a definite height, so a percentage height collapses to auto
    // and the card's proportional halves get no space to divide.
    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout
        setPageSize(current =>
            current.width === width && current.height === height
                ? current
                : { width, height },
        )
    }, [])

    const handleMomentumScrollEnd = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, layoutMeasurement } = event.nativeEvent
            if (layoutMeasurement.width === 0) return

            setActiveIndex(
                Math.round(contentOffset.x / layoutMeasurement.width),
            )
        },
        [],
    )

    // Clamped on read rather than synced to `count`: dismissing a banner
    // shrinks the list under us, and a stored index past the end lights no dot
    // at all.
    const clampedIndex = Math.min(activeIndex, Math.max(count - 1, 0))

    return {
        activeIndex: clampedIndex,
        pageSize,
        handleLayout,
        handleMomentumScrollEnd,
    }
}
