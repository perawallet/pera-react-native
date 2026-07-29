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
import { queryClient } from '@perawallet/wallet-core-shared'
import { registerDevice, deleteDevice } from '../endpoints'
import { DeviceAccountTypes, type DeviceRegistration } from '../../models'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: vi.fn(),
}))

const mockedQueryClient = vi.mocked(queryClient)

const registration: DeviceRegistration = {
    pushToken: 'fcm-token',
    platform: 'ios',
    locale: 'en-US',
    appVersion: '7.0.1',
    accounts: [
        {
            address: 'ADDR_A',
            accountType: DeviceAccountTypes.quantum,
            receiveNotifications: true,
        },
    ],
}

describe('device endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockedQueryClient.mockResolvedValue({
            data: { id: 'new-id' },
            status: 200,
            statusText: 'OK',
        })
    })

    it('registers via POST to api/v3/devices with the serialized body', async () => {
        await registerDevice('mainnet', registration)

        expect(mockedQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                network: 'mainnet',
                method: 'POST',
                url: 'api/v3/devices',
                data: {
                    push_token: 'fcm-token',
                    platform: 'ios',
                    locale: 'en-US',
                    app_version: '7.0.1',
                    accounts: [
                        {
                            address: 'ADDR_A',
                            account_type: 'quantum',
                            receive_notifications: true,
                        },
                    ],
                },
            }),
        )
    })

    it('returns the response payload', async () => {
        const result = await registerDevice('mainnet', registration)

        expect(result).toEqual({ id: 'new-id' })
    })

    it('deletes via DELETE to api/v3/devices with a text response', async () => {
        await deleteDevice('mainnet', { id: 'DEV-1' })

        expect(mockedQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                network: 'mainnet',
                method: 'DELETE',
                url: 'api/v3/devices',
                data: { id: 'DEV-1' },
                responseType: 'text',
            }),
        )
    })
})

/**
 * `config` (packages/config/src/main.ts) is `Object.freeze(getConfig())` — a
 * plain object with data properties, not accessor properties. `vi.spyOn(config,
 * 'backendAPIKeyV3', 'get')` throws because there is no getter to spy on, and
 * the freeze would reject redefining a data property anyway. A module mock is
 * the only way to control the value it resolves to, and since the two cases
 * need different `config` shapes, each test mocks the module itself, resets
 * the module registry, and re-imports both `queryClient` and `endpoints`
 * fresh so the mocked config is the one `endpoints.ts` actually sees.
 */
describe('device API key resolution', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('sends the v3 api key when one is configured', async () => {
        vi.doMock('@perawallet/wallet-core-config', () => ({
            config: { backendAPIKey: 'v1-key', backendAPIKeyV3: 'v3-key' },
        }))
        const { queryClient: freshQueryClient } =
            await import('@perawallet/wallet-core-shared')
        const freshMockedQueryClient = vi.mocked(freshQueryClient)
        freshMockedQueryClient.mockResolvedValue({
            data: { id: 'new-id' },
            status: 200,
            statusText: 'OK',
        })
        const { registerDevice: freshRegisterDevice } =
            await import('../endpoints')

        await freshRegisterDevice('mainnet', registration)

        expect(freshMockedQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({ headers: { 'x-api-key': 'v3-key' } }),
        )
    })

    it('falls back to the v1 key while the v3 key is unset', async () => {
        vi.doMock('@perawallet/wallet-core-config', () => ({
            config: { backendAPIKey: 'v1-key', backendAPIKeyV3: '' },
        }))
        const { queryClient: freshQueryClient } =
            await import('@perawallet/wallet-core-shared')
        const freshMockedQueryClient = vi.mocked(freshQueryClient)
        freshMockedQueryClient.mockResolvedValue({
            data: { id: 'new-id' },
            status: 200,
            statusText: 'OK',
        })
        const { registerDevice: freshRegisterDevice } =
            await import('../endpoints')

        await freshRegisterDevice('mainnet', registration)

        expect(freshMockedQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({ headers: { 'x-api-key': 'v1-key' } }),
        )
    })
})
