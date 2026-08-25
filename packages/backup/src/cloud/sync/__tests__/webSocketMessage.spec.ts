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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
    BackupWebSocketMessageReject,
    parseBackupWebSocketMessage,
} from '../webSocketMessage'

describe('parseBackupWebSocketMessage', () => {
    it('parses an ITEMS_UPDATED frame', () => {
        const result = parseBackupWebSocketMessage(
            JSON.stringify({ type: 'ITEMS_UPDATED', from_seq: 5, to_seq: 7 }),
        )

        expect(result).toEqual({
            ok: true,
            message: { type: 'ITEMS_UPDATED', from_seq: 5, to_seq: 7 },
        })
    })

    it('defaults omitted sequence numbers to 0', () => {
        const result = parseBackupWebSocketMessage(
            JSON.stringify({ type: 'ITEMS_UPDATED' }),
        )

        expect(result).toMatchObject({
            ok: true,
            message: { from_seq: 0, to_seq: 0 },
        })
    })

    it('parses a BACKUP_DELETED frame', () => {
        const result = parseBackupWebSocketMessage(
            JSON.stringify({ type: 'BACKUP_DELETED' }),
        )

        expect(result).toEqual({
            ok: true,
            message: { type: 'BACKUP_DELETED' },
        })
    })

    it.each([
        ['a string sequence number', { type: 'ITEMS_UPDATED', from_seq: '5' }],
        ['a negative sequence number', { type: 'ITEMS_UPDATED', to_seq: -1 }],
        [
            'a fractional sequence number',
            { type: 'ITEMS_UPDATED', to_seq: 1.5 },
        ],
        ['a null sequence number', { type: 'ITEMS_UPDATED', from_seq: null }],
    ])('rejects %s as malformed', (_label, frame) => {
        const result = parseBackupWebSocketMessage(JSON.stringify(frame))

        expect(result).toEqual({
            ok: false,
            reject: BackupWebSocketMessageReject.Malformed,
            type: 'ITEMS_UPDATED',
        })
    })

    it('reports a non-JSON frame as unparseable', () => {
        const result = parseBackupWebSocketMessage('not json')

        expect(result).toEqual({
            ok: false,
            reject: BackupWebSocketMessageReject.Unparseable,
        })
    })

    it('reports an unrecognised type separately so newer server frames stay quiet', () => {
        const result = parseBackupWebSocketMessage(
            JSON.stringify({ type: 'SOMETHING_NEW', payload: 1 }),
        )

        expect(result).toEqual({
            ok: false,
            reject: BackupWebSocketMessageReject.UnknownType,
            type: 'SOMETHING_NEW',
        })
    })

    it('reports a typeless frame as an unknown type', () => {
        const result = parseBackupWebSocketMessage(JSON.stringify({ a: 1 }))

        expect(result).toMatchObject({
            ok: false,
            reject: BackupWebSocketMessageReject.UnknownType,
        })
    })
})
