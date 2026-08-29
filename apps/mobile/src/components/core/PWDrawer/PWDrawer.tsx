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

import { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { PWView } from '../PWView'

import {
    PWDRAWER_CONTENT_OPACITY_PROGRESS,
    PWDRAWER_CONTENT_OPACITY_VALUES,
    PWDRAWER_CONTENT_SCALE_PROGRESS,
    PWDRAWER_CONTENT_SCALE_VALUES,
    PWDRAWER_SCRIM_OPACITY,
    PWDRAWER_SHADOW_ELEVATION,
    PWDRAWER_SHADOW_FADE_PROGRESS,
    PWDRAWER_SHADOW_OPACITY,
    PWDRAWER_SPRING_CONFIG,
    PWDRAWER_WIDTH_RATIO,
} from './constants'
import { PWDrawerGestureSurface } from './PWDrawerGestureSurface'
import { type PWDrawerProps } from './types'
import { useStyles } from './styles'
import { usePWDrawerDrag } from './usePWDrawerDrag'

/**
 * Edge drawer with a finger-following drag.
 *
 * Hand-rolled on reanimated rather than wrapping a drawer library, for one
 * structural reason: every library (`react-native-drawer-layout` and RNGH's own
 * `ReanimatedDrawerLayout` alike) puts its pan handler in a view that wraps the
 * content, and `react-native-pager-view`'s root view calls
 * `NativeGestureUtil.notifyNativeGestureStarted` once a drag passes the touch
 * slop — which makes gesture-handler cancel every handler under its root. A pan
 * positioned above the content therefore dies mid-gesture on any screen backed
 * by a pager. Screens with a pager hand the drag to PWPager instead; the rest
 * use PWDrawerGestureSurface, which sits on top so the pager never sees it.
 */
export const PWDrawer = ({
    isOpen,
    onOpen,
    onClose,
    renderContent,
    variant = 'back',
    progress: externalProgress,
    hasOwnOpenGesture = true,
    isSwipeEnabled = true,
    edgeWidth,
    widthRatio = PWDRAWER_WIDTH_RATIO,
    hasEdgeShadow = true,
    hasContentGrowIn = true,
    contentStyle,
    children,
}: PWDrawerProps) => {
    const { width } = useWindowDimensions()
    const panelWidth = Math.round(width * widthRatio)
    const styles = useStyles({ panelWidth })

    // 0 closed, 1 open. Whoever owns it writes it directly, so the drag tracks
    // the finger on the UI thread; taps on the trigger animate it via the
    // effect below. Always created — hooks can't be conditional — but ignored
    // when an owner supplies its own.
    const ownProgress = useSharedValue(isOpen ? 1 : 0)
    const progress = externalProgress ?? ownProgress

    // Only when nobody else owns progress. An owner animates it themselves —
    // and a gesture settles it carrying the finger's velocity, so re-springing
    // from `isOpen` here would restart that animation from a standstill partway
    // through and jolt the closing frames.
    const isOwnedElsewhere = Boolean(externalProgress)

    useEffect(() => {
        if (isOwnedElsewhere) return

        progress.value = withSpring(isOpen ? 1 : 0, PWDRAWER_SPRING_CONFIG)
    }, [isOpen, progress, isOwnedElsewhere])

    const isBack = variant === 'back'

    const contentAnimatedStyle = useAnimatedStyle(() => {
        const shadowStrength = interpolate(
            progress.value,
            [0, PWDRAWER_SHADOW_FADE_PROGRESS],
            [0, 1],
            Extrapolation.CLAMP,
        )

        return {
            // `back` slides the content off a stationary panel; `front` leaves
            // the content put and moves the panel over it instead.
            transform: [
                { translateX: isBack ? progress.value * panelWidth : 0 },
            ],
            ...(hasEdgeShadow
                ? {
                      shadowOpacity: shadowStrength * PWDRAWER_SHADOW_OPACITY,
                      elevation: shadowStrength * PWDRAWER_SHADOW_ELEVATION,
                  }
                : null),
        }
    }, [isBack, panelWidth, hasEdgeShadow])

    const panelAnimatedStyle = useAnimatedStyle(() => {
        if (isBack) return {}

        return {
            transform: [{ translateX: (progress.value - 1) * panelWidth }],
        }
    }, [isBack, panelWidth])

    const scrimAnimatedStyle = useAnimatedStyle(() => ({
        opacity: progress.value * PWDRAWER_SCRIM_OPACITY,
    }))

    // Grows and fades into place, with a slight overshoot before settling — see
    // PWDRAWER_CONTENT_* for the ramps, and for why this rides progress rather
    // than firing as its own animation once the drawer lands.
    const panelContentAnimatedStyle = useAnimatedStyle(() => {
        if (!hasContentGrowIn) return {}

        return {
            opacity: interpolate(
                progress.value,
                PWDRAWER_CONTENT_OPACITY_PROGRESS,
                PWDRAWER_CONTENT_OPACITY_VALUES,
                Extrapolation.CLAMP,
            ),
            transform: [
                {
                    scale: interpolate(
                        progress.value,
                        PWDRAWER_CONTENT_SCALE_PROGRESS,
                        PWDRAWER_CONTENT_SCALE_VALUES,
                        Extrapolation.CLAMP,
                    ),
                },
            ],
        }
    }, [hasContentGrowIn])

    // Lets the open panel be swiped shut without covering it: a mostly-vertical
    // drag fails this pan and reaches the account list, a horizontal one closes.
    // No tap-to-close here — that would make every row press a dismiss.
    const panelDrag = usePWDrawerDrag({
        progress,
        panelWidth,
        onOpen,
        onClose,
        isEnabled: isSwipeEnabled && isOpen,
    })

    return (
        <PWView style={styles.host}>
            <GestureDetector gesture={panelDrag}>
                <Animated.View
                    style={[styles.panel, panelAnimatedStyle]}
                    accessibilityElementsHidden={!isOpen}
                    importantForAccessibility={
                        isOpen ? 'auto' : 'no-hide-descendants'
                    }
                    testID='pw_drawer_panel'
                >
                    <Animated.View
                        style={[styles.panelContent, panelContentAnimatedStyle]}
                    >
                        {renderContent()}
                    </Animated.View>
                </Animated.View>
            </GestureDetector>

            <Animated.View
                style={[
                    styles.content,
                    hasEdgeShadow && styles.contentShadow,
                    contentStyle,
                    contentAnimatedStyle,
                ]}
                accessibilityElementsHidden={isOpen}
                importantForAccessibility={
                    isOpen ? 'no-hide-descendants' : 'auto'
                }
                testID='pw_drawer_content'
            >
                {children}
                <Animated.View
                    style={[styles.scrim, scrimAnimatedStyle]}
                    pointerEvents='none'
                />
            </Animated.View>

            {/* When something else owns the opening drag, the closed-state edge
                strip would be a second gesture competing with it, so the surface
                only appears once open — where it is purely a dismiss affordance. */}
            {isSwipeEnabled && (hasOwnOpenGesture || isOpen) && (
                <PWDrawerGestureSurface
                    progress={progress}
                    panelWidth={panelWidth}
                    isOpen={isOpen}
                    onOpen={onOpen}
                    onClose={onClose}
                    edgeWidth={edgeWidth}
                />
            )}
        </PWView>
    )
}
