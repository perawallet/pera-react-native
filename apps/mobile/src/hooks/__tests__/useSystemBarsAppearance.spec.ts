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

import { renderHook } from '@testing-library/react'
import { Platform } from 'react-native'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSetStyle, mockSetStatusBarStyle } = vi.hoisted(() => ({
    mockSetStyle: vi.fn(),
    mockSetStatusBarStyle: vi.fn(),
}))

vi.mock('expo-navigation-bar', () => ({
    NavigationBar: { setStyle: mockSetStyle },
}))

vi.mock('expo-status-bar', () => ({
    setStatusBarStyle: mockSetStatusBarStyle,
}))

import { useSystemBarsAppearance } from '../useSystemBarsAppearance'

describe('useSystemBarsAppearance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Platform.OS = 'android'
    })

    it('asks for dark icons when the app renders a light surface', () => {
        renderHook(() => useSystemBarsAppearance(false))

        expect(mockSetStatusBarStyle).toHaveBeenCalledWith('dark')
        expect(mockSetStyle).toHaveBeenCalledWith('dark')
    })

    it('asks for light icons when the app renders a dark surface', () => {
        renderHook(() => useSystemBarsAppearance(true))

        expect(mockSetStatusBarStyle).toHaveBeenCalledWith('light')
        expect(mockSetStyle).toHaveBeenCalledWith('light')
    })

    it('follows the in-app theme when it diverges from the system scheme', () => {
        const { rerender } = renderHook(
            ({ isDarkMode }) => useSystemBarsAppearance(isDarkMode),
            { initialProps: { isDarkMode: true } },
        )
        mockSetStyle.mockClear()

        rerender({ isDarkMode: false })

        expect(mockSetStyle).toHaveBeenCalledWith('dark')
    })

    // Touching the status bar off Android is not merely redundant: it trips
    // RCTStatusBarManager, which refuses to run while react-native-screens owns
    // the iOS status bar via UIViewControllerBasedStatusBarAppearance.
    it('leaves both bars alone off Android', () => {
        Platform.OS = 'ios'

        renderHook(() => useSystemBarsAppearance(false))

        expect(mockSetStatusBarStyle).not.toHaveBeenCalled()
        expect(mockSetStyle).not.toHaveBeenCalled()
    })
})
