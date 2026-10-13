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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const { mockCanGoBack, mockGoBack, mockCloseCurrentTab, focusEffects } =
    vi.hoisted(() => ({
        mockCanGoBack: vi.fn(),
        mockGoBack: vi.fn(),
        mockCloseCurrentTab: vi.fn(),
        focusEffects: { current: [] as Array<() => void> },
    }))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ canGoBack: mockCanGoBack, goBack: mockGoBack }),
    useFocusEffect: (effect: () => void) => {
        focusEffects.current.push(effect)
    },
}))
vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    closeCurrentTab: () => mockCloseCurrentTab(),
}))
vi.mock('@routes/navigationRef', () => ({
    navigationRef: { getCurrentRoute: () => ({ name: 'ScanQR' }) },
}))

import { useScanQRScreen } from '../useScanQRScreen.web'

const focus = () => act(() => focusEffects.current.at(-1)?.())

describe('useScanQRScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        focusEffects.current = []
    })

    it('restarts the scanner when the screen regains focus, not on mount', () => {
        const { result } = renderHook(() => useScanQRScreen())

        focus()
        expect(result.current.restartKey).toBe(0)

        focus()
        expect(result.current.restartKey).toBe(1)
    })

    it('closes the tab when the scanner is the only screen in it', () => {
        mockCanGoBack.mockReturnValue(false)
        const { result } = renderHook(() => useScanQRScreen())

        result.current.handleClose()

        expect(mockCloseCurrentTab).toHaveBeenCalledTimes(1)
        expect(mockGoBack).not.toHaveBeenCalled()
    })

    it('pops back when there is a screen under the scanner', () => {
        mockCanGoBack.mockReturnValue(true)
        const { result } = renderHook(() => useScanQRScreen())

        result.current.handleClose()

        expect(mockGoBack).toHaveBeenCalledTimes(1)
        expect(mockCloseCurrentTab).not.toHaveBeenCalled()
    })
})
