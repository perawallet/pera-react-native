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
import { renderHook, act, waitFor } from '@testing-library/react'
import { AppState, Linking, type AppStateStatus } from 'react-native'

import { useSystemNotificationPermission } from '../useSystemNotificationPermission'

const { getPermissionsAsync } = vi.hoisted(() => ({
    getPermissionsAsync: vi.fn(),
}))

vi.mock('expo-notifications', () => ({ getPermissionsAsync }))

// expo-notifications grants only on iOS `.authorized`; provisional and
// ephemeral come back undetermined.
const respondWith = (status: 'granted' | 'denied' | 'undetermined'): void => {
    getPermissionsAsync.mockResolvedValue({
        status,
        granted: status === 'granted',
    })
}

const appStateListener = (): ((state: AppStateStatus) => void) =>
    vi.mocked(AppState.addEventListener).mock.calls.at(-1)?.[1] as (
        state: AppStateStatus,
    ) => void

describe('useSystemNotificationPermission (native)', () => {
    beforeEach(() => {
        respondWith('granted')
    })

    it('reports enabled once the OS has granted notifications', async () => {
        const { result } = renderHook(() => useSystemNotificationPermission())

        expect(result.current.isLoading).toBe(true)
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isEnabled).toBe(true)
        expect(result.current.isPushServiceUnavailable).toBe(false)
    })

    it.each(['denied', 'undetermined'] as const)(
        'reports disabled when the permission is %s',
        async status => {
            respondWith(status)

            const { result } = renderHook(() =>
                useSystemNotificationPermission(),
            )

            await waitFor(() => expect(result.current.isLoading).toBe(false))
            expect(result.current.isEnabled).toBe(false)
        },
    )

    it('reports disabled when the settings cannot be read', async () => {
        getPermissionsAsync.mockRejectedValue(new Error('unavailable'))

        const { result } = renderHook(() => useSystemNotificationPermission())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isEnabled).toBe(false)
    })

    it('re-reads the permission when the app returns to the foreground', async () => {
        respondWith('denied')
        const { result } = renderHook(() => useSystemNotificationPermission())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        respondWith('granted')
        await act(async () => appStateListener()('active'))

        expect(result.current.isEnabled).toBe(true)
    })

    it('does not re-read the permission when the app goes to the background', async () => {
        const { result } = renderHook(() => useSystemNotificationPermission())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => appStateListener()('background'))

        expect(getPermissionsAsync).toHaveBeenCalledTimes(1)
    })

    it('stops listening to app state on unmount', () => {
        const remove = vi.fn()
        vi.mocked(AppState.addEventListener).mockReturnValueOnce({ remove })
        const { unmount } = renderHook(() => useSystemNotificationPermission())

        unmount()

        expect(remove).toHaveBeenCalledTimes(1)
    })

    it('re-reads the permission on refetch', async () => {
        respondWith('denied')
        const { result } = renderHook(() => useSystemNotificationPermission())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        respondWith('granted')
        await act(() => result.current.refetch())

        expect(result.current.isEnabled).toBe(true)
    })

    it('opens the OS settings', () => {
        const { result } = renderHook(() => useSystemNotificationPermission())

        act(() => result.current.openSettings())

        expect(Linking.openSettings).toHaveBeenCalledTimes(1)
    })
})
