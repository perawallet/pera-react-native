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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettingsScreen } from '../useSettingsScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'
import { useModalState } from '@hooks/useModalState'

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(),
}))

vi.mock('@modules/webview', () => ({
    useWebView: vi.fn(),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(),
}))

vi.mock('../useSettingsOptions', () => ({
    useSettingsOptions: vi.fn(() => ({
        settingsOptions: [],
    })),
}))

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid'),
}))

describe('useSettingsScreen', () => {
    const mockPush = vi.fn()
    const mockPushWebView = vi.fn()
    const mockOpenModal = vi.fn()
    const mockCloseModal = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useAppNavigation as Mock).mockReturnValue({
            push: mockPush,
        })
        ;(useWebView as Mock).mockReturnValue({
            pushWebView: mockPushWebView,
        })
        ;(useModalState as Mock).mockReturnValue({
            isOpen: false,
            open: mockOpenModal,
            close: mockCloseModal,
        })
    })

    it('returns modal state and handlers', () => {
        const { result } = renderHook(() => useSettingsScreen())

        expect(result.current.isDeleteModalOpen).toBeDefined()
        expect(result.current.openDeleteModal).toBeDefined()
        expect(result.current.closeDeleteModal).toBeDefined()
        expect(result.current.isRatingModalOpen).toBeDefined()
        expect(result.current.closeRatingModal).toBeDefined()
        expect(result.current.settingsOptions).toBeDefined()
        expect(result.current.handleTapEvent).toBeDefined()
    })

    it('navigates to settings page when route is provided', () => {
        const { result } = renderHook(() => useSettingsScreen())

        act(() => {
            result.current.handleTapEvent({
                title: 'Security',
                icon: 'shield',
                route: 'SecuritySettings',
            })
        })

        expect(mockPush).toHaveBeenCalledWith('SecuritySettings')
        expect(mockPushWebView).not.toHaveBeenCalled()
    })

    it('opens webview when url is provided', () => {
        const { result } = renderHook(() => useSettingsScreen())

        act(() => {
            result.current.handleTapEvent({
                title: 'Support',
                icon: 'help',
                url: 'https://support.example.com',
            })
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.example.com',
            id: 'mock-uuid',
        })
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('opens rating modal when neither route nor url is provided', () => {
        const { result } = renderHook(() => useSettingsScreen())

        act(() => {
            result.current.handleTapEvent({
                title: 'Rate App',
                icon: 'star',
            })
        })

        // The second useModalState call is for rating modal, so open is called
        expect(mockOpenModal).toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})
