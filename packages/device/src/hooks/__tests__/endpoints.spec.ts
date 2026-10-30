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
import {
    deleteDevice,
    isSentInDeviceRegistration,
    registerDevice,
} from '../endpoints'
import { deviceChainAdapters } from '../../registrations/chain-adapter'
import type { DeviceRegistration } from '../../models'

const mocks = vi.hoisted(() => ({ isV4: true }))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: vi.fn(),
}))

vi.mock('../registrationApi', () => ({
    isDeviceRegistrationV4Enabled: () => mocks.isV4,
}))

const mockedQueryClient = vi.mocked(queryClient)

const registration: DeviceRegistration = {
    pushToken: 'fcm-token',
    platform: 'ios',
    locale: 'en-US',
    appVersion: '7.0.1',
    accounts: [
        {
            chainId: 'algorand',
            address: 'ADDR_A',
            accountType: 'signing-kind',
            rank: 2,
            receiveNotifications: true,
        },
    ],
}

describe('device endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isV4 = true
        mockedQueryClient.mockResolvedValue({
            data: { id: 'new-id' },
            status: 200,
            statusText: 'OK',
        })
    })

    it('registers via POST to api/v4/devices/ with the serialized body', async () => {
        await registerDevice('live', registration)

        expect(mockedQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                deployment: 'live',
                method: 'POST',
                url: 'api/v4/devices/',
                data: {
                    push_token: 'fcm-token',
                    platform: 'ios',
                    locale: 'en-US',
                    app_version: '7.0.1',
                    accounts: [
                        {
                            address: 'ADDR_A',
                            chain: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
                            account_type: 'signing-kind',
                            receive_notifications: true,
                        },
                    ],
                },
            }),
        )
    })

    it('names each chain by the network of the deployment the request goes to', async () => {
        await registerDevice('developer', {
            ...registration,
            accounts: [
                ...registration.accounts,
                {
                    chainId: 'ethereum',
                    address: '0xabc',
                    accountType: 'hdWallet',
                    rank: 0,
                    receiveNotifications: true,
                },
            ],
        })

        const [{ data }] = mockedQueryClient.mock.calls[0] as [
            { data: { accounts: { chain: string }[] } },
        ]
        expect(data.accounts.map(account => account.chain)).toEqual([
            'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
            'eip155:11155111',
        ])
    })

    it('returns the response payload', async () => {
        const result = await registerDevice('live', registration)

        expect(result).toEqual({ id: 'new-id' })
    })

    describe('while v4 registration is off', () => {
        beforeEach(() => {
            mocks.isV4 = false
            deviceChainAdapters.reset()
            deviceChainAdapters.register({
                chainId: 'algorand',
                accountTypeOf: () => 'signing-kind',
                rankOf: () => 2,
                isOnV3DevicesApi: true,
            })
            deviceChainAdapters.register({
                chainId: 'ethereum',
                accountTypeOf: () => 'hdWallet',
                rankOf: () => 0,
            })
        })

        it('registers on api/v3/devices with only the chains v3 takes, and no chain field', async () => {
            await registerDevice('live', {
                ...registration,
                accounts: [
                    ...registration.accounts,
                    {
                        chainId: 'ethereum',
                        address: '0xabc',
                        accountType: 'hdWallet',
                        rank: 0,
                        receiveNotifications: true,
                    },
                ],
            })

            expect(mockedQueryClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    url: 'api/v3/devices',
                    data: expect.objectContaining({
                        accounts: [
                            {
                                address: 'ADDR_A',
                                account_type: 'signing-kind',
                                receive_notifications: true,
                            },
                        ],
                    }),
                }),
            )
        })
    })

    it('deletes via DELETE to api/v3/devices with a text response', async () => {
        await deleteDevice('live', { id: 'DEV-1' })

        expect(mockedQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                deployment: 'live',
                method: 'DELETE',
                url: 'api/v3/devices',
                data: { id: 'DEV-1' },
                responseType: 'text',
            }),
        )
    })
})

describe('isSentInDeviceRegistration', () => {
    const onAlgorand = { chains: { algorand: { address: 'ADDR_A' } } }
    const onEthereum = { chains: { ethereum: { address: '0xabc' } } }

    beforeEach(() => {
        mocks.isV4 = true
        deviceChainAdapters.reset()
        deviceChainAdapters.register({
            chainId: 'algorand',
            accountTypeOf: () => 'signing-kind',
            rankOf: () => 2,
            isOnV3DevicesApi: true,
        })
        deviceChainAdapters.register({
            chainId: 'ethereum',
            accountTypeOf: () => 'hdWallet',
            rankOf: () => 0,
        })
    })

    it('is true for an address on any chain with a device adapter on v4', () => {
        expect(isSentInDeviceRegistration(onAlgorand, 'algorand', 'live')).toBe(
            true,
        )
        expect(
            isSentInDeviceRegistration(onEthereum, 'ethereum', 'developer'),
        ).toBe(true)
    })

    it('is true only for the chains v3 takes while v4 is off', () => {
        mocks.isV4 = false

        expect(isSentInDeviceRegistration(onAlgorand, 'algorand', 'live')).toBe(
            true,
        )
        expect(isSentInDeviceRegistration(onEthereum, 'ethereum', 'live')).toBe(
            false,
        )
    })

    it('is false for an account its chain declines to register', () => {
        deviceChainAdapters.reset()
        deviceChainAdapters.register({
            chainId: 'algorand',
            accountTypeOf: () => null,
            rankOf: () => 0,
            isOnV3DevicesApi: true,
        })

        expect(isSentInDeviceRegistration(onAlgorand, 'algorand', 'live')).toBe(
            false,
        )
    })

    it('is false on a chain the account holds no address on', () => {
        expect(isSentInDeviceRegistration(onAlgorand, 'ethereum', 'live')).toBe(
            false,
        )
    })

    it('is false on a chain without a device adapter', () => {
        deviceChainAdapters.reset()

        expect(isSentInDeviceRegistration(onAlgorand, 'algorand', 'live')).toBe(
            false,
        )
    })
})
