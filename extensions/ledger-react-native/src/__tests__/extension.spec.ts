/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi } from 'vitest'

vi.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
    default: { listen: vi.fn(), open: vi.fn(), isSupported: vi.fn() },
}))
vi.mock('@algorandfoundation/ledger-algorand-js', () => ({
    AlgorandApp: class {
        getAddressAndPubKey = vi.fn()
        sign = vi.fn()
        getVersion = vi.fn()
        signData = vi.fn()
    },
    ScopeType: { UNKNOWN: -1, AUTH: 1 },
}))
vi.mock('react-native', () => ({
    Platform: { OS: 'ios', Version: 17 },
    PermissionsAndroid: {
        check: vi.fn(),
        PERMISSIONS: {
            BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
            BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
            ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
        },
    },
}))

import { WithLedgerExtension } from '../extension'

describe('WithLedgerExtension', () => {
    test('registers the Ledger transport provider on the hardware wallet registry', () => {
        const register = vi.fn()
        const provider = {
            hardwareWalletRegistry: { register },
        }

        const result = WithLedgerExtension(provider as never)

        expect(register).toHaveBeenCalledTimes(1)
        const [registered] = register.mock.calls[0]
        expect(registered.manufacturer).toBe('ledger')
        expect(typeof registered.scan).toBe('function')
        expect(result).toEqual({})
    })
})
