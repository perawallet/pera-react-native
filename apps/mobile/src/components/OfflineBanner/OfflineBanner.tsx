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

import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWText, PWView } from '@components/core'
import { useOfflineBanner } from './useOfflineBanner'
import { useStyles } from './styles'

export const OfflineBanner = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const {
        isVisible,
        mode,
        label,
        description,
        isExplanationRendered,
        entryAnimatedStyle,
        explanationAnimatedStyle,
    } = useOfflineBanner()

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
