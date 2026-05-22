/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated'
import type { Banner } from '@perawallet/wallet-core-banners'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { BannerIcon } from '../BannerIcon'
import { useStyles } from './styles'

export type CompactBannerProps = {
    primary: Banner
    additionalCount: number
    onPress: () => void
    testID?: string
}

const getCompactText = (banner: Banner): string =>
    banner.title ?? banner.subtitle ?? banner.buttonLabel ?? ''

// Subtle attention pulse on the text. Dims the text opacity briefly every
// ~10s so the eye is drawn back to the strip without the bar feeling busy.
const PULSE_MIN_OPACITY = 0.6
const PULSE_RAMP_MS = 1000 // each direction; full pulse ≈ 1s
const PULSE_IDLE_MS = 9000 // 9s idle + 0.5s dim + 0.5s back ≈ 10s

export const CompactBanner = ({
    primary,
    additionalCount,
    onPress,
    testID = 'compact_banner',
}: CompactBannerProps) => {
    const styles = useStyles()
    const text = getCompactText(primary)

    const opacity = useSharedValue(1)
    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withDelay(
                    PULSE_IDLE_MS,
                    withTiming(PULSE_MIN_OPACITY, {
                        duration: PULSE_RAMP_MS,
                        easing: Easing.inOut(Easing.quad),
                    }),
                ),
                withTiming(1, { duration: PULSE_RAMP_MS }),
            ),
            -1,
        )
    }, [opacity])
    const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

    return (
        <PWTouchableOpacity
            onPress={onPress}
            testID={testID}
        >
            <PWView style={styles.container}>
                <PWView style={styles.iconTextGroup}>
                    <BannerIcon
                        type={primary.type}
                        size='md'
                        variant='banner'
                    />
                    <Animated.View style={[styles.textWrapper, pulseStyle]}>
                        <PWText
                            style={styles.text}
                            weight={500}
                            numberOfLines={1}
                            ellipsizeMode='tail'
                        >
                            {text}
                        </PWText>
                    </Animated.View>
                </PWView>
                <PWView style={styles.trailing}>
                    {additionalCount > 0 ? (
                        <PWView
                            style={styles.moreBadge}
                            testID='compact_banner_more_badge'
                        >
                            <PWText style={styles.moreBadgeText}>
                                {`+${additionalCount}`}
                            </PWText>
                        </PWView>
                    ) : null}
                    <PWIcon
                        name='chevron-right'
                        size='md'
                        variant='banner'
                    />
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
