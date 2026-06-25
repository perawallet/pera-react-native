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

import { describe, expect, it } from 'vitest'
import {
    parseAddressPayload,
    parseSecretsPayload,
    BackupPayloadParseError,
} from '../payloadParsers'

describe('parseAddressPayload', () => {
    it('parses an Algo25 address payload', () => {
        const json = JSON.stringify({
            type: 'Algo25',
            address: 'ADDR',
            customName: 'Main',
        })
        expect(parseAddressPayload(json)).toEqual({
            type: 'Algo25',
            address: 'ADDR',
            customName: 'Main',
        })
    })

    it('parses an HdKey address payload with derivation fields', () => {
        const json = JSON.stringify({
            type: 'HdKey',
            address: 'ADDR',
            seedFirstDerivedAddress: 'SEEDADDR',
            publicKey: 'PUBKEY',
            account: 0,
            change: 0,
            keyIndex: 3,
            derivationType: 9,
        })
        expect(parseAddressPayload(json)).toMatchObject({
            type: 'HdKey',
            keyIndex: 3,
            derivationType: 9,
        })
    })

    it('parses a Joint address payload', () => {
        const json = JSON.stringify({
            type: 'Joint',
            address: 'MSIG',
            participantAddresses: ['A', 'B'],
            threshold: 2,
            version: 1,
        })
        expect(parseAddressPayload(json)).toMatchObject({
            type: 'Joint',
            participantAddresses: ['A', 'B'],
            threshold: 2,
        })
    })

    it('parses a LedgerBle address payload', () => {
        const json = JSON.stringify({
            type: 'LedgerBle',
            address: 'ADDR',
            deviceMacAddress: 'AA:BB:CC',
            bluetoothName: 'Ledger Nano',
            indexInLedger: 2,
            customName: 'Hardware',
        })
        expect(parseAddressPayload(json)).toEqual({
            type: 'LedgerBle',
            address: 'ADDR',
            deviceMacAddress: 'AA:BB:CC',
            bluetoothName: 'Ledger Nano',
            indexInLedger: 2,
            customName: 'Hardware',
        })
    })

    it('parses a NoAuth address payload without a customName', () => {
        const json = JSON.stringify({ type: 'NoAuth', address: 'ADDR' })
        expect(parseAddressPayload(json)).toEqual({
            type: 'NoAuth',
            address: 'ADDR',
            customName: null,
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
            parseAddressPayload(JSON.stringify({ type: 'Algo25' })),
        ).toThrow(BackupPayloadParseError)
    })

    it('rejects a non-finite numeric field (1e999 parses to Infinity)', () => {
        const raw =
            '{"type":"HdKey","address":"ADDR","seedFirstDerivedAddress":"S","publicKey":"P","account":0,"change":0,"keyIndex":1e999,"derivationType":9}'
        expect(() => parseAddressPayload(raw)).toThrow(BackupPayloadParseError)
    })

    it('rejects a non-integer numeric field', () => {
        const raw =
            '{"type":"HdKey","address":"ADDR","seedFirstDerivedAddress":"S","publicKey":"P","account":0,"change":0,"keyIndex":1.5,"derivationType":9}'
        expect(() => parseAddressPayload(raw)).toThrow(BackupPayloadParseError)
    })

    it('rejects a negative numeric field', () => {
        const raw =
            '{"type":"HdKey","address":"ADDR","seedFirstDerivedAddress":"S","publicKey":"P","account":0,"change":0,"keyIndex":-1,"derivationType":9}'
        expect(() => parseAddressPayload(raw)).toThrow(BackupPayloadParseError)
    })
})

describe('parseSecretsPayload', () => {
    it('parses an Algo25 secrets payload', () => {
        const json = JSON.stringify({ type: 'Algo25', mnemonic: 'a b c' })
        expect(parseSecretsPayload(json)).toEqual({
            type: 'Algo25',
            mnemonic: 'a b c',
        })
    })

    it('parses an HdSeed secrets payload', () => {
        const json = JSON.stringify({
            type: 'HdSeed',
            seed: 'aa',
            entropy: 'bb',
        })
        expect(parseSecretsPayload(json)).toEqual({
            type: 'HdSeed',
            seed: 'aa',
            entropy: 'bb',
        })
    })

    it('throws on an unknown secrets type', () => {
        expect(() =>
            parseSecretsPayload(JSON.stringify({ type: 'LedgerBle' })),
        ).toThrow(BackupPayloadParseError)
    })
})
