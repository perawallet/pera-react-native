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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-config'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useInboxQuery } from '../useInboxQuery'
import { fetchInbox } from '../../api/inbox'
import type { InboxResponse } from '../../api/inbox'

vi.mock('../../api/inbox', () => ({
    fetchInbox: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: vi.fn().mockReturnValue([
        { address: 'ADDR1', type: 'algo25' },
        { address: 'ADDR2', type: 'algo25' },
    ]),
    useAllAccounts: vi.fn().mockReturnValue([
        { address: 'ADDR1', type: 'algo25' },
        { address: 'ADDR2', type: 'algo25' },
    ]),
}))

beforeEach(() => {
    vi.mocked(useAllAccounts).mockReturnValue([
        { address: 'ADDR1', type: 'algo25' },
        { address: 'ADDR2', type: 'algo25' },
    ] as ReturnType<typeof useAllAccounts>)
    vi.mocked(useNetwork).mockReturnValue({
        network: 'mainnet',
    } as ReturnType<typeof useNetwork>)
})

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

        expect(fetchInbox).toHaveBeenCalledWith('mainnet', 'test-device-id', [
            'ADDR1',
            'ADDR2',
        ])

        const { data: inboxItems } = result.current
        expect(inboxItems).toHaveLength(3)

        expect(inboxItems?.[0].type).toBe('multisig_import')
        expect(inboxItems?.[1].type).toBe('multisig_sign')
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
        expect(importItem?.type).toBe('multisig_import')
        if (importItem?.type === 'multisig_import') {
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

    it('filters out multisig_import items whose address is already a local account', async () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            { address: 'ADDR1', type: 'algo25' },
            { address: 'ADDR2', type: 'algo25' },
            { address: 'MSIG_ADDR1', type: 'multisig' },
        ] as ReturnType<typeof useAllAccounts>)

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
                {
                    custom_id: 'msig-2',
                    creation_datetime: '2025-01-16T00:00:00Z',
                    address: 'MSIG_ADDR_NEW',
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
                        custom_id: 'msig-1',
                        creation_datetime: '2025-01-15T00:00:00Z',
                        address: 'MSIG_ADDR1',
                        version: 1,
                        threshold: 2,
                        participant_addresses: ['ADDR1', 'ADDR2'],
                    },
                    transaction_lists: [],
                },
            ],
            asa_inboxes: [],
        }
        vi.mocked(fetchInbox).mockResolvedValue(mockResponse)

        const { result } = renderHook(() => useInboxQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })

        const inboxItems = result.current.data ?? []
        const importItems = inboxItems.filter(i => i.type === 'multisig_import')
        const signItems = inboxItems.filter(i => i.type === 'multisig_sign')

        expect(importItems).toHaveLength(1)
        expect(
            importItems[0].type === 'multisig_import' &&
                importItems[0].data.address,
        ).toBe('MSIG_ADDR_NEW')
        expect(signItems).toHaveLength(1)
    })

    it('filters out asa_inbox items with no pending requests', async () => {
        const mockResponse = {
            joint_account_import_requests: [],
            joint_account_sign_requests: [],
            asa_inboxes: [
                {
                    address: 'ADDR1',
                    inbox_address: 'INBOX1',
                    request_count: 0,
                },
                {
                    address: 'ADDR2',
                    inbox_address: 'INBOX2',
                    request_count: 2,
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

        expect(result.current.data).toHaveLength(1)
        expect(result.current.data?.[0].type).toBe('asa_inbox')
    })

    describe('refetchInterval polling', () => {
        const POLL_INTERVAL_MS = 10_000

        const buildSignRequest = (
            status: 'pending' | 'ready' | 'submitting' | 'confirmed',
            id = '1',
        ) => ({
            id,
            status,
            type: 'transfer',
            creation_datetime: '2025-01-20T00:00:00Z',
            expected_expire_datetime: '2025-01-21T00:00:00Z',
            fail_reason_display: null,
            joint_account: {
                custom_id: 'msig-1',
                creation_datetime: '2025-01-10T00:00:00Z',
                address: 'MSIG_ADDR1',
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1', 'ADDR2'],
            },
            transaction_lists: [],
        })

        const buildResponse = (
            signRequests: ReturnType<typeof buildSignRequest>[],
        ): InboxResponse => ({
            joint_account_import_requests: [],
            joint_account_sign_requests: signRequests,
            asa_inboxes: [],
        })

        beforeEach(() => {
            vi.mocked(fetchInbox).mockClear()
            vi.useFakeTimers({ shouldAdvanceTime: true })
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it.each(['pending', 'ready', 'submitting'] as const)(
            'polls every 10s while a sign request is %s',
            async status => {
                vi.mocked(fetchInbox).mockResolvedValue(
                    buildResponse([buildSignRequest(status)]),
                )

                renderHook(() => useInboxQuery(), { wrapper: createWrapper() })

                await waitFor(() => {
                    expect(fetchInbox).toHaveBeenCalledTimes(1)
                })

                await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
                expect(fetchInbox).toHaveBeenCalledTimes(2)

                await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
                expect(fetchInbox).toHaveBeenCalledTimes(3)
            },
        )

        it('stops polling once all sign requests reach a terminal status', async () => {
            vi.mocked(fetchInbox)
                .mockResolvedValueOnce(
                    buildResponse([buildSignRequest('submitting')]),
                )
                .mockResolvedValueOnce(
                    buildResponse([buildSignRequest('confirmed')]),
                )

            renderHook(() => useInboxQuery(), { wrapper: createWrapper() })

            await waitFor(() => {
                expect(fetchInbox).toHaveBeenCalledTimes(1)
            })

            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
            await waitFor(() => {
                expect(fetchInbox).toHaveBeenCalledTimes(2)
            })

            // Cached response now has only a `confirmed` item — polling
            // should halt.
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
            expect(fetchInbox).toHaveBeenCalledTimes(2)
        })

        it('does not poll when there are no in-flight sign requests', async () => {
            vi.mocked(fetchInbox).mockResolvedValue(
                buildResponse([buildSignRequest('confirmed')]),
            )

            renderHook(() => useInboxQuery(), { wrapper: createWrapper() })

            await waitFor(() => {
                expect(fetchInbox).toHaveBeenCalledTimes(1)
            })

            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
            expect(fetchInbox).toHaveBeenCalledTimes(1)
        })

        it('does not poll when the inbox response is empty', async () => {
            vi.mocked(fetchInbox).mockResolvedValue(buildResponse([]))

            renderHook(() => useInboxQuery(), { wrapper: createWrapper() })

            await waitFor(() => {
                expect(fetchInbox).toHaveBeenCalledTimes(1)
            })

            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
            expect(fetchInbox).toHaveBeenCalledTimes(1)
        })
    })

    it('returns a referentially stable refetch across renders', async () => {
        vi.mocked(fetchInbox).mockResolvedValue({
            joint_account_import_requests: [],
            joint_account_sign_requests: [],
            asa_inboxes: [],
        } as unknown as InboxResponse)

        const { result, rerender } = renderHook(() => useInboxQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const { refetch } = result.current

        rerender()

        // A per-render identity turns any consumer effect with `refetch` in
        // its deps into a refetch loop (see the notifications focus-refetch).
        expect(result.current.refetch).toBe(refetch)
    })

    describe('offline pause', () => {
        beforeEach(() => {
            vi.mocked(fetchInbox).mockClear()
        })

        afterEach(() => {
            onlineManager.setOnline(true)
        })

        it('reports isPaused — not isPending — when offline pauses an uncached query', async () => {
            onlineManager.setOnline(false)

            const { result } = renderHook(() => useInboxQuery(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isPaused).toBe(true))
            // A paused query keeps `status: 'pending'`; surfacing that as
            // isPending would spin the inbox empty view indefinitely.
            expect(result.current.isPending).toBe(false)
            expect(fetchInbox).not.toHaveBeenCalled()
        })
    })

    describe('non-Pera-backed networks', () => {
        beforeEach(() => {
            vi.mocked(fetchInbox).mockClear()
        })

        it.each([Networks.betanet, Networks.custom])(
            'disables the query and flags isUnavailableOnNetwork on %s',
            network => {
                vi.mocked(useNetwork).mockReturnValue({
                    network,
                } as ReturnType<typeof useNetwork>)

                const { result } = renderHook(() => useInboxQuery(), {
                    wrapper: createWrapper(),
                })

                expect(result.current.isUnavailableOnNetwork).toBe(true)
                expect(fetchInbox).not.toHaveBeenCalled()
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'reports isPending false while unavailable on %s',
            network => {
                vi.mocked(useNetwork).mockReturnValue({
                    network,
                } as ReturnType<typeof useNetwork>)

                const { result } = renderHook(() => useInboxQuery(), {
                    wrapper: createWrapper(),
                })

                expect(result.current.isPending).toBe(false)
                expect(result.current.data).toEqual([])
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'does not invoke fetchInbox when refetch is called on %s',
            async network => {
                vi.mocked(useNetwork).mockReturnValue({
                    network,
                } as ReturnType<typeof useNetwork>)

                const { result } = renderHook(() => useInboxQuery(), {
                    wrapper: createWrapper(),
                })

                await expect(result.current.refetch()).resolves.toEqual([])

                expect(fetchInbox).not.toHaveBeenCalled()
            },
        )
    })
})
