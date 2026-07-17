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

import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs'
import { SCREEN_ANIMATION_DURATION_MS } from '@constants/ui'

type WebTabTransition = Pick<
    BottomTabNavigationOptions,
    'animation' | 'transitionSpec' | 'sceneStyleInterpolator'
>

/**
 * Full-width directional slide for bottom-tab switches on web.
 * `current.progress` is -1 / 0 / +1 for tabs left of / at / right of the
 * active index, so a [-width, width] translate slides scenes toward the
 * selected tab. `animation` must be any non-'none' name to enable the
 * transition driver; the custom interpolator overrides the preset's
 * ±50px shift.
 */
export const getWebTabTransition = (width: number): WebTabTransition => ({
    animation: 'shift',
    transitionSpec: {
        animation: 'timing',
        config: { duration: SCREEN_ANIMATION_DURATION_MS },
    },
    sceneStyleInterpolator: ({ current }) => ({
        sceneStyle: {
            transform: [
                {
                    translateX: current.progress.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [-width, 0, width],
                    }),
                },
            ],
        },
    }),
})
