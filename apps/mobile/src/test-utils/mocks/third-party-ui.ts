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

import { vi } from 'vitest'

vi.mock('react-native-safe-area-context', () => {
    const React = require('react')
    const inset = { top: 0, right: 0, bottom: 0, left: 0 }
    const frame = { x: 0, y: 0, width: 375, height: 812 }
    // SafeAreaInsetsContext is consumed by @react-navigation/elements and
    // other libraries that opt into the real React Context API rather than
    // calling useSafeAreaInsets(). Provide a real Context so those callers
    // resolve cleanly.
    const SafeAreaInsetsContext = React.createContext(inset)
    const SafeAreaFrameContext = React.createContext(frame)
    return {
        SafeAreaProvider: vi
            .fn()
            .mockImplementation(({ children }) => children),
        SafeAreaConsumer: vi
            .fn()
            .mockImplementation(({ children }) => children(inset)),
        SafeAreaView: vi.fn().mockImplementation(({ children }) => children),
        useSafeAreaInsets: vi.fn().mockImplementation(() => inset),
        useSafeAreaFrame: vi.fn().mockImplementation(() => frame),
        SafeAreaInsetsContext,
        SafeAreaFrameContext,
        initialWindowMetrics: { insets: inset, frame },
    }
})

// react-native-pager-view requires the native RNCViewPager view manager and
// touches the legacy bridge at import time, so the unit environment cannot load
// the real package (the web bundle aliases it to a shim instead — see
// metro.config.js). Every consumer uses plain children-as-pages, with
// OnrampScreen additionally calling `setPage` on the ref, so rendering the
// children inline is a faithful stand-in rather than an inert stub.
vi.mock('react-native-pager-view', () => {
    const React = require('react')
    return {
        __esModule: true,
        default: React.forwardRef((props: any, ref: any) => {
            React.useImperativeHandle(ref, () => ({ setPage: vi.fn() }))
            return React.createElement('div', props, props.children)
        }),
    }
})

vi.mock('react-native-draggable-flatlist', () => {
    const { forwardRef } = require('react')
    return {
        __esModule: true,
        default: forwardRef(({ data, renderItem, keyExtractor }: any) => {
            return (data ?? []).map((item: any, index: number) => {
                const key = keyExtractor ? keyExtractor(item, index) : index
                return renderItem({
                    item,
                    getIndex: () => index,
                    drag: vi.fn(),
                    isActive: false,
                    key,
                })
            })
        }),
        ScaleDecorator: ({ children }: any) => children,
        NestableScrollContainer: ({ children }: any) => children,
        NestableDraggableFlatList: forwardRef(
            ({ data, renderItem, keyExtractor }: any) => {
                return (data ?? []).map((item: any, index: number) => {
                    const key = keyExtractor ? keyExtractor(item, index) : index
                    return renderItem({
                        item,
                        getIndex: () => index,
                        drag: vi.fn(),
                        isActive: false,
                        key,
                    })
                })
            },
        ),
    }
})

vi.mock('react-native-webview', () => {
    const React = require('react')
    const MockView = (props: any) =>
        React.createElement('div', props, props.children)
    return {
        default: vi.fn().mockImplementation(() => MockView),
        WebView: vi.fn().mockImplementation(() => MockView),
    }
})

vi.mock('react-native-tab-view', () => ({
    TabView: () => null,
    TabBar: () => null,
    SceneMap: () => null,
}))

vi.mock('react-native-notifier', () => {
    const React = require('react')
    const MockView = (props: any) =>
        React.createElement('div', props, props.children)
    return {
        NotifierRoot: ({ children }: any) =>
            React.createElement(MockView, {}, children),
        NotifierWrapper: ({ children }: any) =>
            React.createElement(MockView, {}, children),
        Notifier: {
            showNotification: vi.fn(),
            hideNotification: vi.fn(),
        },
    }
})

// Mock react-native-advanced-input-mask
vi.mock('react-native-advanced-input-mask', () => {
    const React = require('react')
    return {
        MaskedTextInput: (props: any) =>
            React.createElement('input', {
                ...props,
                'data-testid': 'masked-text-input',
                type: 'text',
            }),
    }
})

// Mock react-native-svg as simple components
vi.mock('react-native-svg', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('svg', props, props.children),
        Svg: (props: any) => React.createElement('svg', props, props.children),
        Path: (props: any) =>
            React.createElement('path', props, props.children),
        Circle: (props: any) =>
            React.createElement('circle', props, props.children),
        Rect: (props: any) =>
            React.createElement('rect', props, props.children),
        G: (props: any) => React.createElement('g', props, props.children),
        Defs: (props: any) =>
            React.createElement('defs', props, props.children),
        ClipPath: (props: any) =>
            React.createElement('clipPath', props, props.children),
    }
})

// Mock react-native-qrcode-svg (contains JSX in .js files)
vi.mock('react-native-qrcode-svg', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('svg', {
                ...props,
                'data-testid': 'QRCode',
            }),
    }
})

// Mock @shopify/flash-list
vi.mock('@shopify/flash-list', () => {
    const React = require('react')
    return {
        FlashList: ({
            data,
            renderItem,
            ListHeaderComponent,
            ListFooterComponent,
            ListEmptyComponent,
            testID,
        }: any) => {
            const header = ListHeaderComponent
                ? React.isValidElement(ListHeaderComponent)
                    ? ListHeaderComponent
                    : typeof ListHeaderComponent === 'function'
                      ? React.createElement(ListHeaderComponent)
                      : null
                : null
            const footer = ListFooterComponent
                ? React.isValidElement(ListFooterComponent)
                    ? ListFooterComponent
                    : typeof ListFooterComponent === 'function'
                      ? React.createElement(ListFooterComponent)
                      : null
                : null
            const empty = ListEmptyComponent
                ? React.isValidElement(ListEmptyComponent)
                    ? ListEmptyComponent
                    : typeof ListEmptyComponent === 'function'
                      ? React.createElement(ListEmptyComponent)
                      : null
                : null

            return React.createElement(
                'div',
                { 'data-testid': testID ?? 'FlashList' },
                header,
                data && data.length > 0
                    ? data.map((item: any, index: number) =>
                          renderItem({ item, index }),
                      )
                    : empty,
                footer,
            )
        },
    }
})

vi.mock('react-native-gifted-charts', () => {
    const React = require('react')
    return {
        LineChart: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'LineChart',
            }),
        BarChart: (props: any) =>
            React.createElement('div', { ...props, 'data-testid': 'BarChart' }),
        PieChart: (props: any) =>
            React.createElement('div', { ...props, 'data-testid': 'PieChart' }),
    }
})

// Mock @react-native-community/datetimepicker to prevent Rollup parse errors
vi.mock('@react-native-community/datetimepicker', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': props.testID || 'datetimepicker',
            }),
    }
})

// Mock @gorhom/bottom-sheet
vi.mock('@gorhom/bottom-sheet', async () => {
    const React = require('react')
    // Resolved through vitest so it is whichever react-native the project
    // mocks, and inputs inside sheets get the same testID/onChangeText wiring.
    // Read at render time: specs that mock react-native partially omit it.
    const reactNative = await import('react-native')

    const BottomSheetModal = React.forwardRef(
        ({ children, ...props }: any, ref: any) => {
            const [isOpen, setIsOpen] = React.useState(false)
            const wasOpenRef = React.useRef(false)

            // gorhom fires onDismiss once a presented modal has closed; the
            // bottom-sheet request host settles its promise on it.
            React.useEffect(() => {
                if (wasOpenRef.current && !isOpen) props.onDismiss?.()
                wasOpenRef.current = isOpen
            }, [isOpen, props.onDismiss])

            React.useImperativeHandle(ref, () => ({
                present: () => setIsOpen(true),
                dismiss: () => setIsOpen(false),
                snapToIndex: () => setIsOpen(true),
                close: () => setIsOpen(false),
                expand: () => setIsOpen(true),
                collapse: () => {},
                forceClose: () => setIsOpen(false),
            }))

            return isOpen
                ? React.createElement(
                      'div',
                      { ...props, 'data-testid': 'BottomSheetModal' },
                      children,
                  )
                : null
        },
    )

    const BottomSheet = React.forwardRef(
        ({ children, ...props }: any, ref: any) => {
            React.useImperativeHandle(ref, () => ({
                snapToIndex: vi.fn(),
                close: vi.fn(),
                expand: vi.fn(),
                collapse: vi.fn(),
                forceClose: vi.fn(),
            }))

            return React.createElement(
                'div',
                { ...props, 'data-testid': 'BottomSheet' },
                children,
            )
        },
    )

    return {
        default: BottomSheet,
        BottomSheet,
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
        BottomSheetTextInput: React.forwardRef((props: any, ref: any) =>
            React.createElement(reactNative.TextInput, { ...props, ref }),
        ),
        useBottomSheet: () => ({
            snapToIndex: vi.fn(),
            close: vi.fn(),
            expand: vi.fn(),
            collapse: vi.fn(),
        }),
        // PWFlatList calls this on every render; the list mocks ignore the
        // scroll component it returns.
        useBottomSheetScrollableCreator:
            () =>
            ({ children, ...props }: any) =>
                React.createElement('div', props, children),
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
