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

import {
    Children,
    useCallback,
    useEffect,
    useState,
    type ReactNode,
} from 'react'
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import {
    GestureDetector,
    useCompetingGestures,
    usePanGesture,
    type PanGestureActiveEvent,
} from 'react-native-gesture-handler'
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { PWView } from '../PWView'

import {
    PWPAGER_ACTIVATION_OFFSET,
    PWPAGER_DRAWER_EDGE_WIDTH,
    PWPAGER_DRAWER_OPEN_EPSILON,
    PWPAGER_OPPOSITE_BOUND,
    PWPAGER_FLING_VELOCITY,
    PWPAGER_SPRING_CONFIG,
    PWPAGER_VERTICAL_CANCEL_OFFSET,
} from './constants'
import { PWPagerGestureContext } from './PWPagerGestureContext'
import { type PWPagerProps } from './types'
import { useStyles } from './styles'

/**
 * Horizontal pager that can also own a drawer's open gesture.
 *
 * Hand-rolled rather than wrapping `react-native-pager-view` because that
 * component's root view calls `NativeGestureUtil.notifyNativeGestureStarted`
 * once a drag passes the touch slop, which makes gesture-handler cancel every
 * handler under its root. A drawer pan anywhere in the tree therefore dies
 * mid-gesture, and no amount of threshold tuning or gesture-relationship
 * configuration fixes it — the two systems cannot be arbitrated. Owning the axis
 * removes the conflict rather than mediating it: one pan, one decision.
 *
 * Which value a drag moves is settled once, at activation:
 *
 * | start      | page  | direction | drives         |
 * | ---------- | ----- | --------- | -------------- |
 * | anywhere   | first | right     | drawerProgress |
 * | leading edge | rest | right    | drawerProgress |
 * | mid-screen | rest  | right     | page offset    |
 * | anywhere   | any   | left      | page offset    |
 */
export const PWPager = ({
    children,
    index,
    onIndexChange,
    offset: externalOffset,
    drawerProgress,
    drawerWidth = 0,
    onDrawerOpen,
    onDrawerClose,
    drawerEdgeWidth = PWPAGER_DRAWER_EDGE_WIDTH,
    isSwipeEnabled = true,
}: PWPagerProps) => {
    // Window width until the viewport reports its own. Both are equal wherever
    // the pager is full-bleed, and the estimate spares the first frame from
    // rendering an empty pager while waiting on layout.
    const { width: windowWidth } = useWindowDimensions()
    const [measuredWidth, setMeasuredWidth] = useState(0)
    const width = measuredWidth || windowWidth
    // Normalised so a caller can pass one child or many, and so nulls from
    // conditional pages don't leave gaps in the index.
    const pages = Children.toArray(children)
    const styles = useStyles({ pageWidth: width, pageCount: pages.length })

    // Always created — hooks can't be conditional — but ignored when a caller
    // supplies its own to read from.
    const ownOffset = useSharedValue(index)
    const offset = externalOffset ?? ownOffset
    const dragStartOffset = useSharedValue(0)
    const dragStartDrawer = useSharedValue(0)
    // 1 while a drag is moving the drawer, 0 while it's moving pages. Set once
    // at activation so a drag can't change its mind halfway.
    const isDrivingDrawer = useSharedValue(0)
    const committedIndex = useSharedValue(index)

    const lastPageIndex = pages.length - 1

    useEffect(() => {
        // Skip when this is just React catching up to a page the gesture has
        // already settled on. `onEnd` starts its own spring and then reports the
        // new index; re-springing here would restart that animation from zero
        // velocity partway through, which reads as a jolt in the last few
        // frames — worse the slower the re-render, so worst on a large account.
        if (committedIndex.value === index) return

        committedIndex.value = index
        offset.value = withSpring(index, PWPAGER_SPRING_CONFIG)
    }, [index, offset, committedIndex])

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        setMeasuredWidth(event.nativeEvent.layout.width)
    }, [])

    const canDriveDrawer = Boolean(drawerProgress) && drawerWidth > 0

    const onPanUpdate = (event: PanGestureActiveEvent) => {
        'worklet'
        if (isDrivingDrawer.value === 1 && drawerProgress) {
            const next =
                dragStartDrawer.value + event.translationX / drawerWidth
            drawerProgress.value = Math.min(Math.max(next, 0), 1)
            return
        }

        const next = dragStartOffset.value - event.translationX / width
        offset.value = Math.min(Math.max(next, 0), lastPageIndex)
    }
    const onPanEnd = (event: PanGestureActiveEvent) => {
        'worklet'
        if (isDrivingDrawer.value === 1 && drawerProgress) {
            const shouldOpen =
                event.velocityX > PWPAGER_FLING_VELOCITY
                    ? true
                    : event.velocityX < -PWPAGER_FLING_VELOCITY
                      ? false
                      : drawerProgress.value > 0.5

            drawerProgress.value = withSpring(
                shouldOpen ? 1 : 0,
                {
                    ...PWPAGER_SPRING_CONFIG,
                    // Carry the finger's speed into the settle. Without it the
                    // spring starts from a standstill the moment you lift off,
                    // which stalls the motion and then re-accelerates — a
                    // visible clunk at the end.
                    velocity: event.velocityX / drawerWidth,
                },
                // Reported on completion, not here. Committing flips the
                // drawer's open state, and PWDrawer mounts its dismiss surface
                // and re-arms the panel drag off that — two gesture handlers
                // attaching in the final frames. A drag that settles back where
                // it started changes no state, and has never had the jump,
                // which is what points at this.
                finished => {
                    'worklet'
                    if (!finished) return
                    if (shouldOpen && onDrawerOpen) runOnJS(onDrawerOpen)()
                    if (!shouldOpen && onDrawerClose) runOnJS(onDrawerClose)()
                },
            )
            return
        }

        // A flick commits to the neighbouring page even from a short drag;
        // otherwise the nearest page wins.
        const settled =
            event.velocityX < -PWPAGER_FLING_VELOCITY
                ? Math.ceil(offset.value)
                : event.velocityX > PWPAGER_FLING_VELOCITY
                  ? Math.floor(offset.value)
                  : Math.round(offset.value)
        const target = Math.min(Math.max(settled, 0), lastPageIndex)

        // Reported from the spring's completion rather than here, so the
        // React commit it triggers — new page mounted, state set, analytics
        // — lands after the animation instead of dropping frames inside it.
        // That cost scales with the account, which is why the judder showed
        // up on large ones. A drag that settles back where it started, or
        // one on a single-page pager, is not a change worth reporting.
        offset.value = withSpring(
            target,
            {
                ...PWPAGER_SPRING_CONFIG,
                // Negated: offset counts up as content moves left, so a
                // rightward flick is a negative page velocity.
                velocity: -event.velocityX / width,
            },
            finished => {
                'worklet'
                if (!finished) return
                if (target === committedIndex.value) return

                committedIndex.value = target
                runOnJS(onIndexChange)(target)
            },
        )
    }

    // Split by direction rather than one pan for both, so nested content can
    // defer only the direction it needs. An asset row reveals its action on a
    // leftward swipe, so it blocks the trailing pan alone — a rightward swipe on
    // that same row still reaches the drawer. One pan couldn't express that:
    // `block` makes the pager wait for the row's gesture to *fail*, and a row
    // that simply never activates rightward never fails either, so the drawer
    // would hang instead.
    //
    // Both use the v3 hook API rather than the deprecated `Gesture.Pan()`
    // builder for a second reason: a builder gesture only receives its handler
    // tag when its detector attaches, after descendants have already read it.
    // The hook allocates during render, so a child's relation resolves to
    // something real.
    // Leftward: always pages. Nothing reaches the drawer this way.
    // Properties are listed on both pans rather than spread from a shared
    // object: the worklets Babel plugin has to see a hook's config statically to
    // workletize its callbacks, and a SpreadElement defeats that.
    const trailingPan = usePanGesture({
        enabled: isSwipeEnabled && width > 0,
        failOffsetY: [
            -PWPAGER_VERTICAL_CANCEL_OFFSET,
            PWPAGER_VERTICAL_CANCEL_OFFSET,
        ],
        activeOffsetX: [-PWPAGER_ACTIVATION_OFFSET, PWPAGER_OPPOSITE_BOUND],
        onActivate: () => {
            'worklet'
            dragStartOffset.value = offset.value
            dragStartDrawer.value = drawerProgress?.value ?? 0

            // Leftward closes the drawer when one is open, and only pages
            // otherwise. Without this an open drawer's close swipe falls through
            // to the pager and switches tabs instead.
            isDrivingDrawer.value =
                canDriveDrawer &&
                (drawerProgress?.value ?? 0) > PWPAGER_DRAWER_OPEN_EPSILON
                    ? 1
                    : 0
        },
        onUpdate: onPanUpdate,
        onDeactivate: onPanEnd,
    })

    // Rightward: the drawer, when there is one to open and we are either on the
    // first page or starting from the leading edge; otherwise pages back.
    const leadingPan = usePanGesture({
        enabled: isSwipeEnabled && width > 0,
        failOffsetY: [
            -PWPAGER_VERTICAL_CANCEL_OFFSET,
            PWPAGER_VERTICAL_CANCEL_OFFSET,
        ],
        activeOffsetX: [-PWPAGER_OPPOSITE_BOUND, PWPAGER_ACTIVATION_OFFSET],
        onActivate: event => {
            'worklet'
            dragStartOffset.value = offset.value
            dragStartDrawer.value = drawerProgress?.value ?? 0

            const isFromLeadingEdge = event.x <= drawerEdgeWidth
            const isOnFirstPage = offset.value <= 0
            const isDrawerPartlyOpen =
                (drawerProgress?.value ?? 0) > PWPAGER_DRAWER_OPEN_EPSILON

            isDrivingDrawer.value =
                canDriveDrawer &&
                (isDrawerPartlyOpen || isOnFirstPage || isFromLeadingEdge)
                    ? 1
                    : 0
        },
        onUpdate: onPanUpdate,
        onDeactivate: onPanEnd,
    })

    const gesture = useCompetingGestures(trailingPan, leadingPan)

    const trackStyle = useAnimatedStyle(
        () => ({ transform: [{ translateX: -offset.value * width }] }),
        [width],
    )

    return (
        // Only the trailing pan is published: content that reveals on a
        // leftward swipe blocks that one, leaving a rightward swipe on the same
        // content free to reach the drawer. See PWPagerGestureContext.
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
                                <PWView
                                    // Pages are a fixed, ordered list; there is no
                                    // identity to key on beyond position.
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
