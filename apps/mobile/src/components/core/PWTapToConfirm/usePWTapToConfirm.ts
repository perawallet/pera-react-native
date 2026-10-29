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
    Easing,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type AnimatedStyle,
} from 'react-native-reanimated'
import { TAP_TO_CONFIRM_ANIMATION_DURATION } from '@constants/ui'
import type { Nullable } from '@perawallet/wallet-core-shared'

// Matches the disabled root's opacity so the wait reads as "not yet pressable".
const WAITING_LABEL_OPACITY = 0.7

type UsePWTapToConfirmParams = {
    onConfirm: () => void
    isLoading: boolean
    isDisabled: boolean
    isConfirmed: boolean
    minConfirmDelayMs: number
    armedTimeoutMs: number
}

type UsePWTapToConfirmResult = {
    handlePress: () => void
    isWaiting: boolean
    rootAnimatedStyle: AnimatedStyle<ViewStyle>
    waitFillStyle: AnimatedStyle<ViewStyle>
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
    minConfirmDelayMs,
    armedTimeoutMs,
}: UsePWTapToConfirmParams): UsePWTapToConfirmResult => {
    const { theme } = useTheme()
    const [isArmed, setIsArmed] = useState(false)
    const [isWaiting, setIsWaiting] = useState(false)
    // Mirrors `isArmed` so handlePress can read it synchronously. The
    // confirming tap of a quick double-tap routinely lands before React has
    // committed the arming tap's render, and a handler closing over the state
    // value still sees `false` there — so it re-arms instead of confirming and
    // the action silently never fires. `allowRapidPress` on the Pressable is
    // what lets that second tap through in the first place.
    const isArmedRef = useRef(false)
    const lastTapAtRef = useRef(0)
    const disarmTimerRef = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const readyTimerRef = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const armedProgress = useSharedValue(0)
    const waitProgress = useSharedValue(0)
    const fillProgress = useSharedValue(0)
    const phase = useSharedValue(getPhaseTarget(isLoading, isConfirmed))

    const setArmed = useCallback((next: boolean) => {
        isArmedRef.current = next
        setIsArmed(next)
    }, [])

    const clearTimers = useCallback(() => {
        if (disarmTimerRef.current) {
            clearTimeout(disarmTimerRef.current)
            disarmTimerRef.current = null
        }
        if (readyTimerRef.current) {
            clearTimeout(readyTimerRef.current)
            readyTimerRef.current = null
        }
    }, [])

    const disarm = useCallback(() => {
        clearTimers()
        setArmed(false)
        setIsWaiting(false)
    }, [clearTimers, setArmed])

    // Both the wait and the armed timeout run from the latest tap.
    const restartWait = useCallback(() => {
        clearTimers()
        lastTapAtRef.current = Date.now()
        disarmTimerRef.current = setTimeout(disarm, armedTimeoutMs)
        if (minConfirmDelayMs <= 0) return

        setIsWaiting(true)
        readyTimerRef.current = setTimeout(
            () => setIsWaiting(false),
            minConfirmDelayMs,
        )
        fillProgress.value = 0
        fillProgress.value = withTiming(1, {
            duration: minConfirmDelayMs,
            easing: Easing.linear,
        })
    }, [clearTimers, disarm, armedTimeoutMs, minConfirmDelayMs, fillProgress])

    useEffect(() => clearTimers, [clearTimers])

    useEffect(() => {
        if (isLoading || isDisabled || isConfirmed) disarm()
    }, [isLoading, isDisabled, isConfirmed, disarm])

    useEffect(() => {
        armedProgress.value = withTiming(isArmed ? 1 : 0, {
            duration: TAP_TO_CONFIRM_ANIMATION_DURATION,
        })
    }, [isArmed, armedProgress])

    useEffect(() => {
        waitProgress.value = isWaiting ? 1 : 0
    }, [isWaiting, waitProgress])

    useEffect(() => {
        phase.value = withTiming(getPhaseTarget(isLoading, isConfirmed), {
            duration: TAP_TO_CONFIRM_ANIMATION_DURATION,
        })
    }, [isLoading, isConfirmed, phase])

    const handlePress = useCallback(() => {
        if (isLoading || isDisabled || isConfirmed) return

        if (!isArmedRef.current) {
            setArmed(true)
            restartWait()
            return
        }

        // A tap inside the wait restarts it rather than confirming, so a
        // rapid burst (e.g. a page-baited multi-click) can never sign: only a
        // tap that follows a real pause does.
        if (Date.now() - lastTapAtRef.current < minConfirmDelayMs) {
            restartWait()
            return
        }

        disarm()
        onConfirm()
    }, [
        isLoading,
        isDisabled,
        isConfirmed,
        onConfirm,
        minConfirmDelayMs,
        restartWait,
        disarm,
        setArmed,
    ])

    const idleColor = isDisabled
        ? theme.colors.buttonPrimaryDisabledBg
        : theme.colors.buttonPrimaryBg
    const armedColor = theme.colors.buttonHelperPeraIcon
    const loadingColor = theme.colors.buttonHelperPeraIcon
    const confirmedColor = theme.colors.positive
    const waitingColor = theme.colors.buttonPrimaryDisabledBg

    const rootAnimatedStyle = useAnimatedStyle(() => {
        const restingColor = interpolateColor(
            waitProgress.value,
            [0, 1],
            [
                interpolateColor(
                    armedProgress.value,
                    [0, 1],
                    [idleColor, armedColor],
                ),
                waitingColor,
            ],
        )
        return {
            backgroundColor: interpolateColor(
                phase.value,
                [0, 1, 2],
                [restingColor, loadingColor, confirmedColor],
            ),
        }
    })

    const waitFillStyle = useAnimatedStyle(() => ({
        width: `${fillProgress.value * 100}%`,
        backgroundColor: armedColor,
        opacity: waitProgress.value,
    }))

    const idleLabelStyle = useAnimatedStyle(() => ({
        opacity: 1 - armedProgress.value,
    }))

    const armedLabelStyle = useAnimatedStyle(() => ({
        opacity:
            armedProgress.value *
            (1 - (1 - WAITING_LABEL_OPACITY) * waitProgress.value),
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
        isWaiting,
        rootAnimatedStyle,
        waitFillStyle,
        idleLabelStyle,
        armedLabelStyle,
        idleContentStyle,
        loadingContentStyle,
        confirmedContentStyle,
    }
}
