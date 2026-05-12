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

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { render, type CustomRenderOptions } from './render'

type ScreenComponent = React.ComponentType<any>

type NavigationStackEntry = {
    name: string
    component: ScreenComponent
    params?: object
}

export type RenderWithNavigationOptions = Omit<
    CustomRenderOptions,
    'bare' | 'navigationProps'
> & {
    /**
     * Additional screens to register in the stack so navigation between them
     * works end-to-end (e.g. assert that pressing "Back" returns to the
     * previous screen). The first entry is the initial route.
     */
    additionalScreens?: NavigationStackEntry[]
    /** Initial route name (defaults to the primary screen). */
    initialRouteName?: string
    /** Initial route params. */
    initialParams?: object
}

const Stack = createNativeStackNavigator()

/**
 * Mounts a screen inside a real `@react-navigation/native-stack` navigator so
 * `navigation.navigate(...)`, `navigation.goBack(...)`, and route params all
 * work as they do in the running app. Reuses the provider tree from
 * `render()` (theme, query client, wallet provider, safe area).
 *
 * Use this for integration tests that exercise a user flow across one or more
 * screens. For pure component tests, prefer `render(...)` directly.
 */
export const renderWithNavigation = (
    PrimaryScreen: ScreenComponent,
    primaryName: string,
    {
        additionalScreens = [],
        initialRouteName,
        initialParams,
        ...renderOptions
    }: RenderWithNavigationOptions = {},
) => {
    const App = () => (
        <Stack.Navigator
            initialRouteName={initialRouteName ?? primaryName}
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen
                name={primaryName}
                component={PrimaryScreen}
                initialParams={initialParams}
            />
            {additionalScreens.map(s => (
                <Stack.Screen
                    key={s.name}
                    name={s.name}
                    component={s.component}
                    initialParams={s.params}
                />
            ))}
        </Stack.Navigator>
    )

    return render(<App />, renderOptions)
}
