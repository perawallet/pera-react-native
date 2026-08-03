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
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWText, PWView } from '@components/core'
import { OFFLINE_BANNER_FADE_MS } from '@constants/ui'
import { useOfflineBanner } from './useOfflineBanner'
import { useStyles } from './styles'

export const OfflineBanner = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { isVisible, mode, label, isEmphasized } = useOfflineBanner()
    const opacity = useSharedValue(0)
    const scale = useSharedValue(1)

    useEffect(() => {
        opacity.value = withTiming(1, { duration: OFFLINE_BANNER_FADE_MS })
    }, [opacity])

    useEffect(() => {
        if (!isEmphasized) return

        scale.value = withSequence(
            withTiming(1.08, { duration: OFFLINE_BANNER_FADE_MS }),
            withTiming(1, { duration: OFFLINE_BANNER_FADE_MS }),
        )
    }, [isEmphasized, scale])

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }))

    if (!isVisible) return null

    const isReconnected = mode === 'reconnected'

    return (
        <PWView
            style={styles.container}
            pointerEvents='box-none'
        >
            <Animated.View style={animatedStyle}>
                <PWView
                    style={[
                        styles.banner,
                        isReconnected && styles.bannerReconnected,
                    ]}
                    pointerEvents='none'
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
            </Animated.View>
        </PWView>
    )
}
