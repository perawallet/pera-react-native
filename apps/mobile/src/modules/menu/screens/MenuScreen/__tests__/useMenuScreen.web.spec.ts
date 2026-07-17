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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNavigation } from '@react-navigation/native'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { trackEvent, MenuEvent } from '@analytics'
import { useMenuScreen } from '../useMenuScreen.web'

const useNavigationMock = vi.mocked(useNavigation)
const getSurfaceMock = vi.mocked(getSurface)
const trackEventMock = vi.mocked(trackEvent)

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: vi.fn(),
}))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    MenuEvent: { QrScan: 'QrScan' },
}))

describe('useMenuScreen (web)', () => {
    const navigate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        useNavigationMock.mockReturnValue({ navigate } as never)
    })

    it('opens the sheet scanner from the popup instead of navigating', () => {
        getSurfaceMock.mockReturnValue('popup' as never)
        const { result } = renderHook(() => useMenuScreen())

        act(() => {
            result.current.openScanner()
        })

        expect(result.current.isScannerVisible).toBe(true)
        expect(navigate).not.toHaveBeenCalled()
        expect(trackEventMock).toHaveBeenCalledWith(MenuEvent.QrScan)
    })

    it('navigates to the ScanQR route outside the popup', () => {
        getSurfaceMock.mockReturnValue('expanded' as never)
        const { result } = renderHook(() => useMenuScreen())

        act(() => {
            result.current.openScanner()
        })

        expect(navigate).toHaveBeenCalledWith('ScanQR')
        expect(result.current.isScannerVisible).toBe(false)
        expect(trackEventMock).toHaveBeenCalledWith(MenuEvent.QrScan)
    })

    it('closes the sheet scanner via closeScanner', () => {
        getSurfaceMock.mockReturnValue('popup' as never)
        const { result } = renderHook(() => useMenuScreen())

        act(() => {
            result.current.openScanner()
        })
        expect(result.current.isScannerVisible).toBe(true)

        act(() => {
            result.current.closeScanner()
        })
        expect(result.current.isScannerVisible).toBe(false)
    })
})
