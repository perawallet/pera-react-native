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

import { describe, test, expect, it } from 'vitest'
import { getBluetoothServiceUuids } from '@ledgerhq/devices'
import {
    resolveDeviceModel,
    buildLedgerAccountPath,
    LEDGER_BLE_SERVICE_UUIDS,
    MIN_ARBITRARY_SIGN_APP_VERSION,
    isAppVersionAtLeast,
} from '../constants'

describe('resolveDeviceModel', () => {
    test('defaults to nanoX when serviceUUIDs is null', () => {
        expect(resolveDeviceModel(null)).toBe('nanoX')
    })

    test('defaults to nanoX when no uuid matches a known device', () => {
        expect(resolveDeviceModel(['not-a-real-uuid'])).toBe('nanoX')
    })

    test('resolves a known Ledger BLE service UUID to a friendly device name', () => {
        const knownUuid = getBluetoothServiceUuids()[0]
        expect(typeof knownUuid).toBe('string')
        // The returned model is one of the mapped friendly names (or the
        // nanoX fallback if the UUID corresponds to an unmapped device).
        expect(['nanoX', 'stax', 'flex', 'nanoGen5']).toContain(
            resolveDeviceModel([knownUuid]),
        )
    })

    test('LEDGER_BLE_SERVICE_UUIDS mirrors getBluetoothServiceUuids()', () => {
        expect(LEDGER_BLE_SERVICE_UUIDS).toEqual(getBluetoothServiceUuids())
    })
})

describe('buildLedgerAccountPath', () => {
    test('builds the m/-prefixed Algorand BIP-44 path with the given account index', () => {
        // `@algorandfoundation/ledger-algorand-js` serializePath (used by
        // signData) requires the canonical "m/"-prefixed BIP-32 form.
        expect(buildLedgerAccountPath(0)).toBe("m/44'/283'/0'/0/0")
        expect(buildLedgerAccountPath(5)).toBe("m/44'/283'/5'/0/0")
    })
})

describe('isAppVersionAtLeast', () => {
    it('true when version equals the minimum', () => {
        expect(
            isAppVersionAtLeast(
                MIN_ARBITRARY_SIGN_APP_VERSION,
                MIN_ARBITRARY_SIGN_APP_VERSION,
            ),
        ).toBe(true)
    })

    it('false when major is lower', () => {
        expect(
            isAppVersionAtLeast(
                { major: 1, minor: 99, patch: 99 },
                { major: 2, minor: 0, patch: 0 },
            ),
        ).toBe(false)
    })

    it('true when minor is higher at equal major', () => {
        expect(
            isAppVersionAtLeast(
                { major: 2, minor: 5, patch: 0 },
                { major: 2, minor: 1, patch: 0 },
            ),
        ).toBe(true)
    })

    it('compares patch when major+minor equal', () => {
        expect(
            isAppVersionAtLeast(
                { major: 2, minor: 1, patch: 0 },
                { major: 2, minor: 1, patch: 4 },
            ),
        ).toBe(false)
    })
})
