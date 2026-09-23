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

// Mock React Navigation
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: vi.fn(),
        goBack: vi.fn(),
        reset: vi.fn(),
        setOptions: vi.fn(),
        setParams: vi.fn(),
        push: vi.fn(),
        canGoBack: vi.fn(() => false),
        isFocused: vi.fn(() => true),
    }),
    useRoute: vi.fn(() => ({
        params: {},
    })),
    useFocusEffect: vi.fn(),
    NavigationContainer: ({ children }: any) => children,
    NavigationIndependentTree: ({ children }: any) => children,
    DefaultTheme: {
        colors: {
            primary: 'blue',
            background: 'white',
            card: 'white',
            text: 'black',
            border: 'gray',
            notification: 'red',
        },
    },
    createNavigatorFactory: vi.fn(() => () => ({
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
        Group: ({ children }: any) => children,
    })),
    useNavigationState: vi.fn(() => ({})),
    StackActions: {
        replace: vi.fn(),
        push: vi.fn(),
        pop: vi.fn(),
        popToTop: vi.fn(),
    },
    createNavigationContainerRef: () => ({
        navigate: vi.fn(),
        dispatch: vi.fn(),
        reset: vi.fn(),
        goBack: vi.fn(),
        isReady: vi.fn(() => true),
        current: null,
    }),
    NavigationContainerRefContext: (() => {
        const React = require('react')
        return React.createContext(undefined)
    })(),
    NavigationContext: (() => {
        const React = require('react')
        return React.createContext(undefined)
    })(),
}))

vi.mock('@react-navigation/bottom-tabs', () => {
    const React = require('react')
    return {
        createBottomTabNavigator: vi.fn(() => ({
            Navigator: ({ children }: any) => children,
            Screen: ({ children }: any) => children,
        })),
        BottomTabBarHeightContext: React.createContext(undefined),
    }
})

vi.mock('@react-navigation/native-stack', () => {
    const React = require('react')
    return {
        createNativeStackNavigator: vi.fn(() => ({
            Navigator: ({ children, initialRouteName }: any) => {
                // Find the initial screen and render it
                const screens = React.Children.toArray(children)
                const initialScreen =
                    screens.find(
                        (child: any) => child.props?.name === initialRouteName,
                    ) || screens[0]
                if (initialScreen?.props?.component) {
                    const Component = initialScreen.props.component
                    return React.createElement(
                        Component,
                        initialScreen.props.initialParams || {},
                    )
                }
                return children
            },
            Screen: ({
                children,
                component: Component,
                initialParams,
            }: any) => {
                if (Component) {
                    return React.createElement(Component, initialParams || {})
                }
                return children
            },
        })),
    }
})

vi.mock('@react-navigation/stack', () => {
    const React = require('react')
    return {
        createStackNavigator: vi.fn(() => ({
            Navigator: ({ children, initialRouteName }: any) => {
                // Find the initial screen and render it
                const screens = React.Children.toArray(children)
                const initialScreen =
                    screens.find(
                        (child: any) => child.props?.name === initialRouteName,
                    ) || screens[0]
                if (initialScreen?.props?.component) {
                    const Component = initialScreen.props.component
                    return React.createElement(
                        Component,
                        initialScreen.props.initialParams || {},
                    )
                }
                return children
            },
            Screen: ({
                children,
                component: Component,
                initialParams,
            }: any) => {
                if (Component) {
                    return React.createElement(Component, initialParams || {})
                }
                return children
            },
            Group: ({ children }: any) => children,
        })),
        TransitionPresets: {
            SlideFromRightIOS: {},
            ModalSlideFromBottomIOS: {},
            ModalPresentationIOS: {},
            FadeFromBottomAndroid: {},
            RevealFromBottomAndroid: {},
            ScaleFromCenterAndroid: {},
            DefaultTransition: {},
            ModalTransition: {},
        },
        CardStyleInterpolators: {
            forHorizontalIOS: vi.fn(),
            forVerticalIOS: vi.fn(),
            forModalPresentationIOS: vi.fn(),
            forFadeFromBottomAndroid: vi.fn(),
            forRevealFromBottomAndroid: vi.fn(),
            forScaleFromCenterAndroid: vi.fn(),
            forNoAnimation: vi.fn(),
        },
        HeaderStyleInterpolators: {
            forUIKit: vi.fn(),
            forFade: vi.fn(),
            forStatic: vi.fn(),
            forNoAnimation: vi.fn(),
        },
    }
})

vi.mock('@react-navigation/material-top-tabs', () => ({
    createMaterialTopTabNavigator: vi.fn(() => ({
        Navigator: ({ children }: any) =>
            require('react').createElement('div', {}, children),

        Screen: ({ children, component: Component, options }: any) => {
            const React = require('react')
            return React.createElement(
                'div',
                {},
                options?.title || options?.tabBarLabel
                    ? React.createElement(
                          'span',
                          {},
                          options.title || options.tabBarLabel,
                      )
                    : null,
                Component
                    ? React.createElement(Component)
                    : typeof children === 'function'
                      ? children({ navigation: {} })
                      : children,
            )
        },
    })),
}))
