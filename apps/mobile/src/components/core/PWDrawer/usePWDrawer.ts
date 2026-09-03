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
import { useWindowDimensions, type ViewStyle } from 'react-native'
import {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    type AnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated'

import {
    PWDRAWER_CONTENT_OPACITY_PROGRESS,
    PWDRAWER_CONTENT_OPACITY_VALUES,
    PWDRAWER_CONTENT_SCALE_PROGRESS,
    PWDRAWER_CONTENT_SCALE_VALUES,
    PWDRAWER_SPRING_CONFIG,
} from './constants'
import { useStyles } from './styles'
import { type PWDrawerProps } from './types'
import { usePWDrawerDrag } from './usePWDrawerDrag'

export type UsePWDrawerParams = Required<
    Pick<
        PWDrawerProps,
        | 'isOpen'
        | 'onOpen'
        | 'onClose'
        | 'variant'
        | 'isSwipeEnabled'
        | 'widthRatio'
        | 'hasContentGrowIn'
        | 'hasOwnOpenGesture'
    >
> &
    Pick<PWDrawerProps, 'progress'>

export type UsePWDrawerResult = {
    panelWidth: number
    progress: SharedValue<number>
    styles: ReturnType<typeof useStyles>
    panelDrag: ReturnType<typeof usePWDrawerDrag>
    hasGestureSurface: boolean
    panelAnimatedStyle: AnimatedStyle<ViewStyle>
    panelContentAnimatedStyle: AnimatedStyle<ViewStyle>
    contentAnimatedStyle: AnimatedStyle<ViewStyle>
    scrimAnimatedStyle: AnimatedStyle<ViewStyle>
}

export const usePWDrawer = ({
    isOpen,
    onOpen,
    onClose,
    variant,
    progress: externalProgress,
    isSwipeEnabled,
    widthRatio,
    hasContentGrowIn,
    hasOwnOpenGesture,
}: UsePWDrawerParams): UsePWDrawerResult => {
    const { width } = useWindowDimensions()
    const panelWidth = Math.round(width * widthRatio)
    const styles = useStyles({ panelWidth })

    // 0 closed, 1 open. Whoever owns it writes it directly, so a drag tracks the
    // finger on the UI thread. Always created — hooks can't be conditional.
    const ownProgress = useSharedValue(isOpen ? 1 : 0)
    const progress = externalProgress ?? ownProgress
    const isOwnedElsewhere = Boolean(externalProgress)

    // Skipped when an owner drives progress: a gesture settles it carrying the
    // finger's velocity, and re-springing from `isOpen` would restart that
    // animation from a standstill partway through.
    useEffect(() => {
        if (isOwnedElsewhere) return

        progress.value = withSpring(isOpen ? 1 : 0, PWDRAWER_SPRING_CONFIG)
    }, [isOpen, progress, isOwnedElsewhere])

    const isBack = variant === 'back'

    const contentAnimatedStyle = useAnimatedStyle(
        () => ({
            transform: [
                { translateX: isBack ? progress.value * panelWidth : 0 },
            ],
        }),
        [isBack, panelWidth],
    )

    const panelAnimatedStyle = useAnimatedStyle(() => {
        if (isBack) return {}

        return {
            transform: [{ translateX: (progress.value - 1) * panelWidth }],
        }
    }, [isBack, panelWidth])

    const scrimAnimatedStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
    }))

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

    // Swipes the open panel shut without covering it: a mostly-vertical drag
    // fails this pan and reaches the account list. No tap-to-close, which would
    // make every row press a dismiss.
    const panelDrag = usePWDrawerDrag({
        progress,
        panelWidth,
        onOpen,
        onClose,
        isEnabled: isSwipeEnabled && isOpen,
    })

    // When something else owns the opening drag, a closed-state edge strip would
    // compete with it — so the surface only appears once open, as a dismiss.
    const hasGestureSurface = isSwipeEnabled && (hasOwnOpenGesture || isOpen)

    return {
        panelWidth,
        progress,
        styles,
        panelDrag,
        hasGestureSurface,
        panelAnimatedStyle,
        panelContentAnimatedStyle,
        contentAnimatedStyle,
        scrimAnimatedStyle,
    }
}
