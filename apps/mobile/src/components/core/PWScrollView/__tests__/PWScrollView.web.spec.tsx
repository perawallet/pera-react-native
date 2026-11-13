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
import { render, screen } from '@test-utils/render'
// Import the exact web filename — vitest has no Metro platform resolution,
// so a bare '../PWScrollView' specifier would load the gorhom-based native
// module instead (PWScrollView.spec.tsx imports '../PWScrollView' directly).
// See PWBottomSheet.web.spec.tsx for the same pattern.
import { PWScrollView, type PWScrollViewRef } from '../PWScrollView.web'

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

describe('PWScrollView.web', () => {
    it('renders children when inBottomSheet is true, without mounting gorhom', () => {
        // This is the exact case that throws "'useBottomSheetInternal'
        // cannot be used out of the BottomSheet!" on the native component,
        // since PWBottomSheet.web.tsx has no real gorhom <BottomSheet>
        // provider. If this twin ever regressed to import
        // BottomSheetScrollView, this render would throw instead of
        // rendering children.
        render(
            <PWScrollView inBottomSheet={true}>
                <Text>Sheet content</Text>
            </PWScrollView>,
        )

        expect(screen.getByText('Sheet content')).toBeTruthy()
    })

    it('renders children outside a bottom sheet', () => {
        render(
            <PWScrollView>
                <Text>Plain content</Text>
            </PWScrollView>,
        )

        expect(screen.getByText('Plain content')).toBeTruthy()
    })

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
