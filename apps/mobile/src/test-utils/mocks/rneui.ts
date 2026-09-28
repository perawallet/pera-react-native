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

vi.mock('@rneui/themed', () => {
    const React = require('react')

    // Plain DOM stand-ins; importing react-native here would load the real
    // package. `testID` becomes `data-testid` as react-native-web would map
    // it, so specs can find the real PW components that wrap these.
    const domProps = ({ testID, ...props }: any) =>
        testID === undefined ? props : { ...props, 'data-testid': testID }
    const MockView = ({ onPress, children, ...props }: any) =>
        React.createElement(
            'div',
            { onClick: onPress, ...domProps(props) },
            children,
        )
    const MockText = ({ children, ...props }: any) =>
        React.createElement('span', domProps(props), children)
    const MockTextInput = ({ onChangeText, ...props }: any) =>
        React.createElement('input', {
            onChange: (e: any) => onChangeText?.(e.target.value),
            ...domProps(props),
        })

    const colors = {
        buttonPrimaryBg: '#FABADA',
        buttonPrimaryText: '#fff',
        textMain: '#000',
        textGray: '#ccc',
        buttonSquareText: '#000',
        textWhite: '#fff',
        linkPrimary: 'blue',
        error: 'red',
        helperPositive: 'green',
        primary: 'blue',
        secondary: 'gray',
        background: 'white',
        layerGrayLighter: '#f0f0f0',
        white: '#ffffff',
        black: '#000000',
        grey0: '#e1e8ee',
        grey1: '#bdc6cf',
        grey2: '#86939e',
        grey3: '#5e6977',
        grey4: '#43484d',
        grey5: '#3e3e3e',
    }

    const mockTheme = {
        colors,
        lightColors: colors,
        darkColors: colors,
        spacing: {
            xs: 4,
            sm: 8,
            md: 16,
            lg: 24,
            xl: 32,
            xxl: 36,
            '3xl': 48,
            '4xl': 56,
        },
        zIndex: {
            base: 0,
            layer1: 10,
            layer2: 20,
            overlay1: 100,
            max: 10_000,
        },
        borderRadius: {
            none: 0,
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 24,
            full: 999,
        },
        borders: {
            none: 0,
            sm: 1,
            md: 2,
        },
        mode: 'light',
        shadows: {
            sm: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
            },
            md: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 4,
            },
        },
    }

    // Tab mock component with Item subcomponent
    const TabItem = (props: any) =>
        React.createElement(
            MockView,
            { ...props, 'data-testid': props.testID ?? 'Tab.Item' },
            props.title,
            props.children,
        )
    const Tab = Object.assign(
        (props: any) =>
            React.createElement(
                MockView,
                { ...props, 'data-testid': props.testID ?? 'Tab' },
                React.Children.map(
                    props.children,
                    (child: any, index: number) => {
                        return React.cloneElement(child, {
                            onPress: () => props.onChange?.(index),
                        })
                    },
                ),
            ),
        { Item: TabItem },
    )

    // Dialog mock component with subcomponents
    const DialogTitle = (props: any) =>
        React.createElement(
            MockText,
            { ...props, 'data-testid': props.testID ?? 'Dialog.Title' },
            props.children,
        )
    const DialogButton = (props: any) =>
        React.createElement(
            MockView,
            {
                ...props,
                'data-testid': props.testID ?? 'Dialog.Button',
                onClick: props.onPress,
            },
            props.title || props.children,
        )
    const DialogActions = (props: any) =>
        React.createElement(
            MockView,
            { ...props, 'data-testid': props.testID ?? 'Dialog.Actions' },
            props.children,
        )
    const Dialog = Object.assign(
        ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      MockView,
                      { ...props, 'data-testid': props.testID ?? 'Dialog' },
                      children,
                  )
                : null,
        {
            Title: DialogTitle,
            Button: DialogButton,
            Actions: DialogActions,
        },
    )

    return {
        makeStyles: (styleFn: any) => (props: any) => {
            return styleFn(mockTheme, props) || {}
        },
        useTheme: () => ({ theme: mockTheme }),
        createTheme: () => mockTheme,
        ThemeProvider: ({ children }: any) => children,
        withTheme: (Component: any) => (props: any) =>
            React.createElement(Component, { ...props, theme: mockTheme }),

        // Mock Components using basic HTML elements
        Button: (props: any) =>
            React.createElement(
                MockView,
                props,
                props.title
                    ? React.createElement(MockText, null, props.title)
                    : props.children,
            ),
        Text: (props: any) =>
            React.createElement(MockText, props, props.children),
        Input: (props: any) =>
            React.createElement(MockTextInput, {
                ...props,
                'data-testid': props.testID ?? 'RNEInput',
            }),
        Badge: ({ value, label, ...props }: any) =>
            React.createElement(
                MockText,
                { ...props, 'data-testid': props.testID ?? 'RNEBadge' },
                value || label || props.children,
            ),
        Image: Object.assign(
            (props: any) =>
                React.createElement('img', {
                    ...props,
                    'data-testid': props.testID ?? 'RNEImage',
                }),
            {
                resolveAssetSource: () => ({
                    uri: 'mock-image-uri',
                    width: 100,
                    height: 100,
                }),
            },
        ),
        Skeleton: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': props.testID ?? 'RNESkeleton',
            }),
        CheckBox: (props: any) =>
            React.createElement(MockView, props, props.children),
        Switch: ({ value, onValueChange, ...props }: any) =>
            React.createElement('input', {
                type: 'checkbox',
                role: 'switch',
                checked: value,
                onChange: (e: any) => onValueChange?.(e.target.checked),
                ...props,
                'data-testid': props.testID ?? 'RNESwitch',
            }),
        BottomSheet: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      MockView,
                      {
                          ...props,
                          'data-testid': props.testID ?? 'RNEBottomSheet',
                      },
                      children,
                  )
                : null,
        Overlay: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      MockView,
                      { ...props, 'data-testid': props.testID ?? 'RNEOverlay' },
                      children,
                  )
                : null,
        Icon: (props: any) => React.createElement(MockView, props),
        Tab,
        TabView: Object.assign(
            (props: any) =>
                React.createElement(
                    MockView,
                    { ...props, 'data-testid': props.testID ?? 'TabView' },
                    props.children,
                ),
            {
                Item: (props: any) =>
                    React.createElement(
                        MockView,
                        {
                            ...props,
                            'data-testid': props.testID ?? 'TabView.Item',
                        },
                        props.children,
                    ),
            },
        ),
        Dialog,
        ListItem: Object.assign(
            (props: any) =>
                React.createElement(MockView, props, props.children),
            {
                Content: (props: any) =>
                    React.createElement(MockView, props, props.children),
                Title: (props: any) =>
                    React.createElement(MockText, props, props.children),
                Subtitle: (props: any) =>
                    React.createElement(MockText, props, props.children),
                Chevron: (props: any) => React.createElement(MockView, props),
            },
        ),
        Divider: (props: any) =>
            React.createElement(MockView, {
                ...props,
                'data-testid': props.testID ?? 'Divider',
            }),
    }
})

// Unit tests stub @rneui/themed, but PWDivider reads `defaultTheme` from
// @rneui/base, whose barrel (and even its palette module) needs the real
// react-native. Unit specs don't assert colours, so an empty palette will do.
vi.mock('@rneui/base', () => ({ defaultTheme: { colors: {} } }))
