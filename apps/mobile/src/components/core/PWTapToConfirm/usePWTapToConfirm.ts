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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ViewStyle } from 'react-native'
import { useTheme } from '@rneui/themed'
import {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type AnimatedStyle,
} from 'react-native-reanimated'
import {
    TAP_TO_CONFIRM_ANIMATION_DURATION,
    TAP_TO_CONFIRM_ARMED_TIMEOUT,
} from '@constants/ui'

type UsePWTapToConfirmParams = {
    onConfirm: () => void
    isLoading: boolean
    isDisabled: boolean
    isConfirmed: boolean
}

type UsePWTapToConfirmResult = {
    handlePress: () => void
    rootAnimatedStyle: AnimatedStyle<ViewStyle>
    idleLabelStyle: AnimatedStyle<ViewStyle>
    armedLabelStyle: AnimatedStyle<ViewStyle>
    idleContentStyle: AnimatedStyle<ViewStyle>
    loadingContentStyle: AnimatedStyle<ViewStyle>
    confirmedContentStyle: AnimatedStyle<ViewStyle>
}

const getPhaseTarget = (isLoading: boolean, isConfirmed: boolean): number => {
    if (isConfirmed) return 2
    if (isLoading) return 1
    return 0
}

export const usePWTapToConfirm = ({
    onConfirm,
    isLoading,
    isDisabled,
    isConfirmed,
}: UsePWTapToConfirmParams): UsePWTapToConfirmResult => {
    const { theme } = useTheme()
    const [isArmed, setIsArmed] = useState(false)
    const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const armedProgress = useSharedValue(0)
    const phase = useSharedValue(getPhaseTarget(isLoading, isConfirmed))

    const clearDisarmTimer = useCallback(() => {
        if (disarmTimerRef.current) {
            clearTimeout(disarmTimerRef.current)
            disarmTimerRef.current = null
        }
    }, [])

    useEffect(() => clearDisarmTimer, [clearDisarmTimer])

    useEffect(() => {
        if (isLoading || isDisabled || isConfirmed) {
            clearDisarmTimer()
            setIsArmed(false)
        }
    }, [isLoading, isDisabled, isConfirmed, clearDisarmTimer])

    useEffect(() => {
        armedProgress.value = withTiming(isArmed ? 1 : 0, {
            duration: TAP_TO_CONFIRM_ANIMATION_DURATION,
        })
    }, [isArmed, armedProgress])

    useEffect(() => {
        phase.value = withTiming(getPhaseTarget(isLoading, isConfirmed), {
            duration: TAP_TO_CONFIRM_ANIMATION_DURATION,
        })
    }, [isLoading, isConfirmed, phase])

    const handlePress = useCallback(() => {
        if (isLoading || isDisabled || isConfirmed) return

        if (isArmed) {
            clearDisarmTimer()
            setIsArmed(false)
            onConfirm()
            return
        }

        setIsArmed(true)
        clearDisarmTimer()
        disarmTimerRef.current = setTimeout(() => {
            setIsArmed(false)
        }, TAP_TO_CONFIRM_ARMED_TIMEOUT)
    }, [
        isLoading,
        isDisabled,
        isConfirmed,
        isArmed,
        onConfirm,
        clearDisarmTimer,
    ])

    const idleColor = isDisabled
        ? theme.colors.buttonPrimaryDisabledBg
        : theme.colors.buttonPrimaryBg
    const armedColor = theme.colors.buttonHelperPeraIcon
    const loadingColor = theme.colors.buttonHelperPeraIcon
    const confirmedColor = theme.colors.positive

    const rootAnimatedStyle = useAnimatedStyle(() => {
        const restingColor = interpolateColor(
            armedProgress.value,
            [0, 1],
            [idleColor, armedColor],
        )
        return {
            backgroundColor: interpolateColor(
                phase.value,
                [0, 1, 2],
                [restingColor, loadingColor, confirmedColor],
            ),
        }
    })

    const idleLabelStyle = useAnimatedStyle(() => ({
        opacity: 1 - armedProgress.value,
    }))

    const armedLabelStyle = useAnimatedStyle(() => ({
        opacity: armedProgress.value,
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
        handlePress,
        rootAnimatedStyle,
        idleLabelStyle,
        armedLabelStyle,
        idleContentStyle,
        loadingContentStyle,
        confirmedContentStyle,
    }
}
