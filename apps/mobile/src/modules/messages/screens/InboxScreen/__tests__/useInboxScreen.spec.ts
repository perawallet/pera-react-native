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
import { useMultisigNotificationIntentStore } from '@modules/multisig/stores/useMultisigNotificationIntentStore'

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

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxQuery: vi.fn(),
    useCleanupDuplicateMultisigInvitations: vi.fn(),
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

describe('useInboxScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useMultisigNotificationIntentStore.getState().resetState()
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

    it('handleInboxItemPress requests the multisig invitation bottom sheet for multisig_import', async () => {
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

        const { result } = renderHook(() => useInboxScreen())

        await act(async () => {
            result.current.handleInboxItemPress(
                importItem as unknown as Parameters<
                    typeof result.current.handleInboxItemPress
                >[0],
            )
        })

        expect(mockPush).not.toHaveBeenCalled()
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        expect(arg.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
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

        const { result } = renderHook(() => useInboxScreen())

        await act(async () => {
            result.current.handleInboxItemPress(
                importItem as unknown as Parameters<
                    typeof result.current.handleInboxItemPress
                >[0],
            )
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

        const { result } = renderHook(() => useInboxScreen())

        await act(async () => {
            result.current.handleInboxItemPress(
                importItem as unknown as Parameters<
                    typeof result.current.handleInboxItemPress
                >[0],
            )
        })

        expect(mockPush).not.toHaveBeenCalled()
    })

    it('handleInboxItemPress delegates multisig_sign to the multisig sign-tap handler', () => {
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

        expect(mockHandleMultisigSignTap).toHaveBeenCalledWith(signItem.data)
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    describe('multisig notification intent', () => {
        const createSignItem = (multisigAddress: string, id = 'sign-1') => ({
            type: 'multisig_sign' as const,
            data: {
                id,
                multisigAccount: { address: multisigAddress },
            },
            createdAt: new Date(0),
        })

        const createImportItem = (address: string, customId = 'msig-1') => ({
            type: 'multisig_import' as const,
            data: {
                customId,
                createdAt: new Date(0),
                address,
                version: 1,
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2'],
            },
            createdAt: new Date(0),
        })

        it('auto-presses the matching multisig_sign item and consumes the intent', () => {
            const signItem = createSignItem('MSIG_ADDR')
            vi.mocked(useInboxQuery).mockReturnValue({
                data: [signItem],
                isPending: false,
                isRefetching: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useInboxQuery>)
            useMultisigNotificationIntentStore.getState().setIntent({
                kind: 'sign',
                address: 'MSIG_ADDR',
            })

            renderHook(() => useInboxScreen())

            expect(mockHandleMultisigSignTap).toHaveBeenCalledWith(
                signItem.data,
            )
            expect(
                useMultisigNotificationIntentStore.getState().pendingIntent,
            ).toBeNull()
        })

        it('opens the invitation sheet for the matching multisig_import item', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const importItem = createImportItem('MSIG_IMPORT_ADDR')
            vi.mocked(useInboxQuery).mockReturnValue({
                data: [importItem],
                isPending: false,
                isRefetching: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useInboxQuery>)
            useMultisigNotificationIntentStore.getState().setIntent({
                kind: 'import',
                address: 'MSIG_IMPORT_ADDR',
            })

            renderHook(() => useInboxScreen())

            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            expect(
                useMultisigNotificationIntentStore.getState().pendingIntent,
            ).toBeNull()
        })

        it('clears the intent without dispatching when no matching item exists', () => {
            vi.mocked(useInboxQuery).mockReturnValue({
                data: [createSignItem('OTHER_MSIG_ADDR')],
                isPending: false,
                isRefetching: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useInboxQuery>)
            useMultisigNotificationIntentStore.getState().setIntent({
                kind: 'sign',
                address: 'MSIG_ADDR',
            })

            renderHook(() => useInboxScreen())

            expect(mockHandleMultisigSignTap).not.toHaveBeenCalled()
            expect(
                useMultisigNotificationIntentStore.getState().pendingIntent,
            ).toBeNull()
        })

        it('clears the intent without dispatching when multiple items match', () => {
            vi.mocked(useInboxQuery).mockReturnValue({
                data: [
                    createSignItem('MSIG_ADDR', 'sign-1'),
                    createSignItem('MSIG_ADDR', 'sign-2'),
                ],
                isPending: false,
                isRefetching: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useInboxQuery>)
            useMultisigNotificationIntentStore.getState().setIntent({
                kind: 'sign',
                address: 'MSIG_ADDR',
            })

            renderHook(() => useInboxScreen())

            expect(mockHandleMultisigSignTap).not.toHaveBeenCalled()
            expect(
                useMultisigNotificationIntentStore.getState().pendingIntent,
            ).toBeNull()
        })

        it('does not dispatch while the inbox query is still pending', () => {
            vi.mocked(useInboxQuery).mockReturnValue({
                data: undefined,
                isPending: true,
                isRefetching: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useInboxQuery>)
            useMultisigNotificationIntentStore.getState().setIntent({
                kind: 'sign',
                address: 'MSIG_ADDR',
            })

            renderHook(() => useInboxScreen())

            expect(mockHandleMultisigSignTap).not.toHaveBeenCalled()
            expect(
                useMultisigNotificationIntentStore.getState().pendingIntent,
            ).toEqual({ kind: 'sign', address: 'MSIG_ADDR' })
        })
    })
})
