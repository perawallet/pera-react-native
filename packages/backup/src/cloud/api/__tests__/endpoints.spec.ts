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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { BatchUpsertRequest, UpsertItemRequest } from '../types'

const signedBackupRequestMock = vi.fn()
const queryClientMock = vi.fn().mockResolvedValue({ data: {} })

vi.mock('../signedRequest', () => ({
    signedBackupRequest: (...args: unknown[]) =>
        signedBackupRequestMock(...args),
}))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: (...args: unknown[]) => queryClientMock(...args),
}))

import {
    batchUpsertItems,
    deleteItem,
    fetchDelta,
    fetchItem,
    upsertItem,
} from '../endpoints'

describe('fetchDelta', () => {
    beforeEach(() => signedBackupRequestMock.mockReset())

    it('unwraps the entries array from the delta response', async () => {
        signedBackupRequestMock.mockResolvedValue({
            entries: [
                {
                    seq: 5,
                    key: 'accounts/ADDR',
                    type: 'ACCOUNT',
                    ver: 1,
                    status: 'ACTIVE',
                    op: 'UPSERT',
                    hash: 'sha256:abc',
                },
            ],
        })

        const result = await fetchDelta(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            0,
        )

        expect(result).toEqual([
            {
                seq: 5,
                key: 'accounts/ADDR',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'sha256:abc',
            },
        ])
    })

    it('returns an empty array when the response has no entries', async () => {
        signedBackupRequestMock.mockResolvedValue({})

        const result = await fetchDelta(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            0,
        )

        expect(result).toEqual([])
    })
})

describe('fetchItem', () => {
    beforeEach(() => signedBackupRequestMock.mockReset())

    it('issues a signed GET for the item key and returns the payload as text', async () => {
        signedBackupRequestMock.mockResolvedValue('ENCRYPTED_PAYLOAD')

        const result = await fetchItem(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            'accounts/ADDR',
        )

        expect(signedBackupRequestMock).toHaveBeenCalledWith({
            network: 'mainnet',
            method: 'GET',
            backupId: 'did:pera:ADDR',
            pathSuffix: '/accounts/ADDR',
            deviceId: 'device-1',
            responseType: 'text',
        })
        expect(result).toBe('ENCRYPTED_PAYLOAD')
    })
})

describe('upsertItem', () => {
    beforeEach(() => signedBackupRequestMock.mockReset())

    it('issues a signed PUT carrying the upsert request body', async () => {
        const request: UpsertItemRequest = {
            expected_ver: 1,
            status: 'ACTIVE',
            device_id: 'device-1',
            type: 'ACCOUNT',
            payload: 'ENCRYPTED_PAYLOAD',
        }
        signedBackupRequestMock.mockResolvedValue({ new_ver: 2, seq: 7 })

        const result = await upsertItem(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            'accounts/ADDR',
            request,
        )

        expect(signedBackupRequestMock).toHaveBeenCalledWith({
            network: 'mainnet',
            method: 'PUT',
            backupId: 'did:pera:ADDR',
            pathSuffix: '/accounts/ADDR',
            deviceId: 'device-1',
            data: request,
        })
        expect(result).toEqual({ new_ver: 2, seq: 7 })
    })
})

describe('batchUpsertItems', () => {
    beforeEach(() => signedBackupRequestMock.mockReset())

    it('issues a signed POST to the batch upsert path', async () => {
        const request: BatchUpsertRequest = {
            device_id: 'device-1',
            items: [
                {
                    key: 'accounts/ADDR',
                    type: 'ACCOUNT',
                    expected_ver: 1,
                    status: 'ACTIVE',
                    payload: 'ENCRYPTED_PAYLOAD',
                },
            ],
        }
        signedBackupRequestMock.mockResolvedValue({ results: [] })

        const result = await batchUpsertItems(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            request,
        )

        expect(signedBackupRequestMock).toHaveBeenCalledWith({
            network: 'mainnet',
            method: 'POST',
            backupId: 'did:pera:ADDR',
            pathSuffix: '/items/upsert',
            deviceId: 'device-1',
            data: request,
        })
        expect(result).toEqual({ results: [] })
    })
})

describe('deleteItem', () => {
    beforeEach(() => signedBackupRequestMock.mockReset())

    it('issues a signed DELETE for the item key', async () => {
        signedBackupRequestMock.mockResolvedValue({ seq: 9 })

        const result = await deleteItem(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            'accounts/ADDR',
        )

        expect(signedBackupRequestMock).toHaveBeenCalledWith({
            network: 'mainnet',
            method: 'DELETE',
            backupId: 'did:pera:ADDR',
            pathSuffix: '/accounts/ADDR',
            deviceId: 'device-1',
        })
        expect(result).toEqual({ seq: 9 })
    })
})
