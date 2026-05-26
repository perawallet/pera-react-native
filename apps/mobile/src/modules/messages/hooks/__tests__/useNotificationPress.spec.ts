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
import type { PeraNotification } from '@perawallet/wallet-core-messages'
import { useMultisigNotificationIntentStore } from '@modules/multisig/stores/useMultisigNotificationIntentStore'

const mockHandleDeepLink = vi.fn()
const mockIsValidDeepLink = vi.fn()
const mockNavigateToScreen = vi.fn()

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        isValidDeepLink: mockIsValidDeepLink,
        handleDeepLink: mockHandleDeepLink,
    }),
}))

vi.mock('@hooks/deeplink/navigateToScreen', () => ({
    navigateToScreen: (...args: unknown[]) => mockNavigateToScreen(...args),
}))

const mockInvalidateInbox = vi.fn()
vi.mock('@perawallet/wallet-core-messages', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-messages')
    >('@perawallet/wallet-core-messages')
    return {
        ...actual,
        useInboxInvalidator: () => ({ invalidate: mockInvalidateInbox }),
    }
})

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
        useMultisigNotificationIntentStore.getState().resetState()
    })

    it('calls handleDeepLink when url is valid', () => {
        mockIsValidDeepLink.mockReturnValue(true)

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification()

        result.current.handleNotificationPress(notification)

        expect(mockIsValidDeepLink).toHaveBeenCalledWith(notification.url)
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            notification.url,
            true,
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

    it('sets a sign intent and navigates to Inbox for multisig-new-sign-request, skipping handleDeepLink', () => {
        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multisig-new-sign-request',
            accountAddress: 'MSIG_ADDR',
            url: 'perawallet://asset-inbox/?address=MSIG_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toEqual({ kind: 'sign', address: 'MSIG_ADDR' })
        expect(mockNavigateToScreen).toHaveBeenCalledWith(false, 'Messages', {
            screen: 'MessagesHome',
            params: { screen: 'Inbox' },
        })
        expect(mockInvalidateInbox).toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('sets an import intent and navigates to Inbox for multi-sig-import-account', () => {
        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multi-sig-import-account',
            accountAddress: 'MSIG_IMPORT_ADDR',
            url: 'perawallet://asset-inbox/?address=MSIG_IMPORT_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toEqual({ kind: 'import', address: 'MSIG_IMPORT_ADDR' })
        expect(mockNavigateToScreen).toHaveBeenCalledWith(false, 'Messages', {
            screen: 'MessagesHome',
            params: { screen: 'Inbox' },
        })
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('is a no-op for multisig-declined notifications', () => {
        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multisig-declined',
            url: 'perawallet://app/account-detail/?address=MSIG_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toBeNull()
        expect(mockNavigateToScreen).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('is a no-op for multisig-expired notifications', () => {
        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multisig-expired',
            url: 'perawallet://app/account-detail/?address=MSIG_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toBeNull()
        expect(mockNavigateToScreen).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('falls through to handleDeepLink for non-multisig notification types', () => {
        mockIsValidDeepLink.mockReturnValue(true)

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'transaction-received',
        })

        result.current.handleNotificationPress(notification)

        expect(
            useMultisigNotificationIntentStore.getState().pendingIntent,
        ).toBeNull()
        expect(mockNavigateToScreen).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            notification.url,
            true,
            'deeplink',
        )
    })
})
