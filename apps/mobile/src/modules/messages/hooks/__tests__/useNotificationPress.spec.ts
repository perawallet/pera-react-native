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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNotificationPress } from '../useNotificationPress'
import type { PeraNotification } from '@perawallet/wallet-core-notifications'

const mockHandleDeepLink = vi.fn()
const mockIsValidDeepLink = vi.fn()

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        isValidDeepLink: mockIsValidDeepLink,
        handleDeepLink: mockHandleDeepLink,
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        addSignRequest: vi.fn(),
    })),
}))

describe('useNotificationPress', () => {
    const makeNotification = (
        overrides: Partial<PeraNotification> = {},
    ): PeraNotification => ({
        id: '1',
        accountAddress: 'TESTADDR123',
        message: 'Test notification',
        url: 'perawallet://account-detail?address=TESTADDR123',
        createdAt: new Date('2025-01-27T12:00:00Z'),
        ...overrides,
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls handleDeepLink when url is valid', () => {
        mockIsValidDeepLink.mockReturnValue(true)

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification()

        result.current.handleNotificationPress(notification)

        expect(mockIsValidDeepLink).toHaveBeenCalledWith(notification.url)
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            notification.url,
            false,
            'deeplink',
        )
    })

    it('does not call handleDeepLink when url is empty', () => {
        mockIsValidDeepLink.mockReturnValue(false)

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({ url: '' })

        result.current.handleNotificationPress(notification)

        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('does not call handleDeepLink when url is invalid', () => {
        mockIsValidDeepLink.mockReturnValue(false)

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            url: 'https://invalid-url.com',
        })

        result.current.handleNotificationPress(notification)

        expect(mockIsValidDeepLink).toHaveBeenCalledWith(
            'https://invalid-url.com',
        )
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })
})
