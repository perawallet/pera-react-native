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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInboxScreen } from '../useInboxScreen'
import { useInboxQuery, type InboxItem } from '@perawallet/wallet-core-messages'
import { useIsDeviceRegistrationPending } from '@perawallet/wallet-core-device'

const mockHandleInboxItemPress = vi.fn()

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxQuery: vi.fn(),
    useCleanupDuplicateMultisigInvitations: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useIsDeviceRegistrationPending: vi.fn(),
}))

vi.mock('@modules/messages/hooks', () => ({
    useHandleInboxItemPress: () => mockHandleInboxItemPress,
}))

describe('useInboxScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(false)
    })

    it('returns empty inbox array when data is undefined', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: undefined,
            isPending: true,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.inboxItems).toEqual([])
        expect(result.current.isPending).toBe(true)
    })

    it('exposes inbox items and delegates presses to the shared handler', () => {
        const signItem = {
            type: 'multisig_sign' as const,
            data: { id: 'sign-1', multisigAccount: { address: 'MSIG_ADDR' } },
            createdAt: new Date(0),
        }
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [signItem],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.inboxItems).toEqual([signItem])

        act(() => {
            result.current.handleInboxItemPress(
                signItem as unknown as InboxItem,
            )
        })

        expect(mockHandleInboxItemPress).toHaveBeenCalledWith(signItem)
    })

    it('refetches the inbox when refresh is triggered', () => {
        const mockRefetch = vi.fn()
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: mockRefetch,
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        act(() => {
            result.current.refetch()
        })

        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('surfaces the refetching state of the inbox query', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: true,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isRefetching).toBe(true)
    })

    it('is awaiting registration when there are no items and registration is pending', () => {
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(true)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isAwaitingRegistration).toBe(true)
    })

    it('is not awaiting registration when items are present, even if registration is pending', () => {
        const signItem = {
            type: 'multisig_sign' as const,
            data: { id: 'sign-1', multisigAccount: { address: 'MSIG_ADDR' } },
            createdAt: new Date(0),
        }
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [signItem],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(true)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isAwaitingRegistration).toBe(false)
    })
})
