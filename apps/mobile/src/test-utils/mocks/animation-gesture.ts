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

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => {
    const React = require('react')
    const Reanimated = {
        default: {
            call: () => {},
            createAnimatedComponent: (component: any) => component,
            View: (props: any) =>
                React.createElement('div', props, props.children),
            Text: (props: any) =>
                React.createElement('div', props, props.children),
            Image: (props: any) => React.createElement('img', props),
            ScrollView: (props: any) =>
                React.createElement('div', props, props.children),
            addWhitelistedNativeProps: () => {},
            addWhitelistedUIProps: () => {},
        },
        useSharedValue: (v: any) => ({ value: v }),
        useDerivedValue: (a: any) => ({ value: a() }),
        useAnimatedStyle: () => ({}),
        useAnimatedProps: () => ({}),
        useAnimatedGestureHandler: () => {},
        useAnimatedScrollHandler: () => {},
        useAnimatedReaction: () => {},
        // Matches the runtime default: motion is only reduced when the OS says
        // so, so components animate normally under test.
        useReducedMotion: () => false,
        withTiming: (toValue: any) => toValue,
        withSpring: (toValue: any) => toValue,
        withDecay: () => 0,
        withDelay: (_: any, toValue: any) => toValue,
        withSequence: (...args: any[]) => args[args.length - 1],
        withRepeat: (anim: any) => anim,
        runOnJS: (fn: any) => fn,
        runOnUI: (fn: any) => fn,
        makeMutable: (v: any) => ({ value: v }),
        cancelAnimation: () => {},
        interpolate: () => 0,
        Extrapolate: { CLAMP: 'clamp' },
        Layout: {
            springify: () => ({ damping: () => ({}) }),
        },
        // Reanimated re-exports `Easing`; CompactBanner consumes
        // `Easing.inOut(Easing.quad)`. Identity stubs keep the calls safe.
        Easing: {
            inOut: (fn: any) => fn,
            out: (fn: any) => fn,
            in: (fn: any) => fn,
            ease: () => undefined,
            linear: () => undefined,
            quad: () => undefined,
            cubic: () => undefined,
            bezier: () => () => undefined,
        },
        FadeIn: {
            duration: () => ({}),
        },
        FadeInDown: {
            duration: () => ({}),
        },
        FadeOut: {
            duration: () => ({}),
        },
        SlideInDown: {
            // Used in QRScannerView
            springify: () => ({ damping: () => ({}) }),
        },
        SlideOutDown: {
            springify: () => ({ damping: () => ({}) }),
        },
    }
    return Reanimated
})

// react-native-worklets ships an extensionless ESM subpath import that vitest
// can't resolve under node; the app only uses scheduleOnRN (runs a callback on
// the JS thread), so mock it to invoke synchronously.
vi.mock('react-native-worklets', () => ({
    scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
        fn(...args),
}))

// Mock Gesture Handler
vi.mock('react-native-gesture-handler', () => {
    const React = require('react')
    const MockView = (props: any) =>
        React.createElement('div', props, props.children)
    const createGestureBuilder = () => {
        const builder: any = {}
        const chainable = [
            'enabled',
            'minPointers',
            'maxPointers',
            'numberOfTaps',
            'onStart',
            'onUpdate',
            'onEnd',
            'onBegin',
            'onFinalize',
            'onTouchesDown',
            'onTouchesUp',
            'onChange',
            'minDistance',
            'activeOffsetX',
            'activeOffsetY',
            'failOffsetX',
            'failOffsetY',
            'simultaneousWithExternalGesture',
            'requireExternalGestureToFail',
        ]
        chainable.forEach(method => {
            builder[method] = () => builder
        })
        return builder
    }
    const Gesture = {
        Pan: createGestureBuilder,
        Tap: createGestureBuilder,
        Pinch: createGestureBuilder,
        LongPress: createGestureBuilder,
        Fling: createGestureBuilder,
        Rotation: createGestureBuilder,
        Native: createGestureBuilder,
        Manual: createGestureBuilder,
        Race: (...gestures: any[]) => gestures[0],
        Simultaneous: (...gestures: any[]) => gestures[0],
        Exclusive: (...gestures: any[]) => gestures[0],
    }
    // The v3 hook API. PWPager uses it so nested swipeables can reference its
    // handler tag, which the deprecated builder only assigns on attach — too
    // late for a descendant to read. A stable object is all the tree needs here.
    let nextHandlerTag = 1
    const createHookGesture = () => ({
        handlerTag: nextHandlerTag++,
        type: 'PanGestureHandler',
        config: {},
        gestureRelations: {
            simultaneousHandlers: [],
            waitFor: [],
            blocksHandlers: [],
        },
    })

    return {
        Gesture,
        usePanGesture: createHookGesture,
        useNativeGesture: createHookGesture,
        useTapGesture: createHookGesture,
        // Composition: PWPager runs one pan per direction so nested content can
        // defer only the direction it needs. The tree just needs a gesture back.
        useCompetingGestures: (...gestures: any[]) => gestures[0],
        useExclusiveGestures: (...gestures: any[]) => gestures[0],
        useSimultaneousGestures: (...gestures: any[]) => gestures[0],
        GestureDetector: ({ children }: any) => children,
        GestureHandlerRootView: MockView,
        Swipeable: MockView,
        DrawerLayout: MockView,
        State: {},
        ScrollView: MockView,
        Slider: MockView,
        Switch: MockView,
        TextInput: MockView,
        ToolbarAndroid: MockView,
        ViewPagerAndroid: MockView,
        DrawerLayoutAndroid: MockView,
        WebView: MockView,
        NativeViewGestureHandler: MockView,
        TapGestureHandler: MockView,
        FlingGestureHandler: MockView,
        ForceTouchGestureHandler: MockView,
        LongPressGestureHandler: MockView,
        PanGestureHandler: MockView,
        PinchGestureHandler: MockView,
        RotationGestureHandler: MockView,
        /* Buttons */
        RawButton: MockView,
        BaseButton: MockView,
        RectButton: MockView,
        BorderlessButton: MockView,
        /* Pressable — wire onPress→onClick; drop the style fn / render-prop
           children that the DOM can't take */
        Pressable: ({ onPress, children, style: _style, ...props }: any) =>
            React.createElement(
                'div',
                { onClick: onPress, ...props },
                typeof children === 'function'
                    ? children({ pressed: false })
                    : children,
            ),
        /* Other */
        FlatList: MockView,
        gestureHandlerRootHOC: vi.fn(),
        Directions: {},
        RefreshControl: MockView,
    }
})

// Stub lottie-react-native globally. It ships untransformed TSX inside its
// commonjs build, which Vitest's external module loader can't parse — any
// transitive import of LottieView throws "Unexpected token 'typeof'" at
// test collection time. Local mocks in component-specific tests still
// override this with their own stubs when they need testID wiring.
vi.mock('lottie-react-native', () => ({
    default: () => null,
}))

// ReanimatedSwipeable registers a codegen native component at import, which neither
// react-native-web nor the unit stubs provide. Rows render their content without the
// swipe actions, which no flow reaches by gesture.
vi.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
    const React = require('react')
    return {
        default: React.forwardRef(
            ({ children }: { children?: unknown }, _ref: unknown) => children,
        ),
    }
})
