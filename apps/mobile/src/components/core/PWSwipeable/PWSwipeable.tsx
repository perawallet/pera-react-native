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

import React from 'react'
import ReanimatedSwipeable, {
    type SwipeableProps,
    type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'

export const DEFAULT_SWIPE_ACTION_WIDTH = 80

/**
 * Pass as `dragOffsetFromLeft`/`dragOffsetFromRight` to make a row ignore that
 * direction entirely: the offset is never reached, so the swipe stays available
 * to whatever sits behind it.
 *
 * A row inside a PWPager needs this. Both directions activate at 10 by default —
 * the same threshold as the pager — so a swipe the row has no actions for is
 * still captured by it and silently does nothing, instead of paging or opening
 * the drawer. Large rather than Infinity, which gesture-handler won't serialise.
 */
export const PWSWIPEABLE_IGNORE_DIRECTION = 100_000

export type PWSwipeableProps = SwipeableProps

export const PWSwipeable = ({
    children,
    rightThreshold = DEFAULT_SWIPE_ACTION_WIDTH,
    ...props
}: PWSwipeableProps) => {
    return (
        <ReanimatedSwipeable
            rightThreshold={rightThreshold}
            {...props}
        >
            {children}
        </ReanimatedSwipeable>
    )
}

export type PWSwipeableRef = SwipeableMethods
