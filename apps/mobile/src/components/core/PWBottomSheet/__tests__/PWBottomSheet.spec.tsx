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
import { type Optional } from '@perawallet/wallet-core-shared'
import { render, screen } from '@test-utils/render'
import { PWBottomSheet, type PWBottomSheetSize } from '../PWBottomSheet'
import { Text } from 'react-native'

// Track what props BottomSheetModal receives
let capturedProps: Record<string, unknown> = {}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
vi.mock('@gorhom/bottom-sheet', async () => {
    const React = require('react')

    const BottomSheetModal = React.forwardRef(
        ({ children, ...props }: any, ref: any) => {
            const [isOpen, setIsOpen] = React.useState(false)

            // Capture props for assertion
            capturedProps = props

            React.useImperativeHandle(ref, () => ({
                present: () => setIsOpen(true),
                dismiss: () => {
                    setIsOpen(false)
                    props.onDismiss?.()
                },
                snapToIndex: () => setIsOpen(true),
                close: () => setIsOpen(false),
                expand: () => setIsOpen(true),
                collapse: () => {},
                forceClose: () => setIsOpen(false),
            }))

            return isOpen
                ? React.createElement(
                      'div',
                      { 'data-testid': 'BottomSheetModal' },
                      children,
                  )
                : null
        },
    )

    return {
        default: BottomSheetModal,
        BottomSheet: BottomSheetModal,
        BottomSheetModal,
        BottomSheetModalProvider: ({ children }: any) => children,
        BottomSheetBackdrop: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'BottomSheetBackdrop',
            }),
        BottomSheetScrollView: ({ children, ...props }: any) =>
            React.createElement('div', { ...props }, children),
        BottomSheetView: ({ children, ...props }: any) =>
            React.createElement('div', { ...props }, children),
        BottomSheetFlatList: ({ data, renderItem, ...props }: any) =>
            React.createElement(
                'div',
                props,
                data?.map((item: any, index: number) =>
                    renderItem({ item, index }),
                ),
            ),
        BottomSheetSectionList: ({ sections, renderItem, ...props }: any) =>
            React.createElement(
                'div',
                props,
                sections?.flatMap((section: any) =>
                    section.data?.map((item: any, index: number) =>
                        renderItem({ item, index, section }),
                    ),
                ),
            ),
        BottomSheetTextInput: (props: any) =>
            React.createElement('input', props),
        useBottomSheet: () => ({
            snapToIndex: vi.fn(),
            close: vi.fn(),
            expand: vi.fn(),
            collapse: vi.fn(),
        }),
        useBottomSheetModal: () => ({
            dismiss: vi.fn(),
            dismissAll: vi.fn(),
        }),
        useBottomSheetDynamicSnapPoints: () => ({
            animatedHandleHeight: { value: 0 },
            animatedSnapPoints: { value: ['100%'] },
            animatedContentHeight: { value: 0 },
            handleContentLayout: vi.fn(),
        }),
    }
})
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

beforeEach(() => {
    capturedProps = {}
})

describe('PWBottomSheet', () => {
    it('shows children when visible', () => {
        render(
            <PWBottomSheet isVisible={true}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })

    it('does not show children when not visible', () => {
        render(
            <PWBottomSheet isVisible={false}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.queryByText('Sheet Content')).toBeNull()
    })

    it('hides children when visibility is toggled off', () => {
        const { rerender } = render(
            <PWBottomSheet isVisible={true}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()

        rerender(
            <PWBottomSheet isVisible={false}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.queryByText('Sheet Content')).toBeNull()
    })

    it('does NOT fire onBackdropPress on programmatic dismiss', () => {
        // Regression: handleDismiss used to fan out to both onBackdropPress
        // and onDismiss on every gorhom-dismissal, which produced a
        // redundant `store.dismiss(...)` cycle and tore down the underlying
        // sheet (the WebView under a WC connection sheet, in practice).
        // onBackdropPress is reserved for genuine backdrop-press gestures.
        const onBackdropPress = vi.fn()

        const { rerender } = render(
            <PWBottomSheet
                isVisible={true}
                onBackdropPress={onBackdropPress}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()

        rerender(
            <PWBottomSheet
                isVisible={false}
                onBackdropPress={onBackdropPress}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(onBackdropPress).not.toHaveBeenCalled()
    })

    it.each([
        ['auto', true, undefined],
        ['modal', false, ['96%']],
        ['full', false, ['100%']],
    ] as [PWBottomSheetSize, boolean, Optional<string[]>][])(
        'passes correct config for size=%s',
        (size, expectedDynamic, expectedSnap) => {
            render(
                <PWBottomSheet
                    isVisible={true}
                    size={size}
                >
                    <Text>Content</Text>
                </PWBottomSheet>,
            )

            expect(capturedProps.enableDynamicSizing).toBe(expectedDynamic)
            expect(capturedProps.snapPoints).toEqual(expectedSnap)
        },
    )

    it('enables pan-down-to-close when specified', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                enablePanDownToClose={true}
            >
                <Text>Draggable Content</Text>
            </PWBottomSheet>,
        )

        expect(capturedProps.enablePanDownToClose).toBe(true)
    })

    it('disables pan-down-to-close by default', () => {
        render(
            <PWBottomSheet isVisible={true}>
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        expect(capturedProps.enablePanDownToClose).toBe(false)
    })

    it('leaves content panning enabled by default so sheet content stays touchable on Android (PERA-4647)', () => {
        // Disabling the gesture wraps content in a disabled GestureDetector,
        // which stops delivering touches on Android — taps then fall through
        // to the closing backdrop and dismiss the sheet.
        render(
            <PWBottomSheet isVisible={true}>
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        expect(capturedProps.enableContentPanningGesture).toBeUndefined()
    })

    it('activates the content pan only after vertical movement so taps reach touchables (PERA-4437)', () => {
        render(
            <PWBottomSheet isVisible={true}>
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        expect(capturedProps.activeOffsetY).toEqual([-10, 10])
    })

    it('lets an explicit enableContentPanningGesture opt-out pass through', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                enableContentPanningGesture={false}
            >
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        expect(capturedProps.enableContentPanningGesture).toBe(false)
    })

    it.each(['modal', 'full'] as PWBottomSheetSize[])(
        'hides the drag-handle notch on full-screen size=%s even with pan-down',
        size => {
            render(
                <PWBottomSheet
                    isVisible={true}
                    size={size}
                    enablePanDownToClose={true}
                >
                    <Text>Content</Text>
                </PWBottomSheet>,
            )

            expect(capturedProps.handleIndicatorStyle).toEqual({
                display: 'none',
            })
        },
    )

    it('shows the drag-handle notch on non-full pan-down sheets', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                size='auto'
                enablePanDownToClose={true}
            >
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        expect(capturedProps.handleIndicatorStyle).not.toEqual({
            display: 'none',
        })
    })

    it('shrinks a full-height sheet above the keyboard by default', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                size='full'
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByTestId('keyboard-avoiding-view')).toBeTruthy()
    })

    it('skips the keyboard avoider when the content insets itself (PERA-4708)', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                size='full'
                avoidKeyboard={false}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.queryByTestId('keyboard-avoiding-view')).toBeNull()
        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })

    it('holds the sheet at its detent instead of avoiding, when the content insets itself (PERA-4708)', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                size='full'
                avoidKeyboard={false}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        // `interactive` would move the sheet up by the keyboard height, a second
        // avoider on top of the WebView's own inset.
        expect(capturedProps.keyboardBehavior).toBe('extend')
    })

    it('lets gorhom track the keyboard when the sheet does the avoiding', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                size='full'
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(capturedProps.keyboardBehavior).toBe('interactive')
    })

    it('renders children when autoCreateContainer is false', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                autoCreateContainer={false}
            >
                <Text>Non-scrollable Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Non-scrollable Content')).toBeTruthy()
    })
})
