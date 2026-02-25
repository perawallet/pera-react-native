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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-core-platform-integration'
import { useInboxQuery } from '../useInboxQuery'
import { fetchInbox } from '../../api/inbox'

vi.mock('../../api/inbox', () => ({
    fetchInbox: vi.fn(),
}))

vi.mock(
    '@perawallet/wallet-core-platform-integration',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@perawallet/wallet-core-platform-integration')
            >()
        return {
            ...actual,
            useDeviceID: vi.fn().mockReturnValue('test-device-id'),
            useNetwork: vi.fn().mockReturnValue({ network: 'test-network' }),
        }
    },
)

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn().mockReturnValue([
        { address: 'ADDR1', type: 'algo25' },
        { address: 'ADDR2', type: 'algo25' },
    ]),
}))

describe('useInboxQuery', () => {
    it('should fetch inbox and map response to InboxItem array', async () => {
        const mockResponse = {
            joint_account_import_requests: [
                {
                    custom_id: 'msig-1',
                    creation_datetime: '2025-01-15T00:00:00Z',
                    address: 'MSIG_ADDR1',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['ADDR1', 'ADDR2'],
                },
            ],
            joint_account_sign_requests: [
                {
                    id: '1',
                    status: 'pending' as const,
                    type: 'transfer',
                    creation_datetime: '2025-01-20T00:00:00Z',
                    expected_expire_datetime: '2025-01-21T00:00:00Z',
                    fail_reason_display: null,
                    joint_account: {
                        custom_id: 'msig-2',
                        creation_datetime: '2025-01-10T00:00:00Z',
                        address: 'MSIG_ADDR2',
                        version: 1,
                        threshold: 2,
                        participant_addresses: ['ADDR1', 'ADDR2'],
                    },
                    transaction_lists: [],
                },
            ],
            asa_inboxes: [
                {
                    address: 'ADDR1',
                    inbox_address: 'INBOX1',
                    request_count: 3,
                },
            ],
        }
        vi.mocked(fetchInbox).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useInboxQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })

        expect(fetchInbox).toHaveBeenCalledWith(
            'test-network',
            'test-device-id',
            ['ADDR1', 'ADDR2'],
        )

        const { data: inboxItems } = result.current
        expect(inboxItems).toHaveLength(3)

        expect(inboxItems?.[0].type).toBe('joint_account_import')
        expect(inboxItems?.[1].type).toBe('joint_account_sign')
        expect(inboxItems?.[2].type).toBe('asa_inbox')
    })

    it('should map multi-sig account fields to camelCase', async () => {
        const mockResponse = {
            joint_account_import_requests: [
                {
                    custom_id: 'msig-1',
                    creation_datetime: '2025-01-15T00:00:00Z',
                    address: 'MSIG_ADDR1',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['ADDR1', 'ADDR2'],
                },
            ],
            joint_account_sign_requests: [],
            asa_inboxes: [],
        }
        vi.mocked(fetchInbox).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useInboxQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })

        const importItem = result.current.data?.[0]
        expect(importItem?.type).toBe('joint_account_import')
        if (importItem?.type === 'joint_account_import') {
            expect(importItem.data.customId).toBe('msig-1')
            expect(importItem.data.createdAt).toEqual(
                new Date('2025-01-15T00:00:00Z'),
            )
            expect(importItem.data.participantAddresses).toEqual([
                'ADDR1',
                'ADDR2',
            ])
        }
    })

    it('should return empty array when response has no items', async () => {
        const mockResponse = {
            joint_account_import_requests: [],
            joint_account_sign_requests: [],
            asa_inboxes: [],
        }
        vi.mocked(fetchInbox).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useInboxQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })

        expect(result.current.data).toEqual([])
    })
})
