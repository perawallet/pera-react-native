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

import { type ReactNode } from 'react'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { PWView } from '../PWView'

import { PWPAGER_DRAWER_EDGE_WIDTH } from './constants'
import { PWPagerGestureContext } from './PWPagerGestureContext'
import { type PWPagerProps } from './types'
import { usePWPager } from './usePWPager'

/**
 * Horizontal pager that can also own a drawer's open gesture.
 *
 * Hand-rolled rather than wrapping `react-native-pager-view`, whose root view
 * calls `NativeGestureUtil.notifyNativeGestureStarted` past the touch slop and
 * so makes gesture-handler cancel every handler under it. No threshold or
 * gesture-relationship config arbitrates the two; owning the axis removes the
 * conflict instead — one pan, one decision.
 *
 * Which value a drag moves is settled once, at activation:
 *
 * | start        | page  | direction | drives         |
 * | ------------ | ----- | --------- | -------------- |
 * | anywhere     | first | right     | drawerProgress |
 * | leading edge | rest  | right     | drawerProgress |
 * | mid-screen   | rest  | right     | page offset    |
 * | anywhere     | any   | left      | page offset    |
 */
export const PWPager = ({
    children,
    index,
    onIndexChange,
    offset,
    drawerProgress,
    drawerWidth = 0,
    onDrawerOpen,
    onDrawerClose,
    drawerEdgeWidth = PWPAGER_DRAWER_EDGE_WIDTH,
    isSwipeEnabled = true,
}: PWPagerProps) => {
    const {
        pages,
        width,
        styles,
        handleLayout,
        gesture,
        trailingPan,
        trackStyle,
    } = usePWPager({
        children,
        index,
        onIndexChange,
        offset,
        drawerProgress,
        drawerWidth,
        onDrawerOpen,
        onDrawerClose,
        drawerEdgeWidth,
        isSwipeEnabled,
    })

    return (
        // Only the trailing pan is published: content that reveals on a leftward
        // swipe blocks that one, leaving a rightward swipe on the same content
        // free to reach the drawer. See PWPagerGestureContext.
        <PWPagerGestureContext.Provider value={trailingPan}>
            <GestureDetector gesture={gesture}>
                <PWView
                    style={styles.viewport}
                    onLayout={handleLayout}
                    testID='pw_pager'
                >
                    {width > 0 && (
                        <Animated.View style={[styles.track, trackStyle]}>
                            {pages.map((page: ReactNode, pageIndex: number) => (
                                // Pages are a fixed, ordered list; there is no
                                // identity to key on beyond position.
                                <PWView
                                    key={pageIndex}
                                    style={styles.page}
                                >
                                    {page}
                                </PWView>
                            ))}
                        </Animated.View>
                    )}
                </PWView>
            </GestureDetector>
        </PWPagerGestureContext.Provider>
    )
}
