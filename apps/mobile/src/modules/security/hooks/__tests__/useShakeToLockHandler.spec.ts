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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type AppStateListener = (state: 'active' | 'background' | 'inactive') => void

const mocks = vi.hoisted(() => ({
    getBooleanValue: vi.fn<(key: string, fallback: boolean) => boolean>(),
    getPreference: vi.fn<(key: string) => unknown>(),
    checkPinEnabled: vi.fn<() => Promise<boolean>>(),
    requestLock: vi.fn<() => void>(),
    useShakeDetection:
        vi.fn<(args: { enabled: boolean; onTrigger: () => void }) => void>(),
    appStateListeners: [] as AppStateListener[],
    currentAppState: 'active' as 'active' | 'background' | 'inactive',
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: () => ({
        getBooleanValue: mocks.getBooleanValue,
    }),
    RemoteConfigKeys: {
        enable_motion_lock: 'enable_motion_lock',
    },
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mocks.checkPinEnabled }),
    useSecurityStore: (
        selector: (state: { requestLock: () => void }) => unknown,
    ) => selector({ requestLock: mocks.requestLock }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({ getPreference: mocks.getPreference }),
}))

vi.mock('@modules/security/hooks/useShakeDetection', () => ({
    useShakeDetection: mocks.useShakeDetection,
}))

vi.mock('react-native', () => ({
    AppState: {
        get currentState() {
            return mocks.currentAppState
        },
        addEventListener: (_event: string, listener: AppStateListener) => {
            mocks.appStateListeners.push(listener)
            return {
                remove: () => {
                    const idx = mocks.appStateListeners.indexOf(listener)
                    if (idx >= 0) mocks.appStateListeners.splice(idx, 1)
                },
            }
        },
    },
}))

import { useShakeToLockHandler } from '../useShakeToLockHandler'

const lastDetectorCall = () => {
    const calls = mocks.useShakeDetection.mock.calls
    return calls[calls.length - 1]?.[0]
}

const setupHappyPathDefaults = () => {
    mocks.getBooleanValue.mockImplementation(
        (_key: string, fallback: boolean) => fallback,
    )
    mocks.getPreference.mockReturnValue(undefined)
    mocks.checkPinEnabled.mockResolvedValue(false)
}

describe('useShakeToLockHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.appStateListeners.length = 0
        mocks.currentAppState = 'active'
        setupHappyPathDefaults()
    })

    test('detector is disabled when the remote flag is off', async () => {
        mocks.getBooleanValue.mockReturnValue(false)
        mocks.getPreference.mockReturnValue(true)
        mocks.checkPinEnabled.mockResolvedValue(true)

        renderHook(() => useShakeToLockHandler())

        await waitFor(() => {
            expect(lastDetectorCall()?.enabled).toBe(false)
        })
    })

    test('detector is disabled when the user preference is off', async () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getPreference.mockReturnValue(false)
        mocks.checkPinEnabled.mockResolvedValue(true)

        renderHook(() => useShakeToLockHandler())

        await waitFor(() => {
            expect(lastDetectorCall()?.enabled).toBe(false)
        })
    })

    test('detector is disabled when no PIN is set', async () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getPreference.mockReturnValue(true)
        mocks.checkPinEnabled.mockResolvedValue(false)

        renderHook(() => useShakeToLockHandler())

        await waitFor(() => {
            expect(mocks.checkPinEnabled).toHaveBeenCalled()
            expect(lastDetectorCall()?.enabled).toBe(false)
        })
    })

    test('detector is enabled when flag + preference + PIN + foreground all line up', async () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getPreference.mockReturnValue(true)
        mocks.checkPinEnabled.mockResolvedValue(true)

        renderHook(() => useShakeToLockHandler())

        await waitFor(() => {
            expect(lastDetectorCall()?.enabled).toBe(true)
        })
    })

    test('detector trigger calls requestLock on the security store', async () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getPreference.mockReturnValue(true)
        mocks.checkPinEnabled.mockResolvedValue(true)

        renderHook(() => useShakeToLockHandler())

        await waitFor(() => {
            expect(lastDetectorCall()?.enabled).toBe(true)
        })

        act(() => {
            lastDetectorCall()?.onTrigger()
        })

        expect(mocks.requestLock).toHaveBeenCalledTimes(1)
    })

    test('detector disables when the app moves to the background', async () => {
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getPreference.mockReturnValue(true)
        mocks.checkPinEnabled.mockResolvedValue(true)

        renderHook(() => useShakeToLockHandler())

        await waitFor(() => {
            expect(lastDetectorCall()?.enabled).toBe(true)
        })

        act(() => {
            for (const listener of mocks.appStateListeners) {
                listener('background')
            }
        })

        await waitFor(() => {
            expect(lastDetectorCall()?.enabled).toBe(false)
        })
    })

    test('detector is initially disabled when mounted while backgrounded', async () => {
        mocks.currentAppState = 'background'
        mocks.getBooleanValue.mockReturnValue(true)
        mocks.getPreference.mockReturnValue(true)
        mocks.checkPinEnabled.mockResolvedValue(true)

        renderHook(() => useShakeToLockHandler())

        await waitFor(() => {
            expect(mocks.checkPinEnabled).toHaveBeenCalled()
        })

        // PIN check resolved true, but isForeground was seeded to false at
        // mount because AppState.currentState was 'background' — net result
        // is that the detector must stay disabled until the app comes back.
        expect(lastDetectorCall()?.enabled).toBe(false)
    })
})
