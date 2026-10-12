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
import type {
    DeviceAccountRegistration,
    DeviceRegistration,
} from '../../models'
import { toDeviceRegistrationRequest } from '../serializers'
import {
    GOLDEN_CREATE_REQUEST,
    GOLDEN_DEVICE_ACCOUNT_TYPES,
    GOLDEN_UPDATE_REQUEST,
} from './deviceWireFormat.golden'

// Round-trips through JSON so the comparison sees exactly what goes on the
// wire: an `undefined` field is dropped there, and must not count here.
const onTheWire = (registration: DeviceRegistration): unknown =>
    JSON.parse(JSON.stringify(toDeviceRegistrationRequest(registration)))

// The chain spells `accountType`; registration passes it through verbatim
// and keeps `rank` off the wire.
const account = (
    address: string,
    accountType: string,
    receiveNotifications = true,
): DeviceAccountRegistration => ({
    address,
    accountType,
    rank: 1,
    receiveNotifications,
})

const types = GOLDEN_DEVICE_ACCOUNT_TYPES

describe('devices API wire format', () => {
    it('sends an update of a known device as the golden body', () => {
        const registration: DeviceRegistration = {
            id: '3502762836822418987',
            pushToken: 'fcm-token',
            platform: 'ios',
            locale: 'en-US',
            appVersion: '7.0.1',
            currency: 'USD',
            accounts: [
                account('ALGO25ADDR', types.algo25),
                account('HDCHILDADDR', types.hdWallet),
                account('LEDGERADDR', types.hardware),
                account('MSIGADDR', types.multisig),
                account('WATCHADDR', types.watch, false),
                account('QUANTUMADDR', types.quantum),
            ],
        }

        expect(onTheWire(registration)).toStrictEqual(
            JSON.parse(GOLDEN_UPDATE_REQUEST),
        )
    })

    it('sends a new device without an id or currency as the golden body', () => {
        const registration: DeviceRegistration = {
            pushToken: 'fcm-token',
            platform: 'android',
            locale: 'en-US',
            appVersion: '7.0.1',
            accounts: [],
        }

        expect(onTheWire(registration)).toStrictEqual(
            JSON.parse(GOLDEN_CREATE_REQUEST),
        )
    })
})
