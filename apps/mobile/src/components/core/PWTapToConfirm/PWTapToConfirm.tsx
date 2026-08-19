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

import type { StyleProp, ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import LottieView from 'lottie-react-native'
import { PWIcon } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import peraTransactionLoading from '@assets/animations/pera-transaction-loading.json'
import { useStyles } from './styles'
import { usePWTapToConfirm } from './usePWTapToConfirm'

export type PWTapToConfirmProps = {
    title: string
    /** Shown while armed, i.e. after the first tap while waiting for the confirming second tap. */
    armedTitle: string
    onConfirm: () => void
    isLoading?: boolean
    isConfirmed?: boolean
    isDisabled?: boolean
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const PWTapToConfirm = ({
    title,
    armedTitle,
    onConfirm,
    isLoading = false,
    isConfirmed = false,
    isDisabled = false,
    style,
    testID,
}: PWTapToConfirmProps) => {
    const styles = useStyles({ isDisabled })

    const {
        handlePress,
        rootAnimatedStyle,
        idleLabelStyle,
        armedLabelStyle,
        idleContentStyle,
        loadingContentStyle,
        confirmedContentStyle,
    } = usePWTapToConfirm({ onConfirm, isLoading, isDisabled, isConfirmed })

    return (
        <PWTouchableOpacity
            style={[styles.root, style]}
            onPress={handlePress}
            disabled={isDisabled || isLoading || isConfirmed}
            // The second tap of a quick double-tap must land; the arm/confirm
            // steps provide their own accidental-tap protection.
            allowRapidPress
            testID={testID}
        >
            <Animated.View
                style={[styles.background, rootAnimatedStyle]}
                pointerEvents='none'
            />
            <Animated.View
                style={[styles.fillLayer, idleContentStyle]}
                pointerEvents='none'
            >
                <Animated.View
                    style={[styles.labelLayer, idleLabelStyle]}
                    pointerEvents='none'
                >
                    <PWText
                        variant='body'
                        style={styles.labelText}
                        truncate
                    >
                        {title}
                    </PWText>
                </Animated.View>
                <Animated.View
                    style={[styles.labelLayer, armedLabelStyle]}
                    pointerEvents='none'
                >
                    <PWText
                        variant='body'
                        style={styles.armedLabelText}
                        truncate
                    >
                        {armedTitle}
                    </PWText>
                </Animated.View>
            </Animated.View>

            <Animated.View
                style={[styles.fillLayer, loadingContentStyle]}
                pointerEvents='none'
            >
                <LottieView
                    autoPlay
                    loop
                    source={peraTransactionLoading}
                    style={styles.lottie}
                    testID='pw-tap-to-confirm-lottie'
                />
            </Animated.View>

            <Animated.View
                style={[styles.fillLayer, confirmedContentStyle]}
                pointerEvents='none'
            >
                <PWIcon
                    name='check'
                    variant='white'
                    size='md'
                    testID='pw-tap-to-confirm-check'
                />
            </Animated.View>
        </PWTouchableOpacity>
    )
}
