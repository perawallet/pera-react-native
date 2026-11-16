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

import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { render } from '@test-utils/render'
import { PWScrollView, type PWScrollViewRef } from '../PWScrollView'

const scrollTo = vi.hoisted(() => vi.fn())

// The shared unit mock renders ScrollView as a bare div; this one gives the
// ref the scroller handle the component under test delegates to.
vi.mock('react-native-gesture-handler', async () => {
    const React = await import('react')
    return {
        ScrollView: ({
            ref,
            children,
        }: {
            ref?: React.Ref<unknown>
            children?: React.ReactNode
        }) => {
            React.useImperativeHandle(ref, () => ({ scrollTo }))
            return React.createElement('div', null, children)
        },
    }
})

describe('PWScrollView', () => {
    it('delegates scrollTo through the ref to the scroll view', () => {
        const ref = createRef<PWScrollViewRef>()
        render(
            <PWScrollView
                ref={ref}
                horizontal
            >
                <Text>Row</Text>
            </PWScrollView>,
        )

        ref.current?.scrollTo({ x: 40, animated: false })

        expect(scrollTo).toHaveBeenCalledWith({ x: 40, animated: false })
    })
})
