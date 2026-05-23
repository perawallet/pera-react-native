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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { render } from '@test-utils/render'
import { PWFlatList } from '../PWFlatList'

let capturedProps: Record<string, unknown> = {}

vi.mock('@legendapp/list', () => ({
    LegendList: (props: Record<string, unknown>) => {
        capturedProps = props
        return null
    },
}))

vi.mock('@gorhom/bottom-sheet', () => ({
    useBottomSheetScrollableCreator: () => undefined,
}))

const flattenedStyle = (): ViewStyle =>
    (StyleSheet.flatten(capturedProps.style as ViewStyle) ?? {}) as ViewStyle

describe('PWFlatList', () => {
    beforeEach(() => {
        capturedProps = {}
    })

    it('fills its parent by default so a vertical list can scroll', () => {
        render(
            <PWFlatList
                data={[]}
                renderItem={() => null}
            />,
        )

        expect(flattenedStyle().flex).toBe(1)
    })

    it('does not force flex on a horizontal list', () => {
        render(
            <PWFlatList
                horizontal
                data={[]}
                renderItem={() => null}
            />,
        )

        expect(flattenedStyle().flex).toBeUndefined()
    })

    it('does not force flex when scrolling is disabled', () => {
        render(
            <PWFlatList
                scrollEnabled={false}
                data={[]}
                renderItem={() => null}
            />,
        )

        expect(flattenedStyle().flex).toBeUndefined()
    })

    it('does not force flex on a bottom-sheet list', () => {
        render(
            <PWFlatList
                inBottomSheet
                data={[]}
                renderItem={() => null}
            />,
        )

        expect(flattenedStyle().flex).toBeUndefined()
    })

    it('keeps a caller-provided style alongside the fill', () => {
        render(
            <PWFlatList
                data={[]}
                renderItem={() => null}
                style={{ marginTop: 8 }}
            />,
        )

        const style = flattenedStyle()
        expect(style.flex).toBe(1)
        expect(style.marginTop).toBe(8)
    })
})
