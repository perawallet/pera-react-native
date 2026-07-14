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

import React from 'react'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { PWImage } from '@components/core'
import { useZoomableImage } from './useZoomableImage'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'

export type ZoomableImageProps = {
    uri: string
}

export const ZoomableImage = ({ uri }: ZoomableImageProps) => {
    const { width, height } = useWindowDimensions()
    const styles = useStyles({ width, height })
    const { gesture, animatedStyle } = useZoomableImage()

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.container, animatedStyle]}>
                <PWImage
                    source={{ uri }}
                    style={styles.image}
                    resizeMode='contain'
                />
            </Animated.View>
        </GestureDetector>
    )
}
