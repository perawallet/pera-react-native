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
import {
    runOnJS,
    useAnimatedReaction,
    type SharedValue,
} from 'react-native-reanimated'

/** True while any part of the page is showing: one page at rest, two mid-swipe. */
export const isPageOnScreen = (offset: number, pageIndex: number): boolean => {
    'worklet'
    return pageIndex >= Math.floor(offset) && pageIndex <= Math.ceil(offset)
}

/**
 * Follows the pager offset (in pages) rather than its selected index, which
 * commits only after the settle animation and so can't say what is showing
 * mid-swipe. Starts true: a page mounts on its first visit, while on screen.
 */
export const useIsPageOnScreen = (
    offset: SharedValue<number>,
    pageIndex: number,
): boolean => {
    const [isOnScreen, setIsOnScreen] = useState(true)

    useAnimatedReaction(
        () => isPageOnScreen(offset.value, pageIndex),
        (next, previous) => {
            if (next !== previous) runOnJS(setIsOnScreen)(next)
        },
        [pageIndex],
    )

    return isOnScreen
}
