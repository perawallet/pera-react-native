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
import {
    useWindowDimensions,
    type LayoutChangeEvent,
    type ViewStyle,
} from 'react-native'
import {
    useCompetingGestures,
    usePanGesture,
    type PanGestureActiveEvent,
} from 'react-native-gesture-handler'
import {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    type AnimatedStyle,
} from 'react-native-reanimated'

import {
    PWPAGER_ACTIVATION_OFFSET,
    PWPAGER_DRAWER_COMMIT_THRESHOLD,
    PWPAGER_DRAWER_OPEN_EPSILON,
    PWPAGER_FLING_VELOCITY,
    PWPAGER_OPPOSITE_BOUND,
    PWPAGER_SPRING_CONFIG,
    PWPAGER_VERTICAL_CANCEL_OFFSET,
} from './constants'
import { useStyles } from './styles'
import type { PWPagerProps } from './types'

export type UsePWPagerParams = Required<
    Pick<
        PWPagerProps,
        | 'children'
        | 'index'
        | 'onIndexChange'
        | 'drawerWidth'
        | 'drawerEdgeWidth'
        | 'isSwipeEnabled'
    >
> &
    Pick<
        PWPagerProps,
        'offset' | 'drawerProgress' | 'onDrawerOpen' | 'onDrawerClose'
    >

export type UsePWPagerResult = {
    pages: ReactNode[]
    width: number
    styles: ReturnType<typeof useStyles>
    handleLayout: (event: LayoutChangeEvent) => void
    gesture: ReturnType<typeof useCompetingGestures>
    /** Published to nested content that needs to take precedence over paging. */
    trailingPan: ReturnType<typeof usePanGesture>
    trackStyle: AnimatedStyle<ViewStyle>
}

export const usePWPager = ({
    children,
    index,
    onIndexChange,
    offset: externalOffset,
    drawerProgress,
    drawerWidth,
    onDrawerOpen,
    onDrawerClose,
    drawerEdgeWidth,
    isSwipeEnabled,
}: UsePWPagerParams): UsePWPagerResult => {
    // Window width until the viewport reports its own, so the first frame isn't
    // an empty pager waiting on layout.
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
        // Skip when React is only catching up to a page the gesture already
        // settled on; re-springing would restart that animation from zero
        // velocity partway through, which reads as a jolt.
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
                      : drawerProgress.value > PWPAGER_DRAWER_COMMIT_THRESHOLD

            drawerProgress.value = withSpring(
                shouldOpen ? 1 : 0,
                {
                    ...PWPAGER_SPRING_CONFIG,
                    // Carry the finger's speed into the settle, or the motion
                    // stalls on lift-off and re-accelerates.
                    velocity: event.velocityX / drawerWidth,
                },
                // Reported on completion, not here: committing flips the
                // drawer's open state, and PWDrawer attaches gesture handlers
                // off that — dropped frames in the last few frames of the settle.
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

        offset.value = withSpring(
            target,
            {
                ...PWPAGER_SPRING_CONFIG,
                // Negated: offset counts up as content moves left, so a
                // rightward flick is a negative page velocity.
                velocity: -event.velocityX / width,
            },
            // Reported on completion so the React commit it triggers — new page
            // mounted, state set, analytics — lands after the animation instead
            // of dropping frames inside it. That cost scales with the account.
            finished => {
                'worklet'
                if (!finished) return
                if (target === committedIndex.value) return

                committedIndex.value = target
                runOnJS(onIndexChange)(target)
            },
        )
    }

    // Two direction-specific pans, so nested content can defer only the
    // direction it needs: an asset row blocks the leftward pan alone, and a
    // rightward swipe on that same row still reaches the drawer. One shared pan
    // would hang instead — `block` waits for the row's gesture to *fail*, and a
    // row that never activates rightward never fails.
    //
    // The hook API rather than `Gesture.Pan()`: a builder gesture only gets its
    // handler tag once its detector attaches, after descendants have read it.
    // Config is spelled out on both rather than spread from a shared object —
    // the worklets plugin has to see it statically to workletize the callbacks.
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

            // Leftward closes an open drawer, and only pages otherwise. Without
            // this the close swipe falls through and switches tabs instead.
            isDrivingDrawer.value =
                canDriveDrawer &&
                (drawerProgress?.value ?? 0) > PWPAGER_DRAWER_OPEN_EPSILON
                    ? 1
                    : 0
        },
        onUpdate: onPanUpdate,
        onDeactivate: onPanEnd,
    })

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

    return {
        pages,
        width,
        styles,
        handleLayout,
        gesture,
        trailingPan,
        trackStyle,
    }
}
