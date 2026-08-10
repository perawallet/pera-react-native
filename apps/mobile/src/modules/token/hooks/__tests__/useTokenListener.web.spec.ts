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
import { renderHook, act } from '@testing-library/react'

const { mockSetPushToken, mockGetPushToken } = vi.hoisted(() => ({
    mockSetPushToken: vi.fn(),
    mockGetPushToken: vi.fn(),
}))

let currentToken: string | null = null
vi.mock('@perawallet/wallet-core-device', () => ({
    usePushToken: () => ({
        pushToken: currentToken,
        setPushToken: mockSetPushToken,
    }),
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({
        pushNotification: { getPushToken: mockGetPushToken },
    }),
}))

import { useTokenListener } from '../useTokenListener.web'

describe('useTokenListener (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        currentToken = null
        mockGetPushToken.mockResolvedValue(undefined)
    })

    it('seeds the store with the bootstrap token', () => {
        renderHook(() => useTokenListener('boot-token'))

        expect(mockSetPushToken).toHaveBeenCalledWith('boot-token')
    })

    it('adopts a token resolved on visibility change', async () => {
        mockGetPushToken.mockResolvedValue('fresh-token')
        renderHook(() => useTokenListener(null))
        mockSetPushToken.mockClear()

        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'))
            await Promise.resolve()
        })

        expect(mockSetPushToken).toHaveBeenCalledWith('fresh-token')
    })

    // A failed read (offline, revoked permission) must not unregister a token
    // the backend is still pushing to.
    it('never clears a live token when the refresh read fails', async () => {
        currentToken = 'live-token'
        mockGetPushToken.mockResolvedValue(undefined)
        renderHook(() => useTokenListener('live-token'))
        mockSetPushToken.mockClear()

        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'))
            await Promise.resolve()
        })

        expect(mockSetPushToken).not.toHaveBeenCalled()
    })

    it('does not rewrite an unchanged token', async () => {
        currentToken = 'same-token'
        mockGetPushToken.mockResolvedValue('same-token')
        renderHook(() => useTokenListener('same-token'))
        mockSetPushToken.mockClear()

        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'))
            await Promise.resolve()
        })

        expect(mockSetPushToken).not.toHaveBeenCalled()
    })
})
