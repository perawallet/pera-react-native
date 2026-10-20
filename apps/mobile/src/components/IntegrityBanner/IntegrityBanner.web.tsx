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
import { PWButton, PWLoadingIndicator, PWText, PWView } from '@components/core'
import { useIntegrityBanner } from './useIntegrityBanner.web'
import { useStyles } from './styles.web'

export const IntegrityBanner = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const {
        isVisible,
        mode,
        label,
        description,
        actionLabel,
        onAction,
        isActionPending,
        isExplanationRendered,
        entryAnimatedStyle,
        explanationAnimatedStyle,
    } = useIntegrityBanner()

    if (!isVisible) return null

    const isRestored = mode === 'restored'

    return (
        <PWView
            style={styles.container}
            pointerEvents='box-none'
        >
            <Animated.View
                style={[styles.stack, entryAnimatedStyle]}
                pointerEvents='box-none'
            >
                <PWView
                    style={[styles.banner, isRestored && styles.bannerRestored]}
                >
                    <PWText
                        style={[styles.text, isRestored && styles.textRestored]}
                    >
                        {label}
                    </PWText>
                    {isActionPending ? (
                        <PWLoadingIndicator />
                    ) : (
                        actionLabel &&
                        onAction && (
                            <PWButton
                                variant='link'
                                title={actionLabel}
                                onPress={onAction}
                            />
                        )
                    )}
                </PWView>
                {isExplanationRendered && description && (
                    <Animated.View
                        style={explanationAnimatedStyle}
                        pointerEvents='none'
                    >
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
