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
import { type ViewStyle } from 'react-native'
import {
    type AnimatedStyle,
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { useNetworkStatus, useOfflineFeedbackStore } from '@modules/network'
import { useLanguage } from '@hooks/useLanguage'
import {
    OFFLINE_BANNER_COLLAPSE_MS,
    OFFLINE_BANNER_COLLAPSE_TRANSLATE,
    OFFLINE_BANNER_ENTER_MS,
    OFFLINE_BANNER_ENTER_TRANSLATE,
    OFFLINE_BANNER_EXPANDED_MS,
    OFFLINE_BANNER_REEXPANDED_MS,
    OFFLINE_RECONNECT_DISPLAY_MS,
} from '@constants/ui'

type OfflineBannerMode = 'offline' | 'reconnected'

type UseOfflineBannerResult = {
    isVisible: boolean
    mode: OfflineBannerMode
    label: string
    description: string
    isExpanded: boolean
    isExplanationRendered: boolean
    entryAnimatedStyle: AnimatedStyle<ViewStyle>
    explanationAnimatedStyle: AnimatedStyle<ViewStyle>
}

export const useOfflineBanner = (): UseOfflineBannerResult => {
    const { hasInternet } = useNetworkStatus()
    const { t } = useLanguage()
    const emphasisNonce = useOfflineFeedbackStore(state => state.emphasisNonce)
    const [isReconnectedVisible, setIsReconnectedVisible] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    // Kept mounted through the collapse animation so the fade-out is visible.
    const [isExplanationRendered, setIsExplanationRendered] =
        useState(isExpanded)
    const previousHasInternet = useRef(hasInternet)
    const previousEmphasisNonce = useRef(emphasisNonce)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const entryProgress = useSharedValue(0)
    const expandProgress = useSharedValue(0)

    const isVisible = !hasInternet || isReconnectedVisible

    const clearCollapseTimer = useCallback(() => {
        if (collapseTimerRef.current) {
            clearTimeout(collapseTimerRef.current)
            collapseTimerRef.current = null
        }
    }, [])

    const expandFor = useCallback(
        (durationMs: number) => {
            clearCollapseTimer()
            setIsExpanded(true)
            collapseTimerRef.current = setTimeout(() => {
                setIsExpanded(false)
                collapseTimerRef.current = null
            }, durationMs)
        },
        [clearCollapseTimer],
    )

    useEffect(() => {
        const wasOffline = previousHasInternet.current === false
        previousHasInternet.current = hasInternet

        const clearTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }

        if (!hasInternet) {
            // Offline again — kill any pending reconnect dismissal.
            clearTimer()
            setIsReconnectedVisible(false)
            expandFor(OFFLINE_BANNER_EXPANDED_MS)
            return
        }

        // The reconnected pill never carries the explanation.
        clearCollapseTimer()
        setIsExpanded(false)

        if (wasOffline) {
            setIsReconnectedVisible(true)
            clearTimer()
            timerRef.current = setTimeout(() => {
                setIsReconnectedVisible(false)
                timerRef.current = null
            }, OFFLINE_RECONNECT_DISPLAY_MS)
        }
    }, [hasInternet, expandFor, clearCollapseTimer])

    useEffect(() => {
        if (emphasisNonce === previousEmphasisNonce.current) return
        previousEmphasisNonce.current = emphasisNonce
        if (hasInternet) return

        expandFor(OFFLINE_BANNER_REEXPANDED_MS)
    }, [emphasisNonce, hasInternet, expandFor])

    useEffect(() => {
        if (!isVisible) {
            // Reset so the next appearance replays the entry animation.
            entryProgress.value = 0
            return
        }
        entryProgress.value = withTiming(1, {
            duration: OFFLINE_BANNER_ENTER_MS,
            easing: Easing.out(Easing.cubic),
        })
    }, [isVisible, entryProgress])

    useEffect(() => {
        if (isExpanded) {
            setIsExplanationRendered(true)
            expandProgress.value = withTiming(1, {
                duration: OFFLINE_BANNER_COLLAPSE_MS,
            })
            return
        }

        expandProgress.value = withTiming(0, {
            duration: OFFLINE_BANNER_COLLAPSE_MS,
        })
        const unmountTimer = setTimeout(
            () => setIsExplanationRendered(false),
            OFFLINE_BANNER_COLLAPSE_MS,
        )
        return () => clearTimeout(unmountTimer)
    }, [isExpanded, expandProgress])

    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            if (collapseTimerRef.current) {
                clearTimeout(collapseTimerRef.current)
            }
        },
        [],
    )

    const entryAnimatedStyle = useAnimatedStyle(() => ({
        opacity: entryProgress.value,
        transform: [
            {
                translateY: interpolate(
                    entryProgress.value,
                    [0, 1],
                    [-OFFLINE_BANNER_ENTER_TRANSLATE, 0],
                ),
            },
        ],
    }))

    const explanationAnimatedStyle = useAnimatedStyle(() => ({
        opacity: expandProgress.value,
        transform: [
            {
                translateY: interpolate(
                    expandProgress.value,
                    [0, 1],
                    [-OFFLINE_BANNER_COLLAPSE_TRANSLATE, 0],
                ),
            },
        ],
    }))

    const mode: OfflineBannerMode = hasInternet ? 'reconnected' : 'offline'
    const label =
        mode === 'offline' ? t('common.offline_mode') : t('common.back_online')
    const description = t('common.offline_mode_description')

    return {
        isVisible,
        mode,
        label,
        description,
        isExpanded,
        isExplanationRendered,
        entryAnimatedStyle,
        explanationAnimatedStyle,
    }
}
