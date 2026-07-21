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
import { renderHook, act } from '@testing-library/react'

const {
    mockSendIntent,
    mockOpenSettings,
    mockCheck,
    mockRequest,
    mockRequestMultiple,
    platformState,
    appStateListeners,
} = vi.hoisted(() => ({
    mockSendIntent: vi.fn(),
    mockOpenSettings: vi.fn(),
    mockCheck: vi.fn(),
    mockRequest: vi.fn(),
    mockRequestMultiple: vi.fn(),
    platformState: { os: 'android' as 'android' | 'ios', version: 33 },
    appStateListeners: [] as Array<(state: string) => void>,
}))

vi.mock('react-native', () => ({
    Platform: {
        get OS() {
            return platformState.os
        },
        get Version() {
            return platformState.version
        },
    },
    Linking: { sendIntent: mockSendIntent, openSettings: mockOpenSettings },
    AppState: {
        addEventListener: (_type: string, cb: (state: string) => void) => {
            appStateListeners.push(cb)
            return { remove: vi.fn() }
        },
    },
    PermissionsAndroid: {
        check: mockCheck,
        request: mockRequest,
        requestMultiple: mockRequestMultiple,
        PERMISSIONS: {
            BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
            BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
            ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
        },
        RESULTS: {
            GRANTED: 'granted',
            DENIED: 'denied',
            NEVER_ASK_AGAIN: 'never_ask_again',
        },
    },
}))

import { useBlePermissions } from '../useBlePermissions'

const LOCATION_INTENT = 'android.settings.LOCATION_SOURCE_SETTINGS'
const SCAN = 'android.permission.BLUETOOTH_SCAN'
const CONNECT = 'android.permission.BLUETOOTH_CONNECT'
const FINE_LOCATION = 'android.permission.ACCESS_FINE_LOCATION'

// Core check/request/blocked logic was previously untested — only
// openLocationSettings had coverage (LRK-022 unit gap).
describe('useBlePermissions core permission logic', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        appStateListeners.length = 0
        platformState.os = 'android'
        platformState.version = 33
        mockCheck.mockResolvedValue(true)
    })

    it('reports granted after the mount check when every Android 12+ permission is held', async () => {
        const { result } = renderHook(() => useBlePermissions())

        expect(result.current.isChecking).toBe(true)

        await act(async () => {})

        expect(mockCheck).toHaveBeenCalledWith(SCAN)
        expect(mockCheck).toHaveBeenCalledWith(CONNECT)
        expect(result.current.hasPermissions).toBe(true)
        expect(result.current.isChecking).toBe(false)
    })

    it('reports missing permissions when one Android 12+ permission is not held', async () => {
        mockCheck.mockImplementation(async permission => permission === SCAN)

        const { result } = renderHook(() => useBlePermissions())
        await act(async () => {})

        expect(result.current.hasPermissions).toBe(false)
        expect(result.current.isChecking).toBe(false)
    })

    it('checks only fine location below Android 12', async () => {
        platformState.version = 29

        const { result } = renderHook(() => useBlePermissions())
        await act(async () => {})

        expect(mockCheck).toHaveBeenCalledTimes(1)
        expect(mockCheck).toHaveBeenCalledWith(FINE_LOCATION)
        expect(result.current.hasPermissions).toBe(true)
    })

    it('grants permissions when the Android 12+ runtime request is accepted', async () => {
        mockCheck.mockResolvedValue(false)
        mockRequestMultiple.mockResolvedValue({
            [SCAN]: 'granted',
            [CONNECT]: 'granted',
        })

        const { result } = renderHook(() => useBlePermissions())
        await act(async () => {})

        let granted = false
        await act(async () => {
            granted = await result.current.requestPermissions()
        })

        expect(mockRequestMultiple).toHaveBeenCalledWith([SCAN, CONNECT])
        expect(granted).toBe(true)
        expect(result.current.hasPermissions).toBe(true)
        expect(result.current.isBlocked).toBe(false)
    })

    it('stays denied without blocking when the user declines the request', async () => {
        mockCheck.mockResolvedValue(false)
        mockRequestMultiple.mockResolvedValue({
            [SCAN]: 'granted',
            [CONNECT]: 'denied',
        })

        const { result } = renderHook(() => useBlePermissions())
        await act(async () => {})

        let granted = true
        await act(async () => {
            granted = await result.current.requestPermissions()
        })

        expect(granted).toBe(false)
        expect(result.current.hasPermissions).toBe(false)
        expect(result.current.isBlocked).toBe(false)
    })

    it('reports blocked when a permission resolves never-ask-again', async () => {
        mockCheck.mockResolvedValue(false)
        mockRequestMultiple.mockResolvedValue({
            [SCAN]: 'never_ask_again',
            [CONNECT]: 'denied',
        })

        const { result } = renderHook(() => useBlePermissions())
        await act(async () => {})

        await act(async () => {
            await result.current.requestPermissions()
        })

        expect(result.current.hasPermissions).toBe(false)
        expect(result.current.isBlocked).toBe(true)
    })

    it('requests only fine location below Android 12 and blocks on never-ask-again', async () => {
        platformState.version = 29
        mockCheck.mockResolvedValue(false)
        mockRequest.mockResolvedValue('never_ask_again')

        const { result } = renderHook(() => useBlePermissions())
        await act(async () => {})

        await act(async () => {
            await result.current.requestPermissions()
        })

        expect(mockRequest).toHaveBeenCalledWith(FINE_LOCATION)
        expect(mockRequestMultiple).not.toHaveBeenCalled()
        expect(result.current.isBlocked).toBe(true)
    })

    it('treats iOS as granted without touching Android permission APIs', async () => {
        platformState.os = 'ios'

        const { result } = renderHook(() => useBlePermissions())

        expect(result.current.hasPermissions).toBe(true)
        expect(result.current.isChecking).toBe(false)

        let granted = false
        await act(async () => {
            granted = await result.current.requestPermissions()
        })

        expect(granted).toBe(true)
        expect(mockCheck).not.toHaveBeenCalled()
        expect(mockRequestMultiple).not.toHaveBeenCalled()
    })

    it('re-checks on foreground so a grant made in OS settings clears denied and blocked state', async () => {
        mockCheck.mockResolvedValue(false)
        mockRequestMultiple.mockResolvedValue({
            [SCAN]: 'never_ask_again',
            [CONNECT]: 'never_ask_again',
        })

        const { result } = renderHook(() => useBlePermissions())
        await act(async () => {})
        await act(async () => {
            await result.current.requestPermissions()
        })
        expect(result.current.hasPermissions).toBe(false)
        expect(result.current.isBlocked).toBe(true)

        // User flips the toggle in OS settings and returns to the app.
        mockCheck.mockResolvedValue(true)
        await act(async () => {
            for (const listener of appStateListeners) listener('active')
        })

        expect(result.current.hasPermissions).toBe(true)
        expect(result.current.isBlocked).toBe(false)
    })
})

describe('useBlePermissions.openLocationSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        platformState.os = 'android'
        platformState.version = 33
        mockCheck.mockResolvedValue(true)
        mockSendIntent.mockResolvedValue(undefined)
        mockOpenSettings.mockResolvedValue(undefined)
    })

    it('deep-links straight to the OS location screen on Android', async () => {
        const { result } = renderHook(() => useBlePermissions())

        await act(async () => {
            await result.current.openLocationSettings()
        })

        expect(mockSendIntent).toHaveBeenCalledWith(LOCATION_INTENT)
        expect(mockOpenSettings).not.toHaveBeenCalled()
    })

    it('falls back to app settings when the location intent is unavailable', async () => {
        mockSendIntent.mockRejectedValue(new Error('no activity'))

        const { result } = renderHook(() => useBlePermissions())

        await act(async () => {
            await result.current.openLocationSettings()
        })

        expect(mockSendIntent).toHaveBeenCalledWith(LOCATION_INTENT)
        expect(mockOpenSettings).toHaveBeenCalledTimes(1)
    })

    it('opens app settings without the Android intent on iOS', async () => {
        platformState.os = 'ios'

        const { result } = renderHook(() => useBlePermissions())

        await act(async () => {
            await result.current.openLocationSettings()
        })

        expect(mockSendIntent).not.toHaveBeenCalled()
        expect(mockOpenSettings).toHaveBeenCalledTimes(1)
    })
})
