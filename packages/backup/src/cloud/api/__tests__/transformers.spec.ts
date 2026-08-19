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

import { describe, test, expect } from 'vitest'
import {
    transformManifest,
    transformDeltaEntries,
    transformReadItems,
} from '../transformers'
import type {
    ManifestResponse,
    DeltaEntryResponse,
    ReadItemResponseEntry,
} from '../types'

describe('transformManifest', () => {
    test('maps snake_case wire shape to camelCase domain model', () => {
        const response: ManifestResponse = {
            backup_id: 'did:pera:PUB',
            backup_global_hash: 'sha256:global',
            global_version: 42,
            last_seq: 1050,
            generated_at: '2026-03-04T10:15:30Z',
            items: {
                'accounts/acc-1': {
                    type: 'ACCOUNT',
                    ver: 7,
                    status: 'ACTIVE',
                    hash: 'sha256:acc',
                    last_seq: 1045,
                },
            },
        }

        const manifest = transformManifest(response)

        expect(manifest).toEqual({
            backupId: 'did:pera:PUB',
            backupGlobalHash: 'sha256:global',
            globalVersion: 42,
            lastSeq: 1050,
            generatedAt: '2026-03-04T10:15:30Z',
            items: {
                'accounts/acc-1': {
                    type: 'ACCOUNT',
                    ver: 7,
                    status: 'ACTIVE',
                    hash: 'sha256:acc',
                    lastSeq: 1045,
                },
            },
        })
    })

    test('handles an empty items map', () => {
        const response: ManifestResponse = {
            backup_id: 'did:pera:PUB',
            backup_global_hash: 'sha256:empty',
            global_version: 0,
            last_seq: 0,
            generated_at: '2026-03-04T10:15:30Z',
            items: {},
        }

        expect(transformManifest(response).items).toEqual({})
    })
})

describe('transformDeltaEntries', () => {
    test('preserves DELETE entries with a null hash', () => {
        const entries: DeltaEntryResponse[] = [
            {
                seq: 1051,
                key: 'contacts/cont-1',
                type: 'CONTACT',
                ver: 4,
                status: 'ACTIVE',
                op: 'DELETE',
                hash: null,
            },
        ]

        expect(transformDeltaEntries(entries)).toEqual([
            {
                seq: 1051,
                key: 'contacts/cont-1',
                type: 'CONTACT',
                ver: 4,
                status: 'ACTIVE',
                op: 'DELETE',
                hash: null,
            },
        ])
    })
})

describe('transformReadItems', () => {
    test('keeps FOUND entries and drops NOT_FOUND / DELETED', () => {
        const entries: ReadItemResponseEntry[] = [
            {
                key: 'accounts/acc-1',
                status: 'FOUND',
                payload: 'BASE64',
                hash: 'sha256:acc',
                ver: 7,
            },
            { key: 'accounts/acc-2', status: 'NOT_FOUND' },
            { key: 'contacts/cont-1', status: 'DELETED' },
        ]

        expect(transformReadItems(entries)).toEqual([
            {
                key: 'accounts/acc-1',
                payload: 'BASE64',
                hash: 'sha256:acc',
                ver: 7,
            },
        ])
    })

    test('drops FOUND entries missing a payload (defensive)', () => {
        const entries: ReadItemResponseEntry[] = [
            { key: 'accounts/acc-1', status: 'FOUND', hash: 'h', ver: 1 },
        ]

        expect(transformReadItems(entries)).toEqual([])
    })
})
