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

import { describe, expect, it, vi } from 'vitest'
import { getWebTabTransition } from '../tab-transitions'
import { SCREEN_ANIMATION_DURATION_MS } from '@constants/ui'

describe('getWebTabTransition', () => {
    it('enables tab animation with a timing spec at the screen duration', () => {
        const transition = getWebTabTransition(360)

        expect(transition.animation).toBe('shift')
        expect(transition.transitionSpec).toEqual({
            animation: 'timing',
            config: { duration: SCREEN_ANIMATION_DURATION_MS },
        })
    })

    it('slides scenes a full viewport width in tab order', () => {
        const interpolate = vi.fn().mockReturnValue('interpolated')
        const progress = { interpolate } as never

        const transition = getWebTabTransition(360)
        const { sceneStyle } = transition.sceneStyleInterpolator!({
            current: { progress },
        })

        expect(interpolate).toHaveBeenCalledWith({
            inputRange: [-1, 0, 1],
            outputRange: [-360, 0, 360],
        })
        expect(sceneStyle).toEqual({
            transform: [{ translateX: 'interpolated' }],
        })
    })
})
