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
        labelAnimatedStyle,
        onTrackLayout,
    } = usePWSlideToConfirm({
        onConfirm,
        thumbSize: THUMB_SIZE,
        trackInset: TRACK_INSET,
        isLoading,
        isDisabled,
        isConfirmed,
    })

    if (isConfirmed) {
        return (
            <View
                style={[styles.confirmedPill, style]}
                {...getTestProps(testID)}
            >
                <PWIcon
                    name='check'
                    variant='white'
                    size='md'
                    testID='pw-slide-to-confirm-check'
                />
            </View>
        )
    }

    if (isLoading) {
        return (
            <View
                style={[styles.loadingPill, style]}
                {...getTestProps(testID)}
            >
                <LottieView
                    autoPlay
                    loop
                    source={peraTransactionLoading}
                    style={styles.lottie}
                    testID='pw-slide-to-confirm-lottie'
                />
            </View>
        )
    }

    return (
        <View
            style={[styles.track, style]}
            onLayout={onTrackLayout}
            {...getTestProps(testID)}
        >
            <Animated.View
                style={[styles.fill, fillAnimatedStyle]}
                pointerEvents='none'
            />
            <Animated.View
                style={[styles.label, labelAnimatedStyle]}
                pointerEvents='none'
            >
                <PWText
                    variant='body'
                    style={styles.labelText}
                >
                    {title}
                </PWText>
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
        </View>
    )
}
