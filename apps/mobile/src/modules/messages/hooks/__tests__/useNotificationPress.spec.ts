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

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    findInboxItemForNotification,
    useNotificationPress,
} from '../useNotificationPress'
import type {
    InboxItem,
    PeraNotification,
} from '@perawallet/wallet-core-messages'

const mockHandleDeepLink = vi.fn()
const mockIsValidDeepLink = vi.fn()
const mockNavigateToScreen = vi.fn()
const mockRefetchInbox = vi.fn()
const mockHandleInboxItemPress = vi.fn()

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        isValidDeepLink: mockIsValidDeepLink,
        handleDeepLink: mockHandleDeepLink,
    }),
}))

vi.mock('@hooks/deeplink/navigateToScreen', () => ({
    navigateToScreen: (...args: unknown[]) => mockNavigateToScreen(...args),
}))

vi.mock('../useHandleInboxItemPress', () => ({
    useHandleInboxItemPress: () => mockHandleInboxItemPress,
}))

vi.mock('@perawallet/wallet-core-messages', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-messages')
    >('@perawallet/wallet-core-messages')
    return {
        ...actual,
        useInboxQuery: () => ({ refetch: mockRefetchInbox }),
    }
})

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        addSignRequest: vi.fn(),
    })),
}))

const signItem = {
    type: 'multisig_sign' as const,
    data: { id: 'sign-1', multisigAccount: { address: 'MSIG_ADDR' } },
    createdAt: new Date(0),
} as unknown as InboxItem

const importItem = {
    type: 'multisig_import' as const,
    data: {
        customId: 'msig-1',
        createdAt: new Date(0),
        address: 'MSIG_IMPORT_ADDR',
        version: 1,
        threshold: 2,
        participantAddresses: ['ADDR1', 'ADDR2'],
    },
    createdAt: new Date(0),
} as unknown as InboxItem

describe('findInboxItemForNotification', () => {
    it('returns the single matching multisig_sign item by account address', () => {
        const match = findInboxItemForNotification(
            [signItem],
            'sign',
            'MSIG_ADDR',
        )
        expect(match).toBe(signItem)
    })

    it('returns the single matching multisig_import item by address', () => {
        const match = findInboxItemForNotification(
            [importItem],
            'import',
            'MSIG_IMPORT_ADDR',
        )
        expect(match).toBe(importItem)
    })

    it('returns undefined when nothing matches the address', () => {
        expect(
            findInboxItemForNotification([signItem], 'sign', 'OTHER_ADDR'),
        ).toBeUndefined()
    })

    it('returns undefined when more than one item matches (ambiguous)', () => {
        const otherSignItem = {
            ...signItem,
            data: { id: 'sign-2', multisigAccount: { address: 'MSIG_ADDR' } },
        } as unknown as InboxItem
        expect(
            findInboxItemForNotification(
                [signItem, otherSignItem],
                'sign',
                'MSIG_ADDR',
            ),
        ).toBeUndefined()
    })
})

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
        mockRefetchInbox.mockResolvedValue({ data: [] })
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
            'notification',
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

    it('navigates to Inbox and dispatches the matching sign request, skipping handleDeepLink', async () => {
        mockRefetchInbox.mockResolvedValue({ data: [signItem] })

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multisig-new-sign-request',
            accountAddress: 'MSIG_ADDR',
            url: 'perawallet://asset-inbox/?address=MSIG_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(mockNavigateToScreen).toHaveBeenCalledWith(false, 'Messages', {
            screen: 'MessagesHome',
            params: { screen: 'Inbox' },
        })
        expect(mockRefetchInbox).toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()

        await waitFor(() =>
            expect(mockHandleInboxItemPress).toHaveBeenCalledWith(signItem),
        )
    })

    it('navigates to Inbox and dispatches the matching invitation for an import notification', async () => {
        mockRefetchInbox.mockResolvedValue({ data: [importItem] })

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multi-sig-import-account',
            accountAddress: 'MSIG_IMPORT_ADDR',
            url: 'perawallet://asset-inbox/?address=MSIG_IMPORT_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(mockNavigateToScreen).toHaveBeenCalledWith(false, 'Messages', {
            screen: 'MessagesHome',
            params: { screen: 'Inbox' },
        })
        expect(mockHandleDeepLink).not.toHaveBeenCalled()

        await waitFor(() =>
            expect(mockHandleInboxItemPress).toHaveBeenCalledWith(importItem),
        )
    })

    it('navigates without dispatching when no inbox item matches', async () => {
        mockRefetchInbox.mockResolvedValue({ data: [] })

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multisig-new-sign-request',
            accountAddress: 'MSIG_ADDR',
        })

        result.current.handleNotificationPress(notification)

        await waitFor(() => expect(mockRefetchInbox).toHaveBeenCalled())
        expect(mockHandleInboxItemPress).not.toHaveBeenCalled()
        expect(mockNavigateToScreen).toHaveBeenCalled()
    })

    it('is a no-op for multisig-declined notifications', () => {
        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multisig-declined',
            url: 'perawallet://app/account-detail/?address=MSIG_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(mockNavigateToScreen).not.toHaveBeenCalled()
        expect(mockRefetchInbox).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('is a no-op for multisig-expired notifications', () => {
        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'multisig-expired',
            url: 'perawallet://app/account-detail/?address=MSIG_ADDR',
        })

        result.current.handleNotificationPress(notification)

        expect(mockNavigateToScreen).not.toHaveBeenCalled()
        expect(mockRefetchInbox).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('falls through to handleDeepLink for non-multisig notification types', () => {
        mockIsValidDeepLink.mockReturnValue(true)

        const { result } = renderHook(() => useNotificationPress())
        const notification = makeNotification({
            type: 'transaction-received',
        })

        result.current.handleNotificationPress(notification)

        expect(mockNavigateToScreen).not.toHaveBeenCalled()
        expect(mockRefetchInbox).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            notification.url,
            true,
            'notification',
        )
    })
})
