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

import { useCallback, useEffect } from 'react'
import type { LayoutChangeEvent, ViewStyle } from 'react-native'
import { useTheme } from '@rneui/themed'
import { Gesture } from 'react-native-gesture-handler'
import {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type AnimatedStyle,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { SLIDE_TO_CONFIRM_ANIMATION_DURATION } from '@constants/ui'

const COMPLETE_THRESHOLD_RATIO = 0.9

type UsePWSlideToConfirmParams = {
    onConfirm: () => void
    thumbSize: number
    trackInset: number
    isLoading: boolean
    isDisabled: boolean
    isConfirmed: boolean
}

type UsePWSlideToConfirmResult = {
    panGesture: ReturnType<typeof Gesture.Pan>
    thumbAnimatedStyle: AnimatedStyle<ViewStyle>
    fillAnimatedStyle: AnimatedStyle<ViewStyle>
    labelOverlayClipStyle: AnimatedStyle<ViewStyle>
    labelOverlayInnerStyle: AnimatedStyle<ViewStyle>
    rootAnimatedStyle: AnimatedStyle<ViewStyle>
    idleContentStyle: AnimatedStyle<ViewStyle>
    loadingContentStyle: AnimatedStyle<ViewStyle>
    confirmedContentStyle: AnimatedStyle<ViewStyle>
    onTrackLayout: (event: LayoutChangeEvent) => void
}

const getPhaseTarget = (isLoading: boolean, isConfirmed: boolean): number => {
    if (isConfirmed) return 2
    if (isLoading) return 1
    return 0
}

export const usePWSlideToConfirm = ({
    onConfirm,
    thumbSize,
    trackInset,
    isLoading,
    isDisabled,
    isConfirmed,
}: UsePWSlideToConfirmParams): UsePWSlideToConfirmResult => {
    const { theme } = useTheme()
    const translateX = useSharedValue(0)
    const trackWidth = useSharedValue(0)
    const startX = useSharedValue(0)
    const phase = useSharedValue(getPhaseTarget(isLoading, isConfirmed))

    useEffect(() => {
        phase.value = withTiming(getPhaseTarget(isLoading, isConfirmed), {
            duration: SLIDE_TO_CONFIRM_ANIMATION_DURATION,
        })
    }, [isLoading, isConfirmed, phase])

    useEffect(() => {
        if (!isLoading && !isConfirmed) {
            translateX.value = withTiming(0, {
                duration: SLIDE_TO_CONFIRM_ANIMATION_DURATION,
            })
        }
    }, [isLoading, isConfirmed, translateX])

    const onTrackLayout = useCallback(
        (event: LayoutChangeEvent) => {
            trackWidth.value = event.nativeEvent.layout.width
        },
        [trackWidth],
    )

    const panGesture = Gesture.Pan()
        .enabled(!isLoading && !isDisabled && !isConfirmed)
        .onStart(() => {
            startX.value = translateX.value
        })
        .onUpdate(event => {
            const maxOffset = Math.max(
                0,
                trackWidth.value - thumbSize - trackInset * 2,
            )
            const next = startX.value + event.translationX
            translateX.value = Math.min(Math.max(0, next), maxOffset)
        })
        .onEnd(() => {
            const maxOffset = Math.max(
                0,
                trackWidth.value - thumbSize - trackInset * 2,
            )
            const threshold = maxOffset * COMPLETE_THRESHOLD_RATIO

            if (translateX.value >= threshold && maxOffset > 0) {
                translateX.value = withTiming(
                    maxOffset,
                    { duration: SLIDE_TO_CONFIRM_ANIMATION_DURATION },
                    finished => {
                        if (finished) {
                            scheduleOnRN(onConfirm)
                        }
                    },
                )
            } else {
                translateX.value = withTiming(0, {
                    duration: SLIDE_TO_CONFIRM_ANIMATION_DURATION,
                })
            }
        })

    const thumbAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }))

    const fillAnimatedStyle = useAnimatedStyle(() => ({
        width: translateX.value + thumbSize,
    }))

    const labelOverlayClipStyle = useAnimatedStyle(() => ({
        width: translateX.value + thumbSize + trackInset,
    }))

    const labelOverlayInnerStyle = useAnimatedStyle(() => ({
        width: trackWidth.value,
    }))

    const idleColor = theme.colors.layerGrayLighter
    const loadingColor = theme.colors.buttonHelperPeraIcon
    const confirmedColor = theme.colors.positive

    const rootAnimatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            phase.value,
            [0, 1, 2],
            [idleColor, loadingColor, confirmedColor],
        ),
    }))

    const idleContentStyle = useAnimatedStyle(() => ({
        opacity: 1 - Math.min(Math.max(phase.value, 0), 1),
    }))

    const loadingContentStyle = useAnimatedStyle(() => ({
        opacity:
            phase.value <= 1
                ? Math.max(0, phase.value)
                : Math.max(0, 2 - phase.value),
    }))

    const confirmedContentStyle = useAnimatedStyle(() => ({
        opacity: Math.max(0, phase.value - 1),
    }))

    return {
        panGesture,
        thumbAnimatedStyle,
        fillAnimatedStyle,
        labelOverlayClipStyle,
        labelOverlayInnerStyle,
        rootAnimatedStyle,
        idleContentStyle,
        loadingContentStyle,
        confirmedContentStyle,
        onTrackLayout,
    }
}
