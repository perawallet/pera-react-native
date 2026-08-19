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

import { useEffect, useState } from 'react'
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWText, PWView } from '@components/core'
import {
    OFFLINE_BANNER_COLLAPSE_MS,
    OFFLINE_BANNER_COLLAPSE_TRANSLATE,
    OFFLINE_BANNER_ENTER_MS,
    OFFLINE_BANNER_ENTER_TRANSLATE,
} from '@constants/ui'
import { useOfflineBanner } from './useOfflineBanner'
import { useStyles } from './styles'

export const OfflineBanner = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { isVisible, mode, label, description, isExpanded } =
        useOfflineBanner()
    const entryProgress = useSharedValue(0)
    const expandProgress = useSharedValue(0)
    // Kept mounted through the collapse animation so the fade-out is visible.
    const [isExplanationRendered, setIsExplanationRendered] =
        useState(isExpanded)

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
        const timer = setTimeout(
            () => setIsExplanationRendered(false),
            OFFLINE_BANNER_COLLAPSE_MS,
        )
        return () => clearTimeout(timer)
    }, [isExpanded, expandProgress])

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

    if (!isVisible) return null

    const isReconnected = mode === 'reconnected'

    return (
        <PWView
            style={styles.container}
            pointerEvents='box-none'
        >
            <Animated.View
                style={[styles.stack, entryAnimatedStyle]}
                pointerEvents='none'
            >
                <PWView
                    style={[
                        styles.banner,
                        isReconnected && styles.bannerReconnected,
                    ]}
                >
                    <PWText
                        style={[
                            styles.text,
                            isReconnected && styles.textReconnected,
                        ]}
                    >
                        {label}
                    </PWText>
                </PWView>
                {isExplanationRendered && !isReconnected && (
                    <Animated.View style={explanationAnimatedStyle}>
                        <PWView style={styles.explanation}>
                            <PWText style={styles.explanationText}>
                                {description}
                            </PWText>
                        </PWView>
                    </Animated.View>
                )}
            </Animated.View>
        </PWView>
    )
}
