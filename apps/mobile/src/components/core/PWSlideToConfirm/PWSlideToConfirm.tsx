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

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import LottieView from 'lottie-react-native'
import { PWIcon } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import peraTransactionLoading from '@assets/animations/pera-transaction-loading.json'
import { getTestProps } from '@utils/test-id-helper'
import { THUMB_SIZE, TRACK_INSET, useStyles } from './styles'
import { usePWSlideToConfirm } from './usePWSlideToConfirm'

export type PWSlideToConfirmProps = {
    title: string
    onConfirm: () => void
    isLoading?: boolean
    isConfirmed?: boolean
    isDisabled?: boolean
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const PWSlideToConfirm = ({
    title,
    onConfirm,
    isLoading = false,
    isConfirmed = false,
    isDisabled = false,
    style,
    testID,
}: PWSlideToConfirmProps) => {
    const styles = useStyles({ isDisabled })

    const {
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
    } = usePWSlideToConfirm({
        onConfirm,
        thumbSize: THUMB_SIZE,
        trackInset: TRACK_INSET,
        isLoading,
        isDisabled,
        isConfirmed,
    })

    const isIdleInactive = isLoading || isConfirmed

    return (
        <View
            style={[styles.root, style]}
            onLayout={onTrackLayout}
            {...getTestProps(testID)}
        >
            <Animated.View
                style={[styles.background, rootAnimatedStyle]}
                pointerEvents='none'
            />
            <Animated.View
                style={[styles.idleLayer, idleContentStyle]}
                pointerEvents={isIdleInactive ? 'none' : 'auto'}
            >
                <Animated.View
                    style={[styles.fill, fillAnimatedStyle]}
                    pointerEvents='none'
                />
                <View
                    style={styles.label}
                    pointerEvents='none'
                >
                    <PWText
                        variant='body'
                        style={styles.labelTextBase}
                        truncate
                    >
                        {title}
                    </PWText>
                </View>
                <Animated.View
                    style={[styles.labelOverlayClip, labelOverlayClipStyle]}
                    pointerEvents='none'
                >
                    <Animated.View
                        style={[
                            styles.labelOverlayInner,
                            labelOverlayInnerStyle,
                        ]}
                    >
                        <PWText
                            variant='body'
                            style={styles.labelTextOverlay}
                            truncate
                        >
                            {title}
                        </PWText>
                    </Animated.View>
                </Animated.View>
                <GestureDetector gesture={panGesture}>
                    <Animated.View
                        style={[styles.thumb, thumbAnimatedStyle]}
                        {...getTestProps(testID, 'thumb')}
                    >
                        <PWIcon
                            name='chevron-right'
                            variant='buttonPrimary'
                            size='md'
                        />
                    </Animated.View>
                </GestureDetector>
            </Animated.View>

            <Animated.View
                style={[styles.centerLayer, loadingContentStyle]}
                pointerEvents='none'
            >
                <LottieView
                    autoPlay
                    loop
                    source={peraTransactionLoading}
                    style={styles.lottie}
                    testID='pw-slide-to-confirm-lottie'
                />
            </Animated.View>

            <Animated.View
                style={[styles.centerLayer, confirmedContentStyle]}
                pointerEvents='none'
            >
                <PWIcon
                    name='check'
                    variant='white'
                    size='md'
                    testID='pw-slide-to-confirm-check'
                />
            </Animated.View>
        </View>
    )
}
