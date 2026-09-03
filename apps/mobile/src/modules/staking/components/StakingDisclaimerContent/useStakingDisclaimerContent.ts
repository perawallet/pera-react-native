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

import { useCallback, useRef, useState } from 'react'
import type {
    LayoutChangeEvent,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native'

const BOTTOM_THRESHOLD = 20

type UseStakingDisclaimerSheetResult = {
    isScrolledToBottom: boolean
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    handleLayout: (event: LayoutChangeEvent) => void
    handleContentSizeChange: (width: number, height: number) => void
}

export const useStakingDisclaimerSheet =
    (): UseStakingDisclaimerSheetResult => {
        const [isScrolledToBottom, setIsScrolledToBottom] = useState(false)
        const viewportHeight = useRef(0)
        const contentHeight = useRef(0)

        /**
         * On a tall viewport (tablet, landscape, large text off) the disclaimer
         * fits without scrolling, so `onScroll` never fires and the accept
         * button would stay disabled forever. Nothing is left to
         * read in that case, so treat "fits" the same as "scrolled to bottom".
         *
         * One-way, like the scroll path: a later reflow that overflows does not
         * re-gate an action the user has already been offered.
         */
        const unlockIfContentFits = useCallback(() => {
            if (viewportHeight.current === 0 || contentHeight.current === 0) {
                return
            }
            if (
                contentHeight.current <=
                viewportHeight.current + BOTTOM_THRESHOLD
            ) {
                setIsScrolledToBottom(true)
            }
        }, [])

        const handleLayout = useCallback(
            (event: LayoutChangeEvent) => {
                viewportHeight.current = event.nativeEvent.layout.height
                unlockIfContentFits()
            },
            [unlockIfContentFits],
        )

        const handleContentSizeChange = useCallback(
            (_width: number, height: number) => {
                contentHeight.current = height
                unlockIfContentFits()
            },
            [unlockIfContentFits],
        )

        const handleScroll = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                if (isScrolledToBottom) {
                    return
                }

                const { contentOffset, contentSize, layoutMeasurement } =
                    event.nativeEvent
                const hasReachedBottom =
                    contentOffset.y + layoutMeasurement.height >=
                    contentSize.height - BOTTOM_THRESHOLD

                if (hasReachedBottom) {
                    setIsScrolledToBottom(true)
                }
            },
            [isScrolledToBottom],
        )

        return {
            isScrolledToBottom,
            handleScroll,
            handleLayout,
            handleContentSizeChange,
        }
    }
