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
    hdPositionOf,
    payloadChain,
    type AddressBackupPayload,
    type SecretsBackupPayload,
} from '../payloads'

const hdWallet: AddressBackupPayload = {
    type: 'hdWallet',
    address: 'A',
    seedFirstDerivedAddress: 'SEED',
    publicKey: 'aa',
    account: 1,
    change: 0,
    keyIndex: 2,
    derivationType: 9,
    customName: null,
}
const hdChain: AddressBackupPayload = {
    type: 'hdChain',
    chain: 'ethereum',
    address: '0xa',
    seedFirstDerivedAddress: 'SEED',
    account: 3,
    keyIndex: 4,
    customName: null,
}
const standaloneKey: AddressBackupPayload = {
    type: 'standaloneKey',
    chain: 'ethereum',
    address: '0xb',
    customName: null,
}
const watchChain: AddressBackupPayload = {
    type: 'watchChain',
    chain: 'ethereum',
    address: '0xc',
    customName: null,
}
const legacyKinds: AddressBackupPayload[] = [
    hdWallet,
    { type: 'algo25', address: 'A', customName: null },
    { type: 'hdSeed', address: 'A' },
    { type: 'watch', address: 'A', customName: null },
    { type: 'quantum', address: 'A', customName: null },
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
const standaloneKeySecret: SecretsBackupPayload = {
    type: 'standaloneKey',
    chain: 'ethereum',
    address: '0xb',
    privateKey: 'ab',
}

describe('payloadChain', () => {
    test.each([hdChain, standaloneKey, watchChain, standaloneKeySecret])(
        'reads the chain off a chain-tagged $type payload',
        payload => {
            expect(payloadChain(payload)).toBe('ethereum')
        },
    )

    test.each(legacyKinds)('is null for a legacy $type payload', payload => {
        expect(payloadChain(payload)).toBeNull()
    })

    test('is null for a legacy secrets payload', () => {
        expect(
            payloadChain({ type: 'algo25', mnemonic: 'a b', address: 'A' }),
        ).toBeNull()
    })
})

describe('hdPositionOf', () => {
    test('reads the seed position off an hdWallet payload', () => {
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

    test.each([
        ...legacyKinds.filter(payload => payload.type !== 'hdWallet'),
        standaloneKey,
        watchChain,
    ])('is null for a $type payload', payload => {
        expect(hdPositionOf(payload)).toBeNull()
    })
})
