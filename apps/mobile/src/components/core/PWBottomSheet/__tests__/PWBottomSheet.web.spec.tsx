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
import { Animated, Text } from 'react-native'
import { act, render, screen, fireEvent } from '@test-utils/render'
// Import the exact web filename — vitest has no Metro platform resolution,
// so a bare '../PWBottomSheet' specifier would load the gorhom-based native
// module instead (as the native PWBottomSheet.spec.tsx does the mirror of
// this by importing '../PWBottomSheet' directly).
import {
    PWBottomSheet,
    bottomSheetNotifier,
    type PWBottomSheetSize,
} from '../PWBottomSheet.web'

// The global setup mock renders NotifierWrapper as a plain View and drops the
// ref — which is the one thing this file needs to observe, since a null
// bottomSheetNotifier is what makes in-sheet toasts fall back to the buried
// app-level notifier. Re-mock locally with the real component's shape:
// children plus a ref-bearing root.
vi.mock('react-native-notifier', async () => {
    const ReactActual = await vi.importActual<typeof import('react')>('react')
    return {
        NotifierWrapper: ReactActual.forwardRef(
            ({ children }: { children?: React.ReactNode }, ref) => {
                ReactActual.useImperativeHandle(ref, () => ({
                    showNotification: vi.fn(),
                    hideNotification: vi.fn(),
                }))
                return ReactActual.createElement(
                    ReactActual.Fragment,
                    null,
                    children,
                )
            },
        ),
        NotifierRoot: ({ children }: { children?: React.ReactNode }) =>
            children ?? null,
        Notifier: { showNotification: vi.fn(), hideNotification: vi.fn() },
    }
})

// Capture the props handed to the style hook so size branches can be
// asserted on the isFixed flag they produce rather than real style values.
let capturedStyleProps: { maxHeight: number; isFixed: boolean } | null = null

vi.mock('../styles.web', async () => {
    const actual =
        await vi.importActual<typeof import('../styles.web')>('../styles.web')
    return {
        useStyles: (props: { maxHeight: number; isFixed: boolean }) => {
            capturedStyleProps = props
            return actual.useStyles(props)
        },
    }
})

beforeEach(() => {
    capturedStyleProps = null
})

describe('PWBottomSheet.web', () => {
    it('renders children when visible', () => {
        render(
            <PWBottomSheet isVisible={true}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })

    it('renders nothing when initially mounted with isVisible=false', () => {
        render(
            <PWBottomSheet isVisible={false}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.queryByText('Sheet Content')).toBeNull()
    })

    it('does not fire onDismiss when mounted with isVisible=false (no prior true→false transition)', () => {
        const onDismiss = vi.fn()
        render(
            <PWBottomSheet
                isVisible={false}
                onDismiss={onDismiss}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(onDismiss).not.toHaveBeenCalled()
    })

    it('fires onDismiss after the exit animation completes when isVisible flips to false', () => {
        const onDismiss = vi.fn()
        const { rerender } = render(
            <PWBottomSheet
                isVisible={true}
                onDismiss={onDismiss}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )
        expect(onDismiss).not.toHaveBeenCalled()

        rerender(
            <PWBottomSheet
                isVisible={false}
                onDismiss={onDismiss}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        // The global RN mock (vitest.setup.ts) resolves Animated.start()
        // synchronously, so the exit animation "completes" within rerender.
        expect(onDismiss).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('Sheet Content')).toBeNull()
    })

    it('stays mounted while animating out, and unmounts only once the exit animation resolves', () => {
        const onDismiss = vi.fn()
        // Override the auto-resolving global Animated mock so the exit
        // animation's completion is under this test's control instead of
        // resolving synchronously inside rerender.
        let latestCallback: Animated.EndCallback | undefined
        const parallelSpy = vi.spyOn(Animated, 'parallel').mockImplementation(
            (): Animated.CompositeAnimation => ({
                start: callback => {
                    latestCallback = callback
                },
                stop: vi.fn(),
                reset: vi.fn(),
            }),
        )

        const { rerender } = render(
            <PWBottomSheet
                isVisible={true}
                onDismiss={onDismiss}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        rerender(
            <PWBottomSheet
                isVisible={false}
                onDismiss={onDismiss}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        // Exit animation hasn't resolved yet: still mounted, no onDismiss.
        expect(screen.queryByText('Sheet Content')).toBeTruthy()
        expect(onDismiss).not.toHaveBeenCalled()

        act(() => {
            latestCallback?.({ finished: true })
        })

        expect(onDismiss).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('Sheet Content')).toBeNull()

        parallelSpy.mockRestore()
    })

    it('calls onDismiss on backdrop press when dismissable', () => {
        const onDismiss = vi.fn()
        render(
            <PWBottomSheet
                isVisible={true}
                onDismiss={onDismiss}
                enableCloseOnBackdropPress={true}
            >
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        fireEvent.click(screen.getByTestId('pw-bottom-sheet-backdrop'))

        expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('does not call onDismiss on backdrop press when not dismissable', () => {
        const onDismiss = vi.fn()
        render(
            <PWBottomSheet
                isVisible={true}
                onDismiss={onDismiss}
                enableCloseOnBackdropPress={false}
            >
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        fireEvent.click(screen.getByTestId('pw-bottom-sheet-backdrop'))

        expect(onDismiss).not.toHaveBeenCalled()
    })

    it('calls onBackdropPress instead of onDismiss when supplied', () => {
        const onDismiss = vi.fn()
        const onBackdropPress = vi.fn()
        render(
            <PWBottomSheet
                isVisible={true}
                onDismiss={onDismiss}
                onBackdropPress={onBackdropPress}
            >
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        fireEvent.click(screen.getByTestId('pw-bottom-sheet-backdrop'))

        expect(onBackdropPress).toHaveBeenCalledTimes(1)
        expect(onDismiss).not.toHaveBeenCalled()
    })

    it.each([
        ['auto', false],
        ['modal', true],
        ['full', true],
    ] as [PWBottomSheetSize, boolean][])(
        'passes isFixed=%s for size=%s to the style hook',
        (size, isFixed) => {
            render(
                <PWBottomSheet
                    isVisible={true}
                    size={size}
                >
                    <Text>Content</Text>
                </PWBottomSheet>,
            )

            expect(capturedStyleProps?.isFixed).toBe(isFixed)
        },
    )

    it('forwards testID to the sheet container', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                testID='my-sheet'
            >
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByTestId('my-sheet')).toBeTruthy()
    })

    // Regression test for the sheet bleeding to the full browser-tab width
    // on the wide "expanded" surface: react-native-web's Modal portals to
    // document.body outside AppShell.web.tsx's width-capped card, so the
    // backdrop and sheet must be wrapped in their own width-capped stage
    // rather than relying on an ancestor in the React tree.
    it('nests the backdrop and sheet content inside the width-capped stage container', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                testID='my-sheet'
            >
                <Text>Content</Text>
            </PWBottomSheet>,
        )

        const stage = screen.getByTestId('pw-bottom-sheet-stage')
        expect(
            stage.contains(screen.getByTestId('pw-bottom-sheet-backdrop')),
        ).toBe(true)
        expect(stage.contains(screen.getByTestId('my-sheet'))).toBe(true)
    })

    // react-native-web portals the Modal to document.body, ABOVE the app-level
    // NotifierWrapper in AppShell.web. Callers that pass
    // `notifier: bottomSheetNotifier.current` (signing errors, send-confirm
    // errors, broadcast failures) fall back to that buried global notifier when
    // this ref is null — painting behind the open sheet, i.e. invisible exactly
    // when they matter most.
    it('populates bottomSheetNotifier while the sheet is open', () => {
        expect(bottomSheetNotifier.current).toBeNull()

        render(
            <PWBottomSheet isVisible={true}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(bottomSheetNotifier.current).not.toBeNull()
    })
})
