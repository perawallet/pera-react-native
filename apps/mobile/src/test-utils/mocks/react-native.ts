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

// Unit tests render react-native as plain DOM stubs; the integration project
// swaps this for react-native-web (see vitest.integration-setup.ts).
vi.mock('react-native', async () => {
    const { createReactNativeApiMocks } = await import('./react-native-apis')
    return {
        ...createReactNativeApiMocks(),
        StyleSheet: {
            create: vi.fn(styles => styles),
            flatten: vi.fn(styles =>
                Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
            ),
            hairlineWidth: 1,
            absoluteFill: {
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
            },
        },
        // Map React Native components to web-compatible HTML elements with proper event handling
        TouchableOpacity: vi
            .fn()
            .mockImplementation(
                ({
                    onPress,
                    onLongPress,
                    children,
                    activeOpacity,
                    testID,
                    accessibilityLabel,
                    ...props
                }) => {
                    const React = require('react')

                    void activeOpacity

                    return React.createElement(
                        'button',
                        {
                            ...props,
                            'aria-label': accessibilityLabel,
                            onClick: onPress,
                            // DOM stand-in for long press; fire with fireEvent.contextMenu.
                            onContextMenu: onLongPress,
                            ...(testID
                                ? { 'data-testid': testID, testid: testID }
                                : {}),
                        },
                        children,
                    )
                },
            ),
        View: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'div',
                {
                    ...props,
                    ...(testID
                        ? { 'data-testid': testID, testid: testID }
                        : {}),
                },
                props.children,
            ),
        ),
        Text: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'span',
                {
                    ...props,
                    ...(testID
                        ? { 'data-testid': testID, testid: testID }
                        : {}),
                },
                props.children,
            ),
        ),
        Image: Object.assign(
            vi.fn().mockImplementation(({ testID, ...props }) =>
                require('react').createElement(
                    'img',
                    {
                        ...props,
                        ...(testID
                            ? { 'data-testid': testID, testid: testID }
                            : {}),
                    },
                    props.children,
                ),
            ),
            {
                resolveAssetSource: vi.fn(() => ({
                    uri: 'mock-image-uri',
                    width: 100,
                    height: 100,
                })),
            },
        ),
        ImageBackground: Object.assign(
            vi.fn().mockImplementation(({ testID, ...props }) =>
                require('react').createElement(
                    'div',
                    {
                        ...props,
                        ...(testID
                            ? {
                                  'data-testid': testID || 'ImageBackground',
                                  testid: testID || 'ImageBackground',
                              }
                            : {
                                  'data-testid': 'ImageBackground',
                                  testid: 'ImageBackground',
                              }),
                    },
                    props.children,
                ),
            ),
            {
                resolveAssetSource: vi.fn(() => ({
                    uri: 'mock-image-uri',
                    width: 100,
                    height: 100,
                })),
            },
        ),
        ScrollView: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'div',
                {
                    ...props,
                    ...(testID
                        ? { 'data-testid': testID, testid: testID }
                        : {}),
                },
                props.children,
            ),
        ),
        FlatList: vi
            .fn()
            .mockImplementation(({ data, renderItem, testID, ...props }) => {
                const React = require('react')
                return React.createElement(
                    'div',
                    {
                        ...props,
                        'data-testid': testID || 'FlatList',
                        testid: testID || 'FlatList',
                    },
                    data?.map((item: any, index: number) =>
                        renderItem({ item, index }),
                    ),
                )
            }),
        SectionList: vi
            .fn()
            .mockImplementation(
                ({
                    sections,
                    renderItem,
                    renderSectionHeader,
                    keyExtractor,
                    testID,
                    ListHeaderComponent,
                    ListEmptyComponent,
                    ListFooterComponent,
                    ...props
                }) => {
                    const React = require('react')
                    const isEmpty =
                        !sections ||
                        sections.length === 0 ||
                        sections.every(
                            (s: any) => !s.data || s.data.length === 0,
                        )
                    return React.createElement(
                        'div',
                        {
                            ...props,
                            'data-testid': testID || 'SectionList',
                            testid: testID || 'SectionList',
                        },
                        ListHeaderComponent
                            ? typeof ListHeaderComponent === 'function'
                                ? ListHeaderComponent()
                                : ListHeaderComponent
                            : null,
                        isEmpty && ListEmptyComponent
                            ? typeof ListEmptyComponent === 'function'
                                ? ListEmptyComponent()
                                : ListEmptyComponent
                            : null,
                        sections?.map((section: any, sectionIndex: number) =>
                            React.createElement(
                                'div',
                                { key: `section-${sectionIndex}` },
                                renderSectionHeader
                                    ? renderSectionHeader({ section })
                                    : null,
                                section.data?.map(
                                    (item: any, itemIndex: number) =>
                                        React.createElement(
                                            'div',
                                            {
                                                key: keyExtractor
                                                    ? keyExtractor(
                                                          item,
                                                          itemIndex,
                                                      )
                                                    : itemIndex,
                                            },
                                            renderItem({
                                                item,
                                                index: itemIndex,
                                                section,
                                            }),
                                        ),
                                ),
                            ),
                        ),
                        ListFooterComponent
                            ? typeof ListFooterComponent === 'function'
                                ? ListFooterComponent()
                                : ListFooterComponent
                            : null,
                    )
                },
            ),
        TextInput: vi
            .fn()
            .mockImplementation(({ testID, onChangeText, ...props }) =>
                require('react').createElement(
                    'input',
                    {
                        ...props,
                        onChange: (e: any) => onChangeText?.(e.target.value),
                        ...(testID
                            ? { 'data-testid': testID, testid: testID }
                            : {}),
                    },
                    props.children,
                ),
            ),

        Modal: vi.fn().mockImplementation((args: any) => {
            const {
                visible,
                transparent,
                animationType,
                onRequestClose,
                onShow,
                testID,
                ...props
            } = args

            void transparent
            void animationType
            void onRequestClose
            void onShow
            return visible
                ? require('react').createElement(
                      'div',
                      {
                          ...props,
                          ...(testID
                              ? { 'data-testid': testID, testid: testID }
                              : {}),
                      },
                      props.children,
                  )
                : null
        }),
        ActivityIndicator: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'div',
                {
                    ...props,
                    'data-testid': testID || 'activity-indicator',
                    testid: testID || 'activity-indicator',
                },
                'Loading...',
            ),
        ),
        // RefreshControl renders no visible content in jsdom, and its props
        // (refreshing/onRefresh/colors/progressBackgroundColor) aren't valid
        // DOM attributes — render null to avoid React unknown-prop warnings.
        RefreshControl: vi.fn().mockImplementation(() => null),
        Pressable: vi
            .fn()
            .mockImplementation(({ onPress, testID, ...props }) => {
                const React = require('react')
                return React.createElement(
                    'button',
                    {
                        ...props,
                        onClick: onPress,
                        ...(testID
                            ? { 'data-testid': testID, testid: testID }
                            : {}),
                    },
                    props.children,
                )
            }),
        Easing: {
            inOut: vi.fn(fn => fn),
            out: vi.fn(fn => fn),
            in: vi.fn(fn => fn),
            ease: vi.fn(),
            linear: vi.fn(),
            quad: vi.fn(),
            poly: vi.fn(() => vi.fn()),
            bezier: vi.fn(() => vi.fn()),
            circle: vi.fn(),
            sin: vi.fn(),
            exp: vi.fn(),
            elastic: vi.fn(() => vi.fn()),
            back: vi.fn(() => vi.fn()),
            bounce: vi.fn(),
        },
        Animated: {
            timing: vi.fn(() => ({ start: vi.fn(cb => cb?.()) })),
            spring: vi.fn(() => ({ start: vi.fn(cb => cb?.()) })),
            parallel: vi.fn(animations => ({
                start: vi.fn(cb => {
                    animations.forEach((a: any) => a.start())
                    cb?.()
                }),
            })),
            event: vi.fn(),
            Value: vi.fn(function (this: any) {
                this.setValue = vi.fn()
                this.interpolate = vi.fn(() => '0px')
            }),
            createAnimatedComponent: vi.fn(c => c),
            View: vi.fn(({ children, style, ...props }) =>
                require('react').createElement(
                    'div',
                    { ...props, style },
                    children,
                ),
            ),
            Text: vi.fn(({ children, style, ...props }) =>
                require('react').createElement(
                    'span',
                    { ...props, style },
                    children,
                ),
            ),
        },
    }
})

// Basic NativeEventEmitter dependency to avoid errors when no native module is provided
vi.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
    return class NativeEventEmitter {}
})
