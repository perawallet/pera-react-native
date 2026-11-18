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
import React, { type PropsWithChildren } from 'react'
import { act, renderHook } from '@testing-library/react'
import { NavigationContext } from '@react-navigation/native'
import { LockOverlayProvider } from '@hooks/useIsLockOverlayVisible'

const { appStateListeners, appState } = vi.hoisted(() => ({
    appStateListeners: [] as ((state: string) => void)[],
    appState: { currentState: 'active' },
}))

vi.mock('react-native', async importOriginal => ({
    ...(await importOriginal<typeof import('react-native')>()),
    AppState: {
        get currentState() {
            return appState.currentState
        },
        addEventListener: (_type: string, cb: (state: string) => void) => {
            appStateListeners.push(cb)
            return { remove: vi.fn() }
        },
    },
}))

vi.mock('@utils/platform', async importOriginal => ({
    ...(await importOriginal<typeof import('@utils/platform')>()),
    isIOS: () => false,
}))

import {
    HiddenContainerProvider,
    useIsAnimationVisible,
} from '../useIsAnimationVisible'

const emitAppState = (state: string) =>
    act(() => {
        for (const listener of appStateListeners) listener(state)
    })

const createNavigation = (isFocused: boolean) => {
    const listeners: Record<string, (() => void)[]> = { focus: [], blur: [] }
    return {
        navigation: {
            isFocused: () => isFocused,
            addListener: (event: string, cb: () => void) => {
                listeners[event].push(cb)
                return () => undefined
            },
        },
        emit: (event: 'focus' | 'blur') =>
            act(() => {
                for (const cb of listeners[event]) cb()
            }),
    }
}

describe('useIsAnimationVisible', () => {
    beforeEach(() => {
        appStateListeners.length = 0
        appState.currentState = 'active'
    })

    it('is visible in the foreground outside any navigator', () => {
        const { result } = renderHook(() => useIsAnimationVisible())

        expect(result.current).toBe(true)
    })

    it('hides while the app is in the background and shows again on return', () => {
        const { result } = renderHook(() => useIsAnimationVisible())

        emitAppState('background')
        expect(result.current).toBe(false)

        emitAppState('active')
        expect(result.current).toBe(true)
    })

    it('starts hidden when mounted with the app in the background', () => {
        appState.currentState = 'background'

        const { result } = renderHook(() => useIsAnimationVisible())

        expect(result.current).toBe(false)
    })

    it('follows its screen losing and regaining focus', () => {
        const { navigation, emit } = createNavigation(true)
        const wrapper = ({ children }: PropsWithChildren) => (
            <NavigationContext.Provider value={navigation as never}>
                {children}
            </NavigationContext.Provider>
        )
        const { result } = renderHook(() => useIsAnimationVisible(), {
            wrapper,
        })

        emit('blur')
        expect(result.current).toBe(false)

        emit('focus')
        expect(result.current).toBe(true)
    })

    it('starts hidden on a screen that is not focused', () => {
        const { navigation } = createNavigation(false)
        const wrapper = ({ children }: PropsWithChildren) => (
            <NavigationContext.Provider value={navigation as never}>
                {children}
            </NavigationContext.Provider>
        )

        const { result } = renderHook(() => useIsAnimationVisible(), {
            wrapper,
        })

        expect(result.current).toBe(false)
    })

    it('hides behind the lock overlay', () => {
        const wrapper = ({ children }: PropsWithChildren) => (
            <LockOverlayProvider value={true}>{children}</LockOverlayProvider>
        )

        const { result } = renderHook(() => useIsAnimationVisible(), {
            wrapper,
        })

        expect(result.current).toBe(false)
    })

    it('hides inside a hidden container', () => {
        const wrapper = ({ children }: PropsWithChildren) => (
            <HiddenContainerProvider value={true}>
                {children}
            </HiddenContainerProvider>
        )

        const { result } = renderHook(() => useIsAnimationVisible(), {
            wrapper,
        })

        expect(result.current).toBe(false)
    })
})
