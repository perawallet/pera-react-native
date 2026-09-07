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

// In-memory React-Navigation stand-in for integration tests: the production
// native-stack navigator needs layout APIs that don't run under jsdom, and the
// unit-test mock only ever renders the initial screen — useless for flow tests
// that navigate.
//
// This keeps a real route stack in React state behind the same
// `useNavigation`/`useRoute`/`createNativeStackNavigator` surface, so
// `navigate(name)` actually re-renders. Wired in by
// vitest.integration-setup.ts.

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
import type { Optional } from '@perawallet/wallet-core-shared'

// Types

type RouteState = {
    name: string
    // Mirrors production @react-navigation: a route reached without params has
    // `params === undefined`, not `{}`. Screens that branch on params
    // truthiness (e.g. import-vs-create flows) depend on this distinction.
    params: Optional<Record<string, unknown>>
    key: string
}

type NavigateAction = (name: string, params?: Record<string, unknown>) => void

type NavigationApi = {
    navigate: NavigateAction
    push: NavigateAction
    replace: NavigateAction
    goBack: () => void
    pop: (count?: number) => void
    popToTop: () => void
    canGoBack: () => boolean
    setParams: (params: Record<string, unknown>) => void
    isReady: () => boolean
    isFocused: () => boolean
    addListener: (event: string, listener: () => void) => () => void
    dispatch: (action: unknown) => void
    reset: (state: unknown) => void
    setOptions: (options: unknown) => void
    getParent: () => Optional<NavigationApi>
    getState: () => { routes: RouteState[]; index: number }
}

type ScreenConfig = {
    name: string
    component: React.ComponentType<Record<string, unknown>>
    initialParams?: Record<string, unknown>
}

// Contexts

type StackController = {
    stack: RouteState[]
    setStack: React.Dispatch<React.SetStateAction<RouteState[]>>
    routeListeners: Set<(route: RouteState) => void>
}

const StackContext = createContext<StackController | null>(null)
const RouteContext = createContext<RouteState | null>(null)

// Most recently rendered navigator's controller. Bottom-sheet content mounts
// in a portal OUTSIDE the navigator (production routes those navigations via
// `navigationRef`), so `useNavigation` there has no StackContext — fall back
// to this so sheet-initiated flows can still drive the stack under test.
let activeController: StackController | null = null

let routeKeySeq = 0
const newRouteKey = (): string => `route-${++routeKeySeq}`

// Navigation hook

const noopApi: NavigationApi = {
    navigate: () => {},
    push: () => {},
    replace: () => {},
    goBack: () => {},
    pop: () => {},
    popToTop: () => {},
    canGoBack: () => false,
    setParams: () => {},
    isReady: () => true,
    isFocused: () => true,
    addListener: () => () => {},
    dispatch: () => {},
    reset: () => {},
    setOptions: () => {},
    getParent: () => undefined,
    getState: () => ({ routes: [], index: 0 }),
}

const buildNavigationApi = (controller: StackController): NavigationApi => {
    const navigate: NavigateAction = (name, params) => {
        controller.setStack(prev => {
            // Production behavior: if `navigate` lands on a route already in
            // the stack, it pops back to it instead of pushing a duplicate.
            const existing = prev.findIndex(r => r.name === name)
            if (existing !== -1) {
                const trimmed = prev.slice(0, existing + 1)
                const prevParams = trimmed[trimmed.length - 1].params
                const merged = {
                    ...trimmed[trimmed.length - 1],
                    params:
                        params || prevParams
                            ? { ...prevParams, ...params }
                            : undefined,
                }
                return [...trimmed.slice(0, -1), merged]
            }
            return [...prev, { name, params, key: newRouteKey() }]
        })
    }

    const push: NavigateAction = (name, params) => {
        controller.setStack(prev => [
            ...prev,
            { name, params, key: newRouteKey() },
        ])
    }

    const replace: NavigateAction = (name, params) => {
        controller.setStack(prev =>
            prev.length === 0
                ? [{ name, params, key: newRouteKey() }]
                : [...prev.slice(0, -1), { name, params, key: newRouteKey() }],
        )
    }

    const goBack = () => {
        controller.setStack(prev =>
            prev.length > 1 ? prev.slice(0, -1) : prev,
        )
    }

    const pop = (count = 1) => {
        controller.setStack(prev => {
            const target = Math.max(1, prev.length - count)
            return prev.slice(0, target)
        })
    }

    const popToTop = () => {
        controller.setStack(prev => (prev.length > 0 ? [prev[0]] : prev))
    }

    const canGoBack = () => controller.stack.length > 1

    const setParams = (params: Record<string, unknown>) => {
        controller.setStack(prev => {
            if (prev.length === 0) return prev
            const last = prev[prev.length - 1]
            return [
                ...prev.slice(0, -1),
                { ...last, params: { ...last.params, ...params } },
            ]
        })
    }

    // Production `reset` replaces the whole stack with the given state's
    // `routes`. The navigator renders the last route, so mapping `routes`
    // onto the stack is enough — `index` doesn't affect what's shown.
    const reset = (state: unknown) => {
        const next = state as {
            routes?: Array<{
                name: string
                params?: Record<string, unknown>
                key?: string
            }>
        }
        if (!next?.routes?.length) return
        controller.setStack(
            next.routes.map(r => ({
                name: r.name,
                params: r.params,
                key: r.key ?? newRouteKey(),
            })),
        )
    }

    return {
        navigate,
        push,
        replace,
        goBack,
        pop,
        popToTop,
        canGoBack,
        setParams,
        isReady: () => true,
        // The harness only renders the top route, so running code is focused.
        isFocused: () => true,
        addListener: () => () => {},
        dispatch: () => {},
        reset,
        setOptions: () => {},
        getParent: () => undefined,
        getState: () => ({
            routes: controller.stack,
            index: Math.max(0, controller.stack.length - 1),
        }),
    }
}

export const useNavigation = <_T = NavigationApi,>(): NavigationApi => {
    const contextController = useContext(StackContext)
    const controller = contextController ?? activeController
    return useMemo(
        () => (controller ? buildNavigationApi(controller) : noopApi),
        // The api is a fresh object each render because stack mutations
        // shouldn't be cached — but the stable identities of methods are
        // typically what tests assert on (e.g. `expect(navigate).toHaveBeenCalled`).
        // Returning a fresh object is consistent with react-navigation's behavior.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [controller, controller?.stack],
    )
}

export const useRoute = <_T = RouteState,>(): RouteState => {
    const route = useContext(RouteContext)
    return route ?? { name: '__no_route__', params: {}, key: 'no-route' }
}

export const useFocusEffect = (cb: () => void | (() => void)): void => {
    useEffect(() => {
        const cleanup = cb()
        return typeof cleanup === 'function' ? cleanup : undefined
        // Only re-run when the route changes, matching production semantics.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useRoute().key])
}

export const useIsFocused = (): boolean => true

export const useNavigationState = <T,>(selector?: (state: unknown) => T): T => {
    const controller = useContext(StackContext)
    const state = {
        routes: controller?.stack ?? [],
        index: Math.max(0, (controller?.stack.length ?? 1) - 1),
    }
    return (selector ? selector(state) : state) as T
}

// Container + Independent tree

export const NavigationContainer: React.FC<{
    children: React.ReactNode
}> = ({ children }) => <>{children}</>

export const NavigationIndependentTree: React.FC<{
    children: React.ReactNode
}> = ({ children }) => <>{children}</>

export const createNavigationContainerRef = () => ({
    navigate: () => {},
    dispatch: () => {},
    reset: () => {},
    goBack: () => {},
    isReady: () => true,
    current: null,
})

// Bottom-sheet hosts wrap their portal children with
// `<NavigationContainerRefContext.Provider value={navigationRef}>` (see
// apps/mobile/src/modules/bottom-sheet/components/BottomSheetHost/BottomSheetHost.tsx)
// so navigation hooks keep working across the portal. The integration mock
// replaces `@react-navigation/native` wholesale with this module, so we need
// to export the context — without it, the import is `undefined` and rendering
// the bottom-sheet host throws.
export const NavigationContainerRefContext = createContext<unknown>(null)

export const StackActions = {
    replace: (name: string, params?: Record<string, unknown>) => ({
        type: 'REPLACE' as const,
        payload: { name, params },
    }),
    push: (name: string, params?: Record<string, unknown>) => ({
        type: 'PUSH' as const,
        payload: { name, params },
    }),
    pop: (count?: number) => ({
        type: 'POP' as const,
        payload: { count },
    }),
    popToTop: () => ({ type: 'POP_TO_TOP' as const }),
}

export const DefaultTheme = {
    dark: false,
    colors: {
        primary: 'blue',
        background: 'white',
        card: 'white',
        text: 'black',
        border: 'gray',
        notification: 'red',
    },
}

export const DarkTheme = { ...DefaultTheme, dark: true }

// Native stack — the bit that hosts screens

type NavigatorProps = {
    initialRouteName?: string
    children: React.ReactNode
    // Any other production options — accepted but ignored.
    screenOptions?: unknown
    screenListeners?: unknown
    id?: string
}

const collectScreens = (children: React.ReactNode): ScreenConfig[] => {
    const screens: ScreenConfig[] = []
    React.Children.forEach(children, child => {
        if (!React.isValidElement(child)) return
        const props = child.props as Record<string, unknown>
        if (
            typeof props.name === 'string' &&
            (typeof props.component === 'function' ||
                typeof props.children === 'function')
        ) {
            const component =
                (props.component as React.ComponentType<
                    Record<string, unknown>
                >) ??
                (props.children as React.ComponentType<Record<string, unknown>>)
            screens.push({
                name: props.name,
                component,
                initialParams: props.initialParams as Optional<
                    Record<string, unknown>
                >,
            })
        }
        // Recurse into Group / Fragment children
        if (props.children && typeof props.children !== 'function') {
            screens.push(...collectScreens(props.children as React.ReactNode))
        }
    })
    return screens
}

export const createNativeStackNavigator = () => {
    const Navigator: React.FC<NavigatorProps> = ({
        initialRouteName,
        children,
    }) => {
        const screens = useMemo(() => collectScreens(children), [children])
        if (screens.length === 0) {
            return (
                <div data-testid='test-navigator-empty'>
                    No screens registered
                </div>
            )
        }

        const initialName = initialRouteName ?? screens[0].name
        const initialScreen = screens.find(s => s.name === initialName)

        const [stack, setStack] = useState<RouteState[]>(() => [
            {
                name: initialName,
                params: initialScreen?.initialParams,
                key: newRouteKey(),
            },
        ])

        const controller: StackController = useMemo(
            () => ({
                stack,
                setStack,
                routeListeners: new Set(),
            }),
            [stack],
        )

        // Keep the portal fallback pointing at the live controller; clear it
        // on unmount so a later render can't dispatch into a dead navigator.
        activeController = controller
        useEffect(
            () => () => {
                activeController = null
            },
            [],
        )

        const currentRoute = stack[stack.length - 1]
        const screenForCurrent = screens.find(s => s.name === currentRoute.name)
        const ScreenComponent = screenForCurrent?.component

        if (!ScreenComponent) {
            return (
                <div data-testid='test-navigator-no-route'>
                    No route registered: {currentRoute.name}
                </div>
            )
        }

        // React-Navigation passes both `route` and `navigation` to the
        // screen component as props. Many screens read via `useRoute()`
        // (which the RouteContext above serves), but some destructure
        // route directly from props — typed as
        // `NativeStackScreenProps<...>` — and crash without them. Pass
        // them through so both styles mount cleanly.
        const navigationApi = buildNavigationApi(controller)
        return (
            <StackContext.Provider value={controller}>
                <RouteContext.Provider value={currentRoute}>
                    <ScreenComponent
                        route={currentRoute}
                        navigation={navigationApi}
                    />
                </RouteContext.Provider>
            </StackContext.Provider>
        )
    }

    // `Screen` and `Group` are inert — they exist only so consumers can declare
    // routes via JSX. The Navigator reads their props directly via React.Children.
    const Screen: React.FC<{
        name: string
        component: React.ComponentType<Record<string, unknown>>
        initialParams?: Record<string, unknown>
        options?: unknown
    }> = () => null

    const Group: React.FC<{ children: React.ReactNode }> = () => null

    return { Navigator, Screen, Group }
}

export const createNavigatorFactory = createNativeStackNavigator

// Test helpers

/**
 * Synchronously read the current route from outside React (e.g. inside `await
 * waitFor(...)` callbacks where calling a hook would error). Returns the
 * deepest route in the active stack.
 */
export const getCurrentRoute = (): RouteState | null => {
    // The Stack mounts a single navigator, so the current route is the last
    // entry of the most-recently-rendered stack. We can't easily snapshot
    // that without a React render — tests should drive routes via the
    // navigation API on the rendered components and assert on what's on
    // screen.
    return null
}
