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
import { fetchInbox } from '../endpoints'
import { queryClient } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        queryClient: vi.fn(),
    }
})

const DEVICE_ID = 'test-device-id'
const ADDRESSES = ['ADDR1', 'ADDR2']

describe('fetchInbox', () => {
    const validResponse = {
        joint_account_import_requests: [],
        joint_account_sign_requests: [],
        asa_inboxes: [],
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        await fetchInbox('testnet', DEVICE_ID, ADDRESSES)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'POST',
            url: `/v1/inbox/${DEVICE_ID}/`,
            data: { addresses: ADDRESSES },
        })
    })

    test('returns parsed response on success', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        const result = await fetchInbox('mainnet', DEVICE_ID, ADDRESSES)
        expect(result).toEqual(validResponse)
    })

    test('throws when response data fails schema validation', async () => {
        const invalidData = { unexpected: 'data' }
        ;(queryClient as Mock).mockResolvedValue({ data: invalidData })

        await expect(
            fetchInbox('testnet', DEVICE_ID, ADDRESSES),
        ).rejects.toThrow()
    })

    test('propagates errors from queryClient', async () => {
        ;(queryClient as Mock).mockRejectedValue(new Error('Network error'))

        await expect(
            fetchInbox('testnet', DEVICE_ID, ADDRESSES),
        ).rejects.toThrow('Network error')
    })

    test('sends addresses in request body', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: validResponse })

        const addresses = ['ADDR1', 'ADDR2', 'ADDR3']
        await fetchInbox('testnet', DEVICE_ID, addresses)

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { addresses: ['ADDR1', 'ADDR2', 'ADDR3'] },
            }),
        )
    })
})
