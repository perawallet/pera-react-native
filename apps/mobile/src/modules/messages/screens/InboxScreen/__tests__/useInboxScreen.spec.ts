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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInboxScreen } from '../useInboxScreen'
import { useInboxQuery } from '@perawallet/wallet-core-messages'

const mockPush = vi.fn()
const mockErrorToast = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        push: mockPush,
        goBack: vi.fn(),
        navigate: vi.fn(),
        replace: vi.fn(),
        canGoBack: () => true,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        successToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxQuery: vi.fn(),
    useCleanupDuplicateMultisigInvitations: vi.fn(),
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

    it('handleInboxItemPress navigates to AssetTransferRequests for asa_inbox', () => {
        const asaItem = {
            type: 'asa_inbox' as const,
            data: {
                address: 'ADDR1',
                inboxAddress: 'INBOX1',
                requestCount: 3,
            },
            createdAt: new Date(0),
        }

        const { result } = renderHook(() => useInboxScreen())

        act(() => {
            result.current.handleInboxItemPress(
                asaItem as unknown as Parameters<
                    typeof result.current.handleInboxItemPress
                >[0],
            )
        })

        expect(mockPush).toHaveBeenCalledWith('Messages', {
            screen: 'AssetTransferRequests',
            params: { item: asaItem.data },
        })
    })

    it('handleInboxItemPress sets selectedInvitation for multisig_import with ISO createdAt', () => {
        const createdAt = new Date('2025-01-15T00:00:00.000Z')
        const importItem = {
            type: 'multisig_import' as const,
            data: {
                customId: 'msig-1',
                createdAt,
                address: 'MSIG_ADDR1',
                version: 1,
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2'],
            },
            createdAt,
        }

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.selectedInvitation).toBeNull()

        act(() => {
            result.current.handleInboxItemPress(
                importItem as unknown as Parameters<
                    typeof result.current.handleInboxItemPress
                >[0],
            )
        })

        expect(mockPush).not.toHaveBeenCalled()
        expect(result.current.selectedInvitation).toEqual({
            customId: 'msig-1',
            createdAt: '2025-01-15T00:00:00.000Z',
            address: 'MSIG_ADDR1',
            version: 1,
            threshold: 2,
            participantAddresses: ['ADDR1', 'ADDR2'],
        })

        act(() => {
            result.current.closeInvitation()
        })

        expect(result.current.selectedInvitation).toBeNull()
    })

    it('handleInboxItemPress shows not-implemented toast for multisig_sign', () => {
        const signItem = {
            type: 'multisig_sign' as const,
            data: { id: 'sign-1' },
            createdAt: new Date(0),
        }

        const { result } = renderHook(() => useInboxScreen())

        act(() => {
            result.current.handleInboxItemPress(
                signItem as unknown as Parameters<
                    typeof result.current.handleInboxItemPress
                >[0],
            )
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.not_implemented.title',
            'common.not_implemented.body',
        )
        expect(mockPush).not.toHaveBeenCalled()
    })
})
