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

import { Gesture } from 'react-native-gesture-handler'
import {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from 'react-native-reanimated'

const MIN_SCALE = 1
const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5

type UseZoomableImageResult = {
    gesture: ReturnType<typeof Gesture.Simultaneous>
    animatedStyle: ReturnType<typeof useAnimatedStyle>
}

export const useZoomableImage = (): UseZoomableImageResult => {
    const scale = useSharedValue(1)
    const savedScale = useSharedValue(1)
    const translateX = useSharedValue(0)
    const translateY = useSharedValue(0)
    const savedTranslateX = useSharedValue(0)
    const savedTranslateY = useSharedValue(0)

    const pinchGesture = Gesture.Pinch()
        .onUpdate(e => {
            scale.value = Math.min(
                MAX_SCALE,
                Math.max(MIN_SCALE, savedScale.value * e.scale),
            )
        })
        .onEnd(() => {
            if (scale.value < MIN_SCALE) {
                scale.value = withTiming(MIN_SCALE)
            }
            savedScale.value = scale.value
        })

    const panGesture = Gesture.Pan()
        .minPointers(1)
        .onUpdate(e => {
            if (savedScale.value > 1) {
                translateX.value = savedTranslateX.value + e.translationX
                translateY.value = savedTranslateY.value + e.translationY
            }
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value
            savedTranslateY.value = translateY.value
        })

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > MIN_SCALE) {
                scale.value = withTiming(MIN_SCALE)
                savedScale.value = MIN_SCALE
                translateX.value = withTiming(0)
                translateY.value = withTiming(0)
                savedTranslateX.value = 0
                savedTranslateY.value = 0
            } else {
                scale.value = withTiming(DOUBLE_TAP_SCALE)
                savedScale.value = DOUBLE_TAP_SCALE
            }
        })

    const gesture = Gesture.Simultaneous(
        pinchGesture,
        panGesture,
        doubleTapGesture,
    )

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }))

    return { gesture, animatedStyle }
}
