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

import { describe, expect, it } from 'vitest'
import { toDeviceRegistrationRequest } from '../serializers'
import { DeviceAccountTypes, type DeviceRegistration } from '../../models'

const baseRegistration: DeviceRegistration = {
    pushToken: 'fcm-token',
    platform: 'ios',
    locale: 'en-US',
    appVersion: '7.0.1',
    accounts: [],
}

describe('toDeviceRegistrationRequest', () => {
    it('maps the domain payload onto the v3 wire shape', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    accountType: DeviceAccountTypes.quantum,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request).toEqual({
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
        })
    })

    it('omits id when the registration has none', () => {
        const request = toDeviceRegistrationRequest(baseRegistration)

        expect('id' in request).toBe(false)
    })

    it('includes id when the registration carries one', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            id: '3502762836822418987',
        })

        expect(request.id).toBe('3502762836822418987')
    })

    it('never emits the v1-only model, application or is_watch_account fields', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    accountType: DeviceAccountTypes.watch,
                    receiveNotifications: false,
                },
            ],
        })

        expect(Object.keys(request).sort()).toEqual([
            'accounts',
            'app_version',
            'locale',
            'platform',
            'push_token',
        ])
        expect(Object.keys(request.accounts[0]).sort()).toEqual([
            'account_type',
            'address',
            'receive_notifications',
        ])
    })

    it('deduplicates repeated addresses, last one winning', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    accountType: DeviceAccountTypes.algo25,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    accountType: DeviceAccountTypes.watch,
                    receiveNotifications: false,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                account_type: 'watch',
                receive_notifications: false,
            },
        ])
    })

    it('emits an empty accounts array rather than omitting the field', () => {
        const request = toDeviceRegistrationRequest(baseRegistration)

        expect(request.accounts).toEqual([])
    })
})
