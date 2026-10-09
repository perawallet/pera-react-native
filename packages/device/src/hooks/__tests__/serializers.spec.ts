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
import type { DeviceRegistration } from '../../models'

// The chain names the kinds and ranks them; serialization only compares ranks.
const SIGNING = { accountType: 'signing-kind', rank: 2 } as const
const WATCH = { accountType: 'watch-kind', rank: 1 } as const

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
                    ...SIGNING,
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
                    account_type: 'signing-kind',
                    receive_notifications: true,
                },
            ],
        })
    })

    it('sends the display currency the user picked', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            currency: 'TRY',
        })

        expect(request.currency).toBe('TRY')
    })

    it('omits currency when the registration carries none', () => {
        const request = toDeviceRegistrationRequest(baseRegistration)

        expect('currency' in request).toBe(false)
    })

    it('omits an over-long currency rather than truncating it', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            currency: 'TOOLONGCURRENCY',
        })

        expect('currency' in request).toBe(false)
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
                    ...WATCH,
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
        // `rank` decides deduplication locally and never reaches the wire.
        expect(Object.keys(request.accounts[0]).sort()).toEqual([
            'account_type',
            'address',
            'receive_notifications',
        ])
    })

    it('deduplicates repeated addresses, the higher-ranked registration winning', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...WATCH,
                    receiveNotifications: false,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                account_type: 'signing-kind',
                receive_notifications: true,
            },
        ])
    })

    it('registers a duplicated address under the higher rank when the watch entry comes first', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...WATCH,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                account_type: 'signing-kind',
                receive_notifications: true,
            },
        ])
    })

    it('registers a duplicated address under the higher rank when the watch entry comes last', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...WATCH,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                account_type: 'signing-kind',
                receive_notifications: true,
            },
        ])
    })

    it('keeps the last entry when two duplicates rank equally', () => {
        const request = toDeviceRegistrationRequest({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: false,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                account_type: 'signing-kind',
                receive_notifications: false,
            },
        ])
    })

    it('emits an empty accounts array rather than omitting the field', () => {
        const request = toDeviceRegistrationRequest(baseRegistration)

        expect(request.accounts).toEqual([])
    })
})
