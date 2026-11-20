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
    isSealedKvRecord,
    kvRecordPayload,
    openKvRecord,
    sealKvRecord,
} from '../kv-record'

const KEY = new Uint8Array(32).fill(7)
const OTHER_KEY = new Uint8Array(32).fill(9)
const PAYLOAD = '{"state":{"mode":"live"},"version":3}'

describe('kv-record', () => {
    it('opens a record sealed with the same key and storage key', () => {
        const sealed = sealKvRecord(KEY, 'network-store', PAYLOAD)

        expect(openKvRecord(KEY, 'network-store', sealed)).toBe(PAYLOAD)
    })

    it('rejects a record opened with a different key', () => {
        const sealed = sealKvRecord(KEY, 'network-store', PAYLOAD)

        expect(openKvRecord(OTHER_KEY, 'network-store', sealed)).toBeNull()
    })

    it('rejects an edited payload', () => {
        const record = JSON.parse(sealKvRecord(KEY, 'network-store', PAYLOAD))
        record.payload = PAYLOAD.replace('live', 'developer')

        expect(
            openKvRecord(KEY, 'network-store', JSON.stringify(record)),
        ).toBeNull()
    })

    it('rejects an edited tag', () => {
        const record = JSON.parse(sealKvRecord(KEY, 'network-store', PAYLOAD))
        record.tag = `${record.tag.slice(0, -2)}00`

        expect(
            openKvRecord(KEY, 'network-store', JSON.stringify(record)),
        ).toBeNull()
    })

    it('rejects a record with no tag', () => {
        const record = JSON.parse(sealKvRecord(KEY, 'network-store', PAYLOAD))
        delete record.tag

        expect(
            openKvRecord(KEY, 'network-store', JSON.stringify(record)),
        ).toBeNull()
    })

    it('rejects a non-hex tag', () => {
        const record = { v: 1, payload: PAYLOAD, tag: 'not-hex' }

        expect(
            openKvRecord(KEY, 'network-store', JSON.stringify(record)),
        ).toBeNull()
    })

    it('rejects a record sealed for another storage key', () => {
        const sealed = sealKvRecord(KEY, 'custom-network-store', PAYLOAD)

        expect(openKvRecord(KEY, 'network-store', sealed)).toBeNull()
    })

    it.each([
        ['a plain zustand envelope', PAYLOAD],
        ['malformed JSON', '{not json'],
        ['a JSON primitive', '42'],
    ])('rejects %s', (_label, raw) => {
        expect(openKvRecord(KEY, 'network-store', raw)).toBeNull()
    })

    it('recognises the sealed shape without verifying it', () => {
        expect(isSealedKvRecord(sealKvRecord(KEY, 'k', PAYLOAD))).toBe(true)
        expect(isSealedKvRecord(PAYLOAD)).toBe(false)
        expect(isSealedKvRecord('{not json')).toBe(false)
    })

    it('exposes a sealed record payload unverified and nothing for a legacy envelope', () => {
        const record = JSON.parse(sealKvRecord(KEY, 'network-store', PAYLOAD))
        record.tag = '00'

        expect(kvRecordPayload(JSON.stringify(record))).toBe(PAYLOAD)
        expect(kvRecordPayload(PAYLOAD)).toBeNull()
    })
})
