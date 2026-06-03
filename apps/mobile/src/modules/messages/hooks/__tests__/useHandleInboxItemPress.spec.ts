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
import type { InboxItem } from '@perawallet/wallet-core-messages'
import { useHandleInboxItemPress } from '../useHandleInboxItemPress'

const mockPush = vi.fn()
const mockErrorToast = vi.fn()

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

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

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@modules/messages/components/MultisigInvitationDetailContent', () => ({
    MultisigInvitationDetailContent: () => null,
}))

const mockHandleMultisigSignTap = vi.fn()
vi.mock('@modules/multisig/hooks/useHandleMultisigSignTap', () => ({
    useHandleMultisigSignTap: () => mockHandleMultisigSignTap,
}))

const asInboxItem = (item: unknown): InboxItem => item as InboxItem

describe('useHandleInboxItemPress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('navigates to AssetTransferRequests for asa_inbox', () => {
        const asaItem = {
            type: 'asa_inbox' as const,
            data: { address: 'ADDR1', inboxAddress: 'INBOX1', requestCount: 3 },
            createdAt: new Date(0),
        }

        const { result } = renderHook(() => useHandleInboxItemPress())

        act(() => {
            result.current(asInboxItem(asaItem))
        })

        expect(mockPush).toHaveBeenCalledWith('Messages', {
            screen: 'AssetTransferRequests',
            params: { item: asaItem.data },
        })
    })

    it('requests the multisig invitation bottom sheet for multisig_import', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
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

        const { result } = renderHook(() => useHandleInboxItemPress())

        await act(async () => {
            result.current(asInboxItem(importItem))
        })

        expect(mockPush).not.toHaveBeenCalled()
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        expect(arg.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('navigates to MultisigInvitationName when the invitation sheet resolves "accept"', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('accept')
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

        const { result } = renderHook(() => useHandleInboxItemPress())

        await act(async () => {
            result.current(asInboxItem(importItem))
        })

        expect(mockPush).toHaveBeenCalledWith('Messages', {
            screen: 'MultisigInvitationName',
            params: {
                invitation: {
                    customId: 'msig-1',
                    createdAt: createdAt.toISOString(),
                    address: 'MSIG_ADDR1',
                    version: 1,
                    threshold: 2,
                    participantAddresses: ['ADDR1', 'ADDR2'],
                },
            },
        })
    })

    it('does not navigate when the invitation sheet resolves "decline"', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('decline')
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

        const { result } = renderHook(() => useHandleInboxItemPress())

        await act(async () => {
            result.current(asInboxItem(importItem))
        })

        expect(mockPush).not.toHaveBeenCalled()
    })

    it('delegates multisig_sign to the multisig sign-tap handler', () => {
        const signItem = {
            type: 'multisig_sign' as const,
            data: { id: 'sign-1' },
            createdAt: new Date(0),
        }

        const { result } = renderHook(() => useHandleInboxItemPress())

        act(() => {
            result.current(asInboxItem(signItem))
        })

        expect(mockHandleMultisigSignTap).toHaveBeenCalledWith(signItem.data)
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})
