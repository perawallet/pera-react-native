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
import {
    parseAddressPayload,
    parseSecretsPayload,
    BackupPayloadParseError,
} from '../payloadParsers'

describe('parseAddressPayload', () => {
    it('parses an algo25 address payload', () => {
        const json = JSON.stringify({
            type: 'algo25',
            address: 'ADDR',
            customName: 'Main',
        })
        expect(parseAddressPayload(json)).toEqual({
            type: 'algo25',
            address: 'ADDR',
            customName: 'Main',
        })
    })

    it('parses an hdWallet address payload with derivation fields', () => {
        const json = JSON.stringify({
            type: 'hdWallet',
            address: 'ADDR',
            seedFirstDerivedAddress: 'SEEDADDR',
            publicKey: 'PUBKEY',
            account: 0,
            change: 0,
            keyIndex: 3,
            derivationType: 9,
        })
        expect(parseAddressPayload(json)).toMatchObject({
            type: 'hdWallet',
            keyIndex: 3,
            derivationType: 9,
        })
    })

    it('parses a multisig address payload', () => {
        const json = JSON.stringify({
            type: 'multisig',
            address: 'MSIG',
            participantAddresses: ['A', 'B'],
            threshold: 2,
            version: 1,
        })
        expect(parseAddressPayload(json)).toMatchObject({
            type: 'multisig',
            participantAddresses: ['A', 'B'],
            threshold: 2,
        })
    })

    it('parses a hardware address payload', () => {
        const json = JSON.stringify({
            type: 'hardware',
            address: 'ADDR',
            deviceId: 'AA:BB:CC',
            deviceName: 'Ledger Nano',
            accountIndex: 2,
            manufacturer: 'Ledger',
            transportType: 'ble',
            customName: 'Hardware',
        })
        expect(parseAddressPayload(json)).toEqual({
            type: 'hardware',
            address: 'ADDR',
            deviceId: 'AA:BB:CC',
            deviceName: 'Ledger Nano',
            accountIndex: 2,
            manufacturer: 'Ledger',
            transportType: 'ble',
            customName: 'Hardware',
        })
    })

    it('parses a watch address payload without a customName', () => {
        const json = JSON.stringify({ type: 'watch', address: 'ADDR' })
        expect(parseAddressPayload(json)).toEqual({
            type: 'watch',
            address: 'ADDR',
            customName: null,
        })
    })

    it('parses a quantum address payload', () => {
        const json = JSON.stringify({
            type: 'quantum',
            address: 'ADDR',
            customName: 'Quantum',
        })
        expect(parseAddressPayload(json)).toEqual({
            type: 'quantum',
            address: 'ADDR',
            customName: 'Quantum',
        })
    })

    it('throws on an unknown type', () => {
        expect(() =>
            parseAddressPayload(JSON.stringify({ type: 'Nope', address: 'A' })),
        ).toThrow(BackupPayloadParseError)
    })

    it('throws on malformed JSON', () => {
        expect(() => parseAddressPayload('{not json')).toThrow(
            BackupPayloadParseError,
        )
    })

    it('throws when a required field is missing', () => {
        expect(() =>
            parseAddressPayload(JSON.stringify({ type: 'algo25' })),
        ).toThrow(BackupPayloadParseError)
    })

    it('rejects a non-finite numeric field (1e999 parses to Infinity)', () => {
        const raw =
            '{"type":"hdWallet","address":"ADDR","seedFirstDerivedAddress":"S","publicKey":"P","account":0,"change":0,"keyIndex":1e999,"derivationType":9}'
        expect(() => parseAddressPayload(raw)).toThrow(BackupPayloadParseError)
    })

    it('rejects a non-integer numeric field', () => {
        const raw =
            '{"type":"hdWallet","address":"ADDR","seedFirstDerivedAddress":"S","publicKey":"P","account":0,"change":0,"keyIndex":1.5,"derivationType":9}'
        expect(() => parseAddressPayload(raw)).toThrow(BackupPayloadParseError)
    })

    it('rejects a negative numeric field', () => {
        const raw =
            '{"type":"hdWallet","address":"ADDR","seedFirstDerivedAddress":"S","publicKey":"P","account":0,"change":0,"keyIndex":-1,"derivationType":9}'
        expect(() => parseAddressPayload(raw)).toThrow(BackupPayloadParseError)
    })

    it('rejects an unknown or missing hardware transport type', () => {
        const hardware = {
            type: 'hardware',
            address: 'ADDR',
            deviceId: 'AA:BB:CC',
            deviceName: 'Ledger Nano',
            accountIndex: 2,
            manufacturer: 'Ledger',
        }
        expect(() =>
            parseAddressPayload(
                JSON.stringify({ ...hardware, transportType: 'nfc' }),
            ),
        ).toThrow(BackupPayloadParseError)
        expect(() => parseAddressPayload(JSON.stringify(hardware))).toThrow(
            BackupPayloadParseError,
        )
    })

    it('parses updatedAt on a renameable address payload', () => {
        const raw = JSON.stringify({
            type: 'algo25',
            address: 'ADDR',
            customName: 'Main',
            updatedAt: 1719300000000,
        })

        expect(parseAddressPayload(raw)).toMatchObject({
            type: 'algo25',
            address: 'ADDR',
            customName: 'Main',
            updatedAt: 1719300000000,
        })
    })

    it('treats a missing updatedAt as undefined (back-compat)', () => {
        const raw = JSON.stringify({ type: 'algo25', address: 'ADDR' })

        expect(parseAddressPayload(raw)).toEqual({
            type: 'algo25',
            address: 'ADDR',
            customName: null,
        })
    })
})

describe('parseSecretsPayload', () => {
    it('parses an algo25 secrets payload', () => {
        const json = JSON.stringify({ type: 'algo25', mnemonic: 'a b c' })
        expect(parseSecretsPayload(json)).toEqual({
            type: 'algo25',
            mnemonic: 'a b c',
        })
    })

    it('parses an hdSeed secrets payload', () => {
        const json = JSON.stringify({
            type: 'hdSeed',
            seed: 'aa',
            entropy: 'bb',
        })
        expect(parseSecretsPayload(json)).toEqual({
            type: 'hdSeed',
            seed: 'aa',
            entropy: 'bb',
        })
    })

    it('parses a quantum secrets payload', () => {
        const json = JSON.stringify({ type: 'quantum', mnemonic: 'a b c' })
        expect(parseSecretsPayload(json)).toEqual({
            type: 'quantum',
            mnemonic: 'a b c',
        })
    })

    it('keeps quantum and algo25 secrets distinct for an identical mnemonic', () => {
        const mnemonic = 'a b c'
        const asQuantum = parseSecretsPayload(
            JSON.stringify({ type: 'quantum', mnemonic }),
        )
        const asAlgo25 = parseSecretsPayload(
            JSON.stringify({ type: 'algo25', mnemonic }),
        )

        expect(asQuantum.type).toBe('quantum')
        expect(asAlgo25.type).toBe('algo25')
        expect(asQuantum).not.toEqual(asAlgo25)
    })

    it('throws on an unknown secrets type', () => {
        expect(() =>
            parseSecretsPayload(JSON.stringify({ type: 'hardware' })),
        ).toThrow(BackupPayloadParseError)
    })
})
