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

import { useCallback, useRef, useState, type RefObject } from 'react'
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PWScreenScrollHandle } from '@components/core'

// Within this many points of the end, the rest of the review counts as seen.
const END_THRESHOLD = 24

export type UseReviewScrollHintResult = {
    scrollRef: RefObject<Nullable<PWScreenScrollHandle>>
    /** More of the review sits below the fold. */
    isMoreBelow: boolean
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    handleBodyLayout: (event: LayoutChangeEvent) => void
    handleContentSizeChange: (width: number, height: number) => void
    handleScrollToEnd: () => void
}

/** Tracks whether the review body has more to read, flipping state only when that changes. */
export const useReviewScrollHint = (): UseReviewScrollHintResult => {
    const scrollRef = useRef<PWScreenScrollHandle>(null)
    const metrics = useRef({ viewport: 0, content: 0, offset: 0 })
    const [isMoreBelow, setIsMoreBelow] = useState(false)

    const update = useCallback(() => {
        const { viewport, content, offset } = metrics.current
        setIsMoreBelow(
            viewport > 0 && content - viewport - offset > END_THRESHOLD,
        )
    }, [])

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            metrics.current.offset = event.nativeEvent.contentOffset.y
            update()
        },
        [update],
    )

    const handleBodyLayout = useCallback(
        (event: LayoutChangeEvent) => {
            metrics.current.viewport = event.nativeEvent.layout.height
            update()
        },
        [update],
    )

    const handleContentSizeChange = useCallback(
        (_width: number, height: number) => {
            metrics.current.content = height
            update()
        },
        [update],
    )

    const handleScrollToEnd = useCallback(() => {
        scrollRef.current?.scrollToEnd({ animated: true })
    }, [])

    return {
        scrollRef,
        isMoreBelow,
        handleScroll,
        handleBodyLayout,
        handleContentSizeChange,
        handleScrollToEnd,
    }
}
