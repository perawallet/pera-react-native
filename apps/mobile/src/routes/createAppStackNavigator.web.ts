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

// Web sibling of createAppStackNavigator.ts. native-stack's web output is an
// instant `display` toggle with no transition; the JS `@react-navigation/stack`
// animates on web once `animation` is set explicitly (its web default is
// 'none'). Page navigators sit at definite heights (the popup is hard-sized),
// so the height-collapse landmine that forces bottom-sheet navigators back to
// native-stack (see SendFundsRoutes.web.tsx) doesn't apply here.
import React from 'react'
import {
    type StackNavigationOptions,
    createStackNavigator,
} from '@react-navigation/stack'
import type { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SCREEN_ANIMATION_DURATION_MS } from '@constants/ui'

const WEB_SCREEN_OPTIONS: StackNavigationOptions = {
    animation: 'slide_from_right',
    transitionSpec: {
        open: {
            animation: 'timing',
            config: { duration: SCREEN_ANIMATION_DURATION_MS },
        },
        close: {
            animation: 'timing',
            config: { duration: SCREEN_ANIMATION_DURATION_MS },
        },
    },
    headerShown: false,
    // Web CardContent defaults to a content-hugging minHeight:'100%' page
    // box (float headers are iOS-only, so pageOverflow is always on).
    // flex:1 bounds each card to its parent's definite height so inner
    // scroll views actually overflow and scroll inside the fixed popup.
    cardStyle: { flex: 1 },
}

// Screen options at the swapped call sites are typed against native-stack, which
// names two things differently from the JS stack.
type NativeStackScreenOptionsCompat = StackNavigationOptions & {
    // native-stack calls the screen background `contentStyle`; the JS stack
    // calls it `cardStyle`. Remapped below so shared screenOptions keep working.
    contentStyle?: StackNavigationOptions['cardStyle']
}

/**
 * Merge caller screenOptions over the web defaults, remapping native-stack keys.
 * Exported for direct unit testing.
 */
export const resolveWebScreenOptions = (
    callerScreenOptions?: NativeStackScreenOptionsCompat,
): StackNavigationOptions => {
    const {
        // native-stack `animation` names carry native semantics — 'default'
        // (what every call site inherits via SCREEN_ANIMATION_CONFIG) resolves
        // to a scale on web. Drop it so the slide default below always wins.
        animation: _nativeAnimation,
        contentStyle,
        ...rest
    } = callerScreenOptions ?? {}

    return {
        ...WEB_SCREEN_OPTIONS,
        ...rest,
        ...(contentStyle !== undefined ? { cardStyle: contentStyle } : {}),
    }
}

// WHY the cast: call sites type the factory as native-stack's generic
// `createNativeStackNavigator<ParamList>()` and pass native-stack screen
// options. At runtime the JS stack ignores native-only keys (statusBar*,
// animationDuration) and we remap the two that clash (animation, contentStyle),
// so the boundary is sound; the cast keeps every call site compiling unchanged.
export const createAppStackNavigator = (() => {
    const stack = createStackNavigator()

    const Navigator = ({
        screenOptions,
        ...rest
    }: {
        screenOptions?:
            | NativeStackScreenOptionsCompat
            | ((args: unknown) => NativeStackScreenOptionsCompat)
    }): React.ReactElement => {
        const resolved =
            typeof screenOptions === 'function'
                ? (args: unknown) =>
                      resolveWebScreenOptions(screenOptions(args))
                : resolveWebScreenOptions(screenOptions)

        return React.createElement(stack.Navigator, {
            ...rest,
            screenOptions: resolved,
        } as React.ComponentProps<typeof stack.Navigator>)
    }

    return { ...stack, Navigator }
}) as unknown as typeof createNativeStackNavigator
