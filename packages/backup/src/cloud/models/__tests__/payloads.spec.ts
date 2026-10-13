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

import { describe, expect, test } from 'vitest'
import {
    accountIdentityOf,
    chainBackupKind,
    hdPositionOf,
    type AccountEntryPayload,
} from '../payloads'

const hdWallet: AccountEntryPayload = {
    type: chainBackupKind('hdWallet'),
    address: 'A',
    seedFirstDerivedAddress: 'SEED',
    publicKey: 'aa',
    account: 1,
    change: 0,
    keyIndex: 2,
    derivationType: 9,
    customName: null,
}
const hdChain: AccountEntryPayload = {
    type: 'hdChain',
    address: '0xa',
    seedFirstDerivedAddress: 'SEED',
    account: 3,
    keyIndex: 4,
    customName: null,
}
const singleKinds: AccountEntryPayload[] = [
    { type: chainBackupKind('algo25'), address: 'A', customName: null },
    { type: 'hdSeed', address: 'A' },
    { type: 'watch', address: 'A', customName: null },
    { type: 'standaloneKey', address: '0xb', customName: null },
    {
        type: 'multisig',
        address: 'A',
        participantAddresses: [],
        threshold: 1,
        version: 1,
        customName: null,
    },
    {
        type: 'hardware',
        address: 'A',
        deviceId: 'd',
        deviceName: 'n',
        accountIndex: 0,
        manufacturer: 'm',
        transportType: 'ble',
        customName: null,
    },
]

describe('hdPositionOf', () => {
    test('reads the seed position off a chain HD payload', () => {
        expect(hdPositionOf(hdWallet)).toEqual({
            seedReference: 'SEED',
            account: 1,
            keyIndex: 2,
        })
    })

    test('reads the seed position off an hdChain payload', () => {
        expect(hdPositionOf(hdChain)).toEqual({
            seedReference: 'SEED',
            account: 3,
            keyIndex: 4,
        })
    })

    test.each(singleKinds)('is null for a $type payload', payload => {
        expect(hdPositionOf(payload)).toBeNull()
    })
})

describe('accountIdentityOf', () => {
    test('names an HD entry by its seed position, whatever its chain', () => {
        expect(accountIdentityOf(hdWallet)).toBe('SEED/1/2')
        expect(accountIdentityOf({ ...hdChain, account: 1, keyIndex: 2 })).toBe(
            'SEED/1/2',
        )
    })

    test.each(singleKinds)('names a $type entry by its address', payload => {
        expect(accountIdentityOf(payload)).toBe(payload.address)
    })
})
