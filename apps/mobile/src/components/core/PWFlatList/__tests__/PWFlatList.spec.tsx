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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { Text, type ViewStyle } from 'react-native'
import type { FlashListProps } from '@shopify/flash-list'
import { render } from '@test-utils/render'
import { PWFlatList } from '../PWFlatList'
import { PWInBottomSheetContext } from '../../PWBottomSheet/inSheetContext'

// Capture the props the wrapped FlashList receives so we can assert on the
// branching logic (separators, padding, keyboard handling, in-sheet detection).
let capturedProps: FlashListProps<unknown> = {} as FlashListProps<unknown>

const mockScrollableCreator = vi.fn()

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
vi.mock('@shopify/flash-list', () => {
    const React = require('react')
    return {
        FlashList: (props: any) => {
            capturedProps = props
            return React.createElement('div', { 'data-testid': 'FlashList' })
        },
    }
})

vi.mock('@gorhom/bottom-sheet', () => ({
    useBottomSheetScrollableCreator: () => mockScrollableCreator,
}))
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

// The two default separators are distinct named components: the inset row
// divider and the plain card gap. Identify the captured one by component name
// rather than inspecting spacing/color tokens.
const separatorName = (
    Separator: FlashListProps<unknown>['ItemSeparatorComponent'],
): string | undefined =>
    typeof Separator === 'function'
        ? (Separator as { name?: string }).name
        : undefined

// PWFlatList runs StyleSheet.flatten on contentContainerStyle before passing it
// down, so the captured value is a single flattened object at runtime.
const capturedContentStyle = (): ViewStyle =>
    (capturedProps.contentContainerStyle as ViewStyle | undefined) ?? {}

const CustomSeparator = () => <Text>custom-separator</Text>

beforeEach(() => {
    capturedProps = {} as FlashListProps<unknown>
})

describe('PWFlatList', () => {
    it('uses the inset row divider separator for default vertical lists', () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
            />,
        )

        expect(separatorName(capturedProps.ItemSeparatorComponent)).toBe(
            'ListSeparator',
        )
    })

    it('uses the plain gap separator for cardLayout lists', () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
                cardLayout
            />,
        )

        expect(separatorName(capturedProps.ItemSeparatorComponent)).toBe(
            'CardSeparator',
        )
    })

    it('renders flush rows (no separator) when ItemSeparatorComponent is null', () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
                ItemSeparatorComponent={null}
            />,
        )

        expect(capturedProps.ItemSeparatorComponent).toBeNull()
    })

    it('passes a caller-supplied separator through unchanged', () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
                ItemSeparatorComponent={CustomSeparator}
            />,
        )

        expect(capturedProps.ItemSeparatorComponent).toBe(CustomSeparator)
    })

    it('applies no default separator for horizontal lists', () => {
        render(
            <PWFlatList
                horizontal
                data={[1, 2]}
                renderItem={() => null}
            />,
        )

        expect(capturedProps.ItemSeparatorComponent).toBeUndefined()
    })

    it('does not apply vertical content padding for horizontal lists', () => {
        render(
            <PWFlatList
                horizontal
                data={[1, 2]}
                renderItem={() => null}
            />,
        )

        expect(capturedContentStyle().paddingBottom).toBeUndefined()
    })

    it('applies vertical content padding for vertical lists', () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
            />,
        )

        expect(capturedContentStyle().paddingBottom).toBeGreaterThan(0)
    })

    it("defaults keyboardShouldPersistTaps to 'handled'", () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
            />,
        )

        expect(capturedProps.keyboardShouldPersistTaps).toBe('handled')
    })

    it('lets an explicit keyboardShouldPersistTaps override the default', () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
                keyboardShouldPersistTaps='never'
            />,
        )

        expect(capturedProps.keyboardShouldPersistTaps).toBe('never')
    })

    it('does not wire the sheet scrollable when rendered outside a bottom sheet', () => {
        render(
            <PWFlatList
                data={[1, 2]}
                renderItem={() => null}
            />,
        )

        expect(capturedProps.renderScrollComponent).toBeUndefined()
    })

    it('auto-detects a surrounding bottom sheet via context and wires the sheet scrollable', () => {
        render(
            <PWInBottomSheetContext.Provider value={true}>
                <PWFlatList
                    data={[1, 2]}
                    renderItem={() => null}
                />
            </PWInBottomSheetContext.Provider>,
        )

        expect(capturedProps.renderScrollComponent).toBe(mockScrollableCreator)
    })

    it('lets an explicit inBottomSheet prop override the context value', () => {
        render(
            <PWInBottomSheetContext.Provider value={true}>
                <PWFlatList
                    data={[1, 2]}
                    renderItem={() => null}
                    inBottomSheet={false}
                />
            </PWInBottomSheetContext.Provider>,
        )

        expect(capturedProps.renderScrollComponent).toBeUndefined()
    })
})
