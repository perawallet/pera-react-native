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
import { AppState, type AppStateStatus } from 'react-native'

import { useTokenListener } from '../useTokenListener'

import type { PushTokenRefreshListener } from '@perawallet/wallet-extension-platform'

const mocks = vi.hoisted(() => ({
    setPushToken: vi.fn(),
    pushToken: null as string | null,
    getPushToken: vi.fn(),
    refreshListeners: [] as PushTokenRefreshListener[],
    unsubscribeRefresh: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    usePushToken: () => ({
        pushToken: mocks.pushToken,
        setPushToken: mocks.setPushToken,
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({
        pushNotification: {
            getPushToken: mocks.getPushToken,
            addTokenRefreshListener: (
                listener: PushTokenRefreshListener,
            ): (() => void) => {
                mocks.refreshListeners.push(listener)
                return mocks.unsubscribeRefresh
            },
        },
    }),
}))

const emitAppState = async (state: AppStateStatus) => {
    const calls = vi.mocked(AppState.addEventListener).mock.calls
    const handler = calls.at(-1)?.[1] as (state: AppStateStatus) => void
    await act(async () => {
        handler(state)
        await Promise.resolve()
    })
}

describe('useTokenListener', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.pushToken = null
        mocks.refreshListeners = []
        mocks.getPushToken.mockResolvedValue(undefined)
        vi.spyOn(AppState, 'addEventListener').mockReturnValue({
            remove: vi.fn(),
        } as unknown as ReturnType<typeof AppState.addEventListener>)
    })

    it('seeds the store with the token resolved at bootstrap', () => {
        renderHook(() => useTokenListener('bootstrap-token'))

        expect(mocks.setPushToken).toHaveBeenCalledWith('bootstrap-token')
    })

    it('stores a rotated token', () => {
        mocks.pushToken = 'old-token'
        renderHook(() => useTokenListener('old-token'))

        act(() => {
            for (const listener of mocks.refreshListeners) {
                listener('rotated-token')
            }
        })

        expect(mocks.setPushToken).toHaveBeenCalledWith('rotated-token')
    })

    it('picks up a token granted after launch when the app resumes', async () => {
        mocks.getPushToken.mockResolvedValue('granted-token')
        renderHook(() => useTokenListener(null))

        await emitAppState('active')

        expect(mocks.setPushToken).toHaveBeenCalledWith('granted-token')
    })

    it('keeps the stored token when a resume read yields nothing', async () => {
        mocks.pushToken = 'live-token'
        renderHook(() => useTokenListener('live-token'))
        mocks.setPushToken.mockClear()

        await emitAppState('active')

        expect(mocks.setPushToken).not.toHaveBeenCalled()
    })

    it('does not re-write an unchanged token', async () => {
        mocks.pushToken = 'live-token'
        mocks.getPushToken.mockResolvedValue('live-token')
        renderHook(() => useTokenListener('live-token'))
        mocks.setPushToken.mockClear()

        await emitAppState('active')

        expect(mocks.setPushToken).not.toHaveBeenCalled()
    })

    it('does not read the token on a background transition', async () => {
        renderHook(() => useTokenListener('live-token'))

        await emitAppState('background')

        expect(mocks.getPushToken).not.toHaveBeenCalled()
    })
})
