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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const queryClientMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: queryClientMock,
}))

import { createDevice, updateDevice, deleteDevice } from '../endpoints'

describe('device endpoints', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('createDevice posts to /v1/devices/', async () => {
        queryClientMock.mockResolvedValue({ data: { id: 'new-id' } })
        const data = {
            accounts: ['A'],
            platform: 'ios',
            model: 'iPhone',
            application: 'pera',
            locale: 'en-US',
        }

        const result = await createDevice('mainnet', data)

        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'POST',
            url: 'v1/devices/',
            data,
        })
        expect(result).toEqual({ id: 'new-id' })
    })

    test('updateDevice puts to /v1/devices/:id/', async () => {
        queryClientMock.mockResolvedValue({ data: { id: 'abc' } })
        const data = {
            accounts: ['A'],
            platform: 'ios',
            model: 'iPhone',
            application: 'pera',
            locale: 'en-US',
        }

        const result = await updateDevice('testnet', 'abc', data)

        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'PUT',
            url: 'v1/devices/abc/',
            data,
        })
        expect(result).toEqual({ id: 'abc' })
    })

    test('deleteDevice sends DELETE with text response type', async () => {
        queryClientMock.mockResolvedValue({ data: 'ok' })
        const data = {
            accounts: ['A'],
            platform: 'ios',
            model: 'iPhone',
            application: 'pera',
            locale: 'en-US',
        }

        await deleteDevice('mainnet', data)

        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'DELETE',
            url: 'v1/devices/',
            data,
            responseType: 'text',
        })
    })
})
