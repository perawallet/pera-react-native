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
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { decodeAlgorandLegacyRecord } from '../legacy-record'

const ADDRESS = 'ADDR'

const DEVICE = {
    manufacturer: 'ledger',
    deviceId: 'device-1',
    deviceName: 'Nano X',
    transportType: 'ble',
} as const

const onAlgorand = (entry: object) => ({ [ALGORAND_CHAIN_ID]: entry })

describe('decodeAlgorandLegacyRecord', () => {
    it.each([
        ['algo25', null],
        ['standalone', null],
        ['quantum', 'quantum'],
    ] as const)(
        'decodes a %s record as local custody with its key',
        (type, seed) => {
            expect(
                decodeAlgorandLegacyRecord({
                    type,
                    address: ADDRESS,
                    keyPairId: 'kp',
                }),
            ).toEqual({
                custody: { kind: 'local', seed },
                chains: onAlgorand({ address: ADDRESS, keyPairId: 'kp' }),
            })
        },
    )

    it('decodes an HD record into its account and key index', () => {
        expect(
            decodeAlgorandLegacyRecord({
                type: 'hdWallet',
                address: ADDRESS,
                keyPairId: 'kp',
                hdWalletDetails: {
                    account: 2,
                    change: 0,
                    keyIndex: 5,
                    derivationType: 9,
                },
            }),
        ).toEqual({
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 2, keyIndex: 5 },
            },
            chains: onAlgorand({ address: ADDRESS, keyPairId: 'kp' }),
        })
    })

    it('decodes a hardware record into its device and account index', () => {
        expect(
            decodeAlgorandLegacyRecord({
                type: 'hardware',
                address: ADDRESS,
                hardwareDetails: { ...DEVICE, accountIndex: 3 },
            }),
        ).toEqual({
            custody: { kind: 'hardware', device: DEVICE, accountIndex: 3 },
            chains: onAlgorand({ address: ADDRESS }),
        })
    })

    it('decodes a multisig record with its parameters as the native entry', () => {
        expect(
            decodeAlgorandLegacyRecord({
                type: 'multisig',
                address: ADDRESS,
                multisigDetails: {
                    threshold: 2,
                    addresses: ['P1', 'P2'],
                    version: 1,
                },
            }),
        ).toEqual({
            custody: { kind: 'multisig' },
            chains: onAlgorand({
                address: ADDRESS,
                native: {
                    family: 'algorand',
                    multisig: {
                        version: 1,
                        threshold: 2,
                        addresses: ['P1', 'P2'],
                    },
                },
            }),
        })
    })

    it('decodes a watch record', () => {
        expect(
            decodeAlgorandLegacyRecord({ type: 'watch', address: ADDRESS }),
        ).toEqual({
            custody: { kind: 'watch' },
            chains: onAlgorand({ address: ADDRESS }),
        })
    })

    describe('malformed records', () => {
        it('decodes an HD record without details as watch, dropping its key', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    type: 'hdWallet',
                    address: ADDRESS,
                    keyPairId: 'kp',
                }),
            ).toEqual({
                custody: { kind: 'watch' },
                chains: onAlgorand({ address: ADDRESS }),
            })
        })

        it('decodes a hardware record without details as watch', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    type: 'hardware',
                    address: ADDRESS,
                }),
            ).toEqual({
                custody: { kind: 'watch' },
                chains: onAlgorand({ address: ADDRESS }),
            })
        })

        it('keeps a multisig record without details as multisig with no native entry', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    type: 'multisig',
                    address: ADDRESS,
                }),
            ).toEqual({
                custody: { kind: 'multisig' },
                chains: onAlgorand({ address: ADDRESS }),
            })
        })

        it('keeps an algo25 record without a key as local with no key', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    type: 'algo25',
                    address: ADDRESS,
                }),
            ).toEqual({
                custody: { kind: 'local', seed: null },
                chains: onAlgorand({ address: ADDRESS }),
            })
        })

        it('decodes an unknown type as watch', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    type: 'mystery',
                    address: ADDRESS,
                    keyPairId: 'kp',
                }),
            ).toEqual({
                custody: { kind: 'watch' },
                chains: onAlgorand({ address: ADDRESS }),
            })
        })

        it.each([
            ['null', null],
            ['a string', 'record'],
            ['a record without an address', { type: 'watch' }],
            [
                'a record with a non-string address',
                { type: 'watch', address: 7 },
            ],
        ])('returns undefined for %s', (_, raw) => {
            expect(decodeAlgorandLegacyRecord(raw)).toBeUndefined()
        })
    })

    describe('records that already carry custody or chains', () => {
        it('lets an existing custody win over a contradicting type', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    type: 'algo25',
                    address: ADDRESS,
                    keyPairId: 'kp',
                    custody: { kind: 'watch' },
                }),
            ).toEqual({
                custody: { kind: 'watch' },
                chains: onAlgorand({ address: ADDRESS }),
            })
        })

        it('prefers an existing chain entry over the top-level fields', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    type: 'algo25',
                    address: 'STALE',
                    keyPairId: 'stale-kp',
                    custody: { kind: 'local', seed: null },
                    chains: onAlgorand({ address: ADDRESS, keyPairId: 'kp' }),
                }),
            ).toEqual({
                custody: { kind: 'local', seed: null },
                chains: onAlgorand({ address: ADDRESS, keyPairId: 'kp' }),
            })
        })

        it('reads a stored Algorand-named seed scheme as a seedless custody', () => {
            expect(
                decodeAlgorandLegacyRecord({
                    address: ADDRESS,
                    custody: { kind: 'local', seed: 'algo25' },
                    chains: onAlgorand({ address: ADDRESS, keyPairId: 'kp' }),
                }),
            ).toEqual({
                custody: { kind: 'local', seed: null },
                chains: onAlgorand({ address: ADDRESS, keyPairId: 'kp' }),
            })
        })

        it.each([
            ['hardware', { kind: 'hardware', device: DEVICE, accountIndex: 0 }],
            ['multisig', { kind: 'multisig' }],
            ['watch', { kind: 'watch' }],
        ] as const)('strips a key from a %s account', (_, custody) => {
            expect(
                decodeAlgorandLegacyRecord({
                    address: ADDRESS,
                    keyPairId: 'kp',
                    custody,
                }),
            ).toEqual({
                custody,
                chains: onAlgorand({ address: ADDRESS }),
            })
        })

        it("keeps other chains' entries", () => {
            expect(
                decodeAlgorandLegacyRecord({
                    custody: { kind: 'watch' },
                    chains: {
                        ...onAlgorand({ address: ADDRESS }),
                        ethereum: { address: '0xabc' },
                    },
                }),
            ).toEqual({
                custody: { kind: 'watch' },
                chains: {
                    ...onAlgorand({ address: ADDRESS }),
                    ethereum: { address: '0xabc' },
                },
            })
        })
    })
})
