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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import {
    fetchNotificationStatus,
    fetchNotificationList,
    fetchMessageStatus,
} from '../endpoints'
import { queryClient } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: vi.fn(),
}))

const DEVICE_ID = 'test-device-id'

describe('fetchNotificationStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        const validResponse = { has_new_notification: true }
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        await fetchNotificationStatus('testnet', DEVICE_ID)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'GET',
            url: `/v1/devices/${DEVICE_ID}/notification-status/`,
        })
    })

    test('returns parsed response on success', async () => {
        const validResponse = { has_new_notification: false }
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        const result = await fetchNotificationStatus('mainnet', DEVICE_ID)
        expect(result).toEqual(validResponse)
    })

    test('throws when response data fails schema validation', async () => {
        const invalidData = { has_new_notification: 'not-a-boolean' }
        ;(queryClient as Mock).mockResolvedValue({ data: invalidData })

        await expect(
            fetchNotificationStatus('testnet', DEVICE_ID),
        ).rejects.toThrow()
    })

    test('propagates errors from queryClient', async () => {
        ;(queryClient as Mock).mockRejectedValue(new Error('Network error'))

        await expect(
            fetchNotificationStatus('testnet', DEVICE_ID),
        ).rejects.toThrow('Network error')
    })
})

describe('fetchNotificationList', () => {
    const validResponse = {
        results: [
            {
                id: '1',
                account_address: 'TESTADDR123',
                message: 'Message',
                url: 'perawallet://home',
                creation_datetime: '2025-01-01T00:00:00Z',
            },
        ],
        next: null,
        previous: null,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct v2 endpoint', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        await fetchNotificationList('testnet', DEVICE_ID)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'GET',
            url: `/v2/devices/${DEVICE_ID}/notifications/`,
            params: { cursor: undefined },
        })
    })

    test('passes cursor when provided', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        await fetchNotificationList('testnet', DEVICE_ID, 'cursor-abc')

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                params: { cursor: 'cursor-abc' },
            }),
        )
    })

    test('returns parsed response on success', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        const result = await fetchNotificationList('testnet', DEVICE_ID)
        expect(result).toEqual(validResponse)
    })

    test('throws when response data fails schema validation', async () => {
        const invalidData = { results: 'not-an-array' }
        ;(queryClient as Mock).mockResolvedValue({ data: invalidData })

        await expect(
            fetchNotificationList('testnet', DEVICE_ID),
        ).rejects.toThrow()
    })

    test('keeps rekey-style notifications with null url, account_address and type', async () => {
        const rekeyRow = {
            id: 2,
            type: null,
            account_address: null,
            message: 'Your account was rekeyed',
            url: null,
            creation_datetime: '2025-01-02T00:00:00Z',
        }
        ;(queryClient as Mock).mockResolvedValue({
            data: { ...validResponse, results: [rekeyRow] },
        })

        const result = await fetchNotificationList('testnet', DEVICE_ID)

        expect(result.results).toHaveLength(1)
        expect(result.results[0]).toEqual({ ...rekeyRow, id: '2' })
    })

    test('drops a malformed row but keeps the rest of the page', async () => {
        const malformedRow = { message: 'no id or datetime' }
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                ...validResponse,
                results: [malformedRow, ...validResponse.results],
            },
        })

        const result = await fetchNotificationList('testnet', DEVICE_ID)

        expect(result.results).toEqual(validResponse.results)
    })
})

describe('fetchMessageStatus', () => {
    const validResponse = {
        hasUnreadItems: true,
        hasUnreadNotifications: true,
        hasUnreadInboxItems: false,
        unreadInboxCount: 0,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct v3 endpoint', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        await fetchMessageStatus('testnet', DEVICE_ID)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'GET',
            url: `/api/v3/devices/${DEVICE_ID}/message-status`,
        })
    })

    test('returns parsed response on success', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        const result = await fetchMessageStatus('mainnet', DEVICE_ID)
        expect(result).toEqual(validResponse)
    })

    test('throws when response data fails schema validation', async () => {
        const invalidData = { hasUnreadItems: 'not-a-boolean' }
        ;(queryClient as Mock).mockResolvedValue({ data: invalidData })

        await expect(fetchMessageStatus('testnet', DEVICE_ID)).rejects.toThrow()
    })

    test('propagates errors from queryClient', async () => {
        ;(queryClient as Mock).mockRejectedValue(new Error('Network error'))

        await expect(fetchMessageStatus('testnet', DEVICE_ID)).rejects.toThrow(
            'Network error',
        )
    })
})
