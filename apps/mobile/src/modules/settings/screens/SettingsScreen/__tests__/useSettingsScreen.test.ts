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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettingsScreen } from '../useSettingsScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useWebView } from '@modules/webview'
import { useDeleteAllData } from '@modules/settings/hooks/useDeleteAllData'

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@modules/webview', () => ({
    useWebView: vi.fn(),
}))

vi.mock('@modules/settings/hooks/useDeleteAllData', () => ({
    useDeleteAllData: vi.fn(),
    clearAccountsStore: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@modules/settings/components/DeleteAllSuccessContent', () => ({
    DeleteAllSuccessContent: () => null,
}))

vi.mock('@modules/settings/components/RatingsContent', () => ({
    RatingsContent: () => null,
}))

vi.mock('../useSettingsOptions', () => ({
    useSettingsOptions: vi.fn(() => ({
        settingsOptions: [],
    })),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateUniqueId: vi.fn(() => 'mock-uuid'),
    }
})

describe('useSettingsScreen', () => {
    const mockPush = vi.fn()
    const mockPushWebView = vi.fn()
    const mockDeleteAllData = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        vi.clearAllMocks()
        mockRequestBottomSheet.mockResolvedValue(undefined)
        ;(useAppNavigation as Mock).mockReturnValue({
            push: mockPush,
            navigate: vi.fn(),
        })
        ;(useWebView as Mock).mockReturnValue({
            pushWebView: mockPushWebView,
        })
        ;(useDeleteAllData as Mock).mockReturnValue({
            deleteAllData: mockDeleteAllData,
        })
    })

    it('returns settings handlers', () => {
        const { result } = renderHook(() => useSettingsScreen())

        expect(result.current.openDeleteConfirm).toBeDefined()
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

    it('requests the rating bottom sheet when neither route nor url is provided', async () => {
        const { result } = renderHook(() => useSettingsScreen())

        // openRatingModal dynamically imports RatingsContent (kept out of the
        // web bundle) before requesting the sheet, so this crosses a microtask.
        await act(async () => {
            result.current.handleTapEvent({
                title: 'Rate App',
                icon: 'star',
            })
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        expect(arg.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
        })
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockPushWebView).not.toHaveBeenCalled()
    })

    describe('openDeleteConfirm', () => {
        it('opens the confirm sheet but does not delete when user cancels', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() => useSettingsScreen())

            await act(async () => {
                await result.current.openDeleteConfirm()
            })

            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            expect(mockDeleteAllData).not.toHaveBeenCalled()
        })

        it('clears data and shows the success sheet when user confirms', async () => {
            // First call resolves true (confirm), second call is the success sheet.
            mockRequestBottomSheet
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(undefined)
            const { result } = renderHook(() => useSettingsScreen())

            await act(async () => {
                await result.current.openDeleteConfirm()
            })

            expect(mockDeleteAllData).toHaveBeenCalledTimes(1)
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
            const successArg = mockRequestBottomSheet.mock.calls[1][0]
            expect(successArg.options).toEqual({
                size: 'auto',
                enablePanDownToClose: true,
            })
        })
    })
})
