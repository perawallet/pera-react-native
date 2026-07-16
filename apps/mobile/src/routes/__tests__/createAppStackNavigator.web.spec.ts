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

import { describe, expect, it } from 'vitest'
import { SCREEN_ANIMATION_DURATION_MS } from '@constants/ui'
import {
    createAppStackNavigator,
    resolveWebScreenOptions,
} from '../createAppStackNavigator.web'

describe('resolveWebScreenOptions', () => {
    it('applies the web slide default when the caller sets no animation', () => {
        const options = resolveWebScreenOptions(undefined)

        expect(options.animation).toBe('slide_from_right')
    })

    it('uses the app 150ms duration in the transition spec', () => {
        const options = resolveWebScreenOptions(undefined)

        expect(options.transitionSpec?.open).toEqual({
            animation: 'timing',
            config: { duration: SCREEN_ANIMATION_DURATION_MS },
        })
        expect(options.transitionSpec?.close).toEqual({
            animation: 'timing',
            config: { duration: SCREEN_ANIMATION_DURATION_MS },
        })
    })

    it('merges caller options over the defaults', () => {
        const header = () => null
        const options = resolveWebScreenOptions({
            headerShown: true,
            header,
        })

        expect(options.headerShown).toBe(true)
        expect(options.header).toBe(header)
    })

    it('remaps native-stack contentStyle to the JS stack cardStyle', () => {
        const contentStyle = { backgroundColor: 'red' }
        const options = resolveWebScreenOptions({ contentStyle })

        expect(options.cardStyle).toBe(contentStyle)
        expect('contentStyle' in options).toBe(false)
    })

    it('bounds the card to flex:1 by default so it does not content-hug', () => {
        // Web CardContent's page box defaults to minHeight:'100%' (content
        // hugging); flex:1 bounds the card to its parent's definite height
        // so inner scroll views can overflow and scroll in the fixed popup.
        const options = resolveWebScreenOptions(undefined)

        expect(options.cardStyle).toEqual({ flex: 1 })
    })

    it('drops the native-stack animation value so the web slide wins', () => {
        // native-stack `animation: 'default'` resolves to a scale on web; the
        // factory must ignore it and keep the slide.
        const options = resolveWebScreenOptions({ animation: 'default' })

        expect(options.animation).toBe('slide_from_right')
    })
})

describe('createAppStackNavigator', () => {
    it('returns a fresh navigator with the expected shape per call', () => {
        const first = createAppStackNavigator()
        const second = createAppStackNavigator()

        expect(first.Navigator).toBeTypeOf('function')
        expect(first.Screen).toBeTypeOf('function')
        expect(first).not.toBe(second)
    })
})
