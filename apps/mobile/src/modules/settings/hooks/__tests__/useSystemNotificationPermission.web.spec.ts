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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const openExternalTabMock = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    openExternalTab: openExternalTabMock,
}))

import { useSystemNotificationPermission } from '../useSystemNotificationPermission.web'

const setPermission = (permission: string): void => {
    Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        value: { permission },
    })
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useSystemNotificationPermission (web)', () => {
    // The notifee web shim this replaces is a hardcoded DENIED stub, which
    // would have rendered the switch off even though the manifest's
    // `notifications` permission auto-grants it.
    it('reports enabled when the browser has granted notifications', async () => {
        setPermission('granted')

        const { result } = renderHook(() => useSystemNotificationPermission())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isEnabled).toBe(true)
    })

    it('reports disabled when the browser has denied notifications', async () => {
        setPermission('denied')

        const { result } = renderHook(() => useSystemNotificationPermission())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isEnabled).toBe(false)
    })

    it('re-reads the permission when the surface becomes visible again', async () => {
        setPermission('denied')
        const { result } = renderHook(() => useSystemNotificationPermission())
        await waitFor(() => expect(result.current.isEnabled).toBe(false))

        setPermission('granted')
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'))
            await Promise.resolve()
        })

        expect(result.current.isEnabled).toBe(true)
    })

    // react-native-web has no Linking.openSettings, so the native hook's
    // implementation would throw a TypeError on tap.
    it('opens Chrome notification settings instead of Linking.openSettings', async () => {
        setPermission('granted')
        const { result } = renderHook(() => useSystemNotificationPermission())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => {
            result.current.openSettings()
        })

        expect(openExternalTabMock).toHaveBeenCalledWith(
            'chrome://settings/content/notifications',
        )
    })
})
